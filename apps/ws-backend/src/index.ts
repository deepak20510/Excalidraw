import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { PrismaClient } from "@repo/db/client";

const DEFAULT_PORT = 8082;
const FALLBACK_PORT = 8083;
const configuredPort = Number(process.env.WS_PORT ?? process.env.PORT ?? DEFAULT_PORT);
const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});
const wss = new WebSocketServer({ server: httpServer });

// Keepalive heartbeat checks for idle connections
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if ((ws as any).isAlive === false) {
      console.log("Terminating unresponsive WS connection");
      return ws.terminate();
    }
    (ws as any).isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(heartbeatInterval);
});

interface User {
  ws: WebSocket;
  rooms: string[];
  userId: string;
  name: string;
}
const users: User[] = [];

// In-memory presence: roomId -> Map<userId, { name, userId }>
const roomPresence = new Map<string, Map<string, { userId: string; name: string }>>();

// Operational Transform / Conflict Resolution (Last-Write-Wins with timestamps)
const roomShapeTimestamps = new Map<number, Map<string | number, number>>();

function getShapeKey(shape: any, fallbackIndex?: number): string | number {
  if (shape && shape.id !== undefined && shape.id !== null) {
    return `id_${shape.id}`;
  }
  if (shape && shape.seed !== undefined && shape.seed !== null) {
    return `seed_${shape.seed}`;
  }
  return fallbackIndex !== undefined ? `index_${fallbackIndex}` : "default";
}

function getShapeTimestamp(shape: any, messageTimestamp?: number): number {
  if (shape && typeof shape.updatedAt === "number" && !isNaN(shape.updatedAt)) {
    return shape.updatedAt;
  }
  if (typeof messageTimestamp === "number" && !isNaN(messageTimestamp)) {
    return messageTimestamp;
  }
  return Date.now();
}

function checkAndUpdateLWW(
  roomId: number,
  shapeKey: string | number,
  incomingTimestamp: number
): { accepted: boolean; currentTimestamp: number } {
  let timestamps = roomShapeTimestamps.get(roomId);
  if (!timestamps) {
    timestamps = new Map<string | number, number>();
    roomShapeTimestamps.set(roomId, timestamps);
  }

  const existingTimestamp = timestamps.get(shapeKey) ?? 0;

  if (incomingTimestamp >= existingTimestamp) {
    timestamps.set(shapeKey, incomingTimestamp);
    return { accepted: true, currentTimestamp: incomingTimestamp };
  } else {
    return { accepted: false, currentTimestamp: existingTimestamp };
  }
}

async function resolveRoomId(roomIdOrSlug: unknown): Promise<number | null> {
  if (roomIdOrSlug === undefined || roomIdOrSlug === null) {
    return null;
  }

  if (typeof roomIdOrSlug === "number" && Number.isInteger(roomIdOrSlug)) {
    const room = await PrismaClient.room.findUnique({
      where: { id: roomIdOrSlug },
      select: { id: true },
    });
    return room?.id ?? null;
  }

  if (typeof roomIdOrSlug === "string") {
    const trimmedValue = roomIdOrSlug.trim();
    if (!trimmedValue) {
      return null;
    }

    const numericRoomId = Number(trimmedValue);
    if (Number.isInteger(numericRoomId)) {
      const roomById = await PrismaClient.room.findUnique({
        where: { id: numericRoomId },
        select: { id: true },
      });
      if (roomById) {
        return roomById.id;
      }
    }

    // Fallback: check by slug
    const roomBySlug = await PrismaClient.room.findUnique({
      where: { slug: trimmedValue },
      select: { id: true },
    });
    return roomBySlug?.id ?? null;
  }

  return null;
}

function sendWsError(ws: WebSocket, message: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "error",
        message,
      }),
    );
  }
}

function checkUser(token: string): string | null {
  try {
    const decode = jwt.verify(token, JWT_SECRET);

    if (typeof decode == "string") {
      return null;
    }
    if (!decode || !decode.userId) {
      return null;
    }
    return decode.userId;
  } catch (e) {
    return null;
  }
}

/** Check if a user has permission to draw in a room */
async function canUserDraw(roomId: number, userId: string): Promise<{ canDraw: boolean; reason?: string }> {
  try {
    const room = await PrismaClient.room.findUnique({
      where: { id: roomId },
      select: { adminId: true, isLocked: true },
    });
    if (!room) return { canDraw: false, reason: "Room not found" };
    if (room.adminId === userId) return { canDraw: true };

    if (room.isLocked) return { canDraw: false, reason: "Canvas is locked by admin." };

    const member = await PrismaClient.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId } },
      select: { role: true },
    });
    if (member?.role === "viewer") {
      return { canDraw: false, reason: "You are in viewer mode." };
    }

    return { canDraw: true };
  } catch (_e) {
    return { canDraw: true };
  }
}

/** Broadcast current presence list for a room to all members in that room */
function broadcastPresence(roomIdStr: string) {
  const presence = roomPresence.get(roomIdStr);
  if (!presence) return;
  const members = Array.from(presence.values());
  const msg = JSON.stringify({ type: "presence_update", roomId: roomIdStr, members });
  users.forEach((u) => {
    if (u.rooms.includes(roomIdStr) && u.ws.readyState === WebSocket.OPEN) {
      u.ws.send(msg);
    }
  });
}

function startServer(port: number) {
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`ws-backend listening on port ${port}`);
  });

  httpServer.once("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      const nextPort = port < FALLBACK_PORT ? FALLBACK_PORT : port + 1;
      console.warn(`ws-backend port ${port} in use, trying next port ${nextPort}`);
      startServer(nextPort);
      return;
    }

    throw error;
  });
}

startServer(configuredPort);

wss.on("connection", async function connection(ws, request) {
  console.log("NEW WS CONNECTION");
  const url = request.url;
  console.log("URL:", url);
  if (!url) {
    return;
  }
  const queryParams = new URLSearchParams(url.split("?")[1]);
  const token = queryParams.get("token") || "";
  console.log("TOKEN:", token);
  let userId = checkUser(token);
  console.log("USER ID:", userId);

  if (!userId) {
    ws.close(1008, "Unauthorized: invalid or missing token.");
    return;
  }

  // Fetch user name for presence
  let userName = "User";
  try {
    const dbUser = await PrismaClient.user.findUnique({ where: { id: userId }, select: { name: true } });
    if (dbUser?.name) userName = dbUser.name;
  } catch (_e) {
    // ignore – fallback to "User"
  }

  (ws as any).isAlive = true;
  ws.on("pong", () => {
    (ws as any).isAlive = true;
  });
  users.push({
    userId,
    name: userName,
    rooms: [],
    ws,
  });

  ws.on("message", async function message(data) {
    try {
      let parsedData: any;
      if (typeof data !== "string") {
        parsedData = JSON.parse(data.toString());
      } else {
        parsedData = JSON.parse(data);
      }
      if (!parsedData) return;

      // ── join_room ──────────────────────────────────────────────────────────────
      if (parsedData.type === "join_room") {
        const resolvedRoomId = await resolveRoomId(parsedData.roomId);
        if (!resolvedRoomId) {
          sendWsError(ws, "Room not found");
          return;
        }

        const user = users.find((x) => x.ws === ws);
        if (user) {
          const roomIdStr = String(resolvedRoomId);
          if (!user.rooms.includes(roomIdStr)) {
            user.rooms.push(roomIdStr);
          }
          // Add to presence map
          if (!roomPresence.has(roomIdStr)) {
            roomPresence.set(roomIdStr, new Map());
          }
          roomPresence.get(roomIdStr)!.set(userId!, { userId: userId!, name: user.name });
          broadcastPresence(roomIdStr);
        }
        return;
      }

      // ── leave_room ─────────────────────────────────────────────────────────────
      if (parsedData.type === "leave_room") {
        const user = users.find((x) => x.ws === ws);
        if (!user) return;
        const resolvedRoomId = await resolveRoomId(parsedData.roomId);
        if (!resolvedRoomId) return;
        const roomIdStr = String(resolvedRoomId);
        user.rooms = user.rooms.filter((x) => x !== roomIdStr);
        // Remove from presence
        roomPresence.get(roomIdStr)?.delete(userId!);
        broadcastPresence(roomIdStr);
        return;
      }

      // ── cursor ─────────────────────────────────────────────────────────────────
      if (parsedData.type === "cursor") {
        const senderRoomId = String(parsedData.roomId ?? "");
        if (senderRoomId) {
          const sender = users.find((x) => x.ws === ws);
          users.forEach((user) => {
            if (
              user.ws !== ws &&
              user.rooms.includes(senderRoomId) &&
              user.ws.readyState === WebSocket.OPEN
            ) {
              user.ws.send(
                JSON.stringify({
                  type: "cursor",
                  userId: sender?.userId ?? parsedData.userId,
                  name: parsedData.name,
                  x: parsedData.x,
                  y: parsedData.y,
                  roomId: senderRoomId,
                }),
              );
            }
          });
        }
        return;
      }

      // ── chat (new shape drawn) ─────────────────────────────────────────────────
      if (parsedData.type === "chat") {
        const roomId = await resolveRoomId(parsedData.roomId);
        const message = parsedData.message;
        if (!roomId) {
          console.error("Invalid roomId:", parsedData.roomId);
          sendWsError(ws, "Invalid room id");
          return;
        }

        // Check if user has draw permissions
        const check = await canUserDraw(roomId, userId!);
        if (!check.canDraw) {
          sendWsError(ws, check.reason || "You do not have permission to draw.");
          return;
        }

        // Parse shape from message
        let parsedShape: any;
        try {
          if (typeof message === "string") {
            const parsed = JSON.parse(message);
            parsedShape = parsed.shape ?? parsed;
          } else if (message && typeof message === "object") {
            parsedShape = (message as any).shape ?? message;
          }
        } catch (err) {
          console.error("Failed to parse shape message:", err);
          sendWsError(ws, "Invalid shape payload");
          return;
        }

        const { type, style, ...data } = parsedShape || {};
        if (!type) {
          sendWsError(ws, "Invalid shape type");
          return;
        }

        // Persist to DB
        await PrismaClient.shape.create({
          data: {
            roomId,
            userId: userId!,
            type,
            data: data || {},
            style: style || {},
          },
        });

        // Broadcast to all OTHER users in this room
        users.forEach((user) => {
          if (user.ws === ws) return;
          if (user.rooms.includes(String(roomId)) && user.ws.readyState === WebSocket.OPEN) {
            user.ws.send(
              JSON.stringify({
                type: "chat",
                message: message,
                roomId,
              }),
            );
          }
        });
        return;
      }

      // ── move_shape ─────────────────────────────────────────────────────────────
      if (parsedData.type === "move_shape") {
        const roomId = await resolveRoomId(parsedData.roomId);
        if (!roomId) return;

        // Reject move if user cannot draw
        const check = await canUserDraw(roomId, userId!);
        if (!check.canDraw) {
          sendWsError(ws, check.reason || "Canvas is locked / view-only.");
          return;
        }

        const shape = parsedData.shape;
        const shapeIndex = parsedData.shapeIndex;
        const shapeKey = getShapeKey(shape, shapeIndex);
        const incomingTimestamp = getShapeTimestamp(shape, parsedData.timestamp);

        // OT / LWW Conflict Resolution check
        const { accepted } = checkAndUpdateLWW(roomId, shapeKey, incomingTimestamp);

        if (!accepted) {
          console.log(`[OT/LWW] Conflict on shape ${shapeKey} in room ${roomId}. Rejecting stale move.`);
          const currentShapes = await PrismaClient.shape.findMany({
            where: { roomId },
            orderBy: { id: "asc" },
          });
          const formattedShapes = currentShapes.map((s) => ({
            id: s.id,
            type: s.type,
            style: s.style,
            updatedAt: s.updatedAt ? new Date(s.updatedAt).getTime() : Date.now(),
            ...(s.data as any),
          }));
          ws.send(
            JSON.stringify({
              type: "sync_shapes",
              shapes: formattedShapes,
              roomId,
            })
          );
          return;
        }

        // Persist updated shape list to DB
        if (Array.isArray(parsedData.shapes)) {
          try {
            await PrismaClient.$transaction([
              PrismaClient.shape.deleteMany({ where: { roomId } }),
              PrismaClient.shape.createMany({
                data: parsedData.shapes.map((s: any) => {
                  const { type, style, ...data } = s || {};
                  return {
                    roomId,
                    userId: userId!,
                    type: type || "unknown",
                    data: data || {},
                    style: style || {},
                  };
                }),
              }),
            ]);
          } catch (err) {
            console.error("Failed to sync shapes in DB:", err);
          }
        }

        // Broadcast accepted move to other users in room
        users.forEach((user) => {
          if (
            user.ws !== ws &&
            user.rooms.includes(String(roomId)) &&
            user.ws.readyState === WebSocket.OPEN
          ) {
            user.ws.send(
              JSON.stringify({
                ...parsedData,
                shape: shape ? { ...shape, updatedAt: incomingTimestamp } : shape,
                timestamp: incomingTimestamp,
                roomId,
              })
            );
          }
        });
        return;
      }

      // ── delete_shape / undo / redo ─────────────────────────────────────────────
      if (
        parsedData.type === "delete_shape" ||
        parsedData.type === "undo" ||
        parsedData.type === "redo"
      ) {
        const roomId = await resolveRoomId(parsedData.roomId);
        if (!roomId) return;

        // Persist the full shape list to the database if provided
        if (Array.isArray(parsedData.shapes)) {
          try {
            await PrismaClient.$transaction([
              PrismaClient.shape.deleteMany({ where: { roomId } }),
              PrismaClient.shape.createMany({
                data: parsedData.shapes.map((shape: any) => {
                  const { type, style, ...data } = shape || {};
                  return {
                    roomId,
                    userId: userId!,
                    type: type || "unknown",
                    data: data || {},
                    style: style || {},
                  };
                }),
              }),
            ]);
          } catch (err) {
            console.error("Failed to sync shapes in DB:", err);
          }
        }

        users.forEach((user) => {
          if (
            user.ws !== ws &&
            user.rooms.includes(String(roomId)) &&
            user.ws.readyState === WebSocket.OPEN
          ) {
            user.ws.send(JSON.stringify({ ...parsedData, roomId }));
          }
        });
        return;
      }

      // ── kick_user (admin) ──────────────────────────────────────────────────────
      if (parsedData.type === "kick_user") {
        const roomId = await resolveRoomId(parsedData.roomId);
        if (!roomId) return;

        let isAdmin = false;
        try {
          const room = await PrismaClient.room.findUnique({ where: { id: roomId }, select: { adminId: true } });
          isAdmin = room?.adminId === userId;
        } catch (_e) {}

        if (!isAdmin) {
          sendWsError(ws, "Only admin can kick users");
          return;
        }

        const targetUserId: string = parsedData.targetUserId;
        const targetUser = users.find((u) => u.userId === targetUserId && u.rooms.includes(String(roomId)));
        if (targetUser && targetUser.ws.readyState === WebSocket.OPEN) {
          targetUser.ws.send(JSON.stringify({ type: "kicked", roomId }));
        }
        // Remove from presence
        roomPresence.get(String(roomId))?.delete(targetUserId);
        broadcastPresence(String(roomId));
        return;
      }

      // ── lock_room (admin) ──────────────────────────────────────────────────────
      if (parsedData.type === "lock_room") {
        const roomId = await resolveRoomId(parsedData.roomId);
        if (!roomId) return;

        let isAdmin = false;
        let currentLockState = false;
        try {
          const room = await PrismaClient.room.findUnique({
            where: { id: roomId },
            select: { adminId: true, isLocked: true },
          });
          isAdmin = room?.adminId === userId;
          currentLockState = room?.isLocked ?? false;
        } catch (_e) {}

        if (!isAdmin) {
          sendWsError(ws, "Only admin can lock/unlock room");
          return;
        }

        const newLockState = parsedData.isLocked !== undefined ? parsedData.isLocked : !currentLockState;

        try {
          await PrismaClient.room.update({ where: { id: roomId }, data: { isLocked: newLockState } });
        } catch (_e) {
          sendWsError(ws, "Failed to update room lock state");
          return;
        }

        const lockMsg = JSON.stringify({ type: newLockState ? "room_locked" : "room_unlocked", roomId });
        users.forEach((u) => {
          if (u.rooms.includes(String(roomId)) && u.ws.readyState === WebSocket.OPEN) {
            u.ws.send(lockMsg);
          }
        });
        return;
      }

      // ── set_draw_permission (admin) ────────────────────────────────────────────
      if (parsedData.type === "set_draw_permission") {
        const roomId = await resolveRoomId(parsedData.roomId);
        if (!roomId) return;

        let isAdmin = false;
        try {
          const room = await PrismaClient.room.findUnique({ where: { id: roomId }, select: { adminId: true } });
          isAdmin = room?.adminId === userId;
        } catch (_e) {}

        if (!isAdmin) {
          sendWsError(ws, "Only admin can set draw permissions");
          return;
        }

        const targetUserId: string = parsedData.targetUserId;
        const role: string = parsedData.role; // "editor" | "viewer"

        try {
          await PrismaClient.roomMember.upsert({
            where: { userId_roomId: { userId: targetUserId, roomId } },
            update: { role },
            create: { userId: targetUserId, roomId, role },
          });
        } catch (_e) {
          sendWsError(ws, "Failed to update member role");
          return;
        }

        // Notify target user
        const targetUser = users.find((u) => u.userId === targetUserId && u.rooms.includes(String(roomId)));
        if (targetUser && targetUser.ws.readyState === WebSocket.OPEN) {
          targetUser.ws.send(JSON.stringify({ type: "permission_update", role, roomId }));
        }

        // Broadcast updated presence to all room members
        broadcastPresence(String(roomId));
        return;
      }

    } catch (e) {
      console.error("Failed to process WebSocket message:", e);
    }
  });

  ws.on("close", () => {
    const user = users.find((x) => x.ws === ws);
    if (user) {
      // Remove from all room presences on disconnect
      user.rooms.forEach((roomIdStr) => {
        roomPresence.get(roomIdStr)?.delete(userId!);
        broadcastPresence(roomIdStr);
      });
    }
    const index = users.findIndex((x) => x.ws === ws);
    if (index !== -1) {
      users.splice(index, 1);
    }
    console.log("WS CONNECTION CLOSED, REMOVED USER");
  });
});

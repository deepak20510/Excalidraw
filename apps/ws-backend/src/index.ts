import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { PrismaClient } from "@repo/db/client";

const DEFAULT_PORT = 8082;
const FALLBACK_PORT = 8083;
const configuredPort = Number(process.env.WS_PORT ?? process.env.PORT ?? DEFAULT_PORT);

// Structured Health & Uptime endpoint
const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        uptimeSeconds: Math.floor(process.uptime()),
        activeConnections: wss.clients.size,
        activeRooms: roomUsersMap.size,
        memoryMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        timestamp: new Date().toISOString(),
      })
    );
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
// Fast O(1) set lookup for broadcasting per room
const roomUsersMap = new Map<string, Set<User>>();

// In-memory presence: roomId -> Map<userId, { name, userId }>
const roomPresence = new Map<string, Map<string, { userId: string; name: string }>>();

// Operational Transform / Conflict Resolution (Last-Write-Wins with timestamps)
const roomShapeTimestamps = new Map<number, Map<string | number, number>>();

// In-memory caches for high-throughput zero-latency operations
const roomIdCache = new Map<string | number, { id: number; timestamp: number }>();
const roomInfoCache = new Map<
  number,
  { adminId: string; isLocked: boolean; roles: Map<string, string>; fetchedAt: number }
>();
const userNameCache = new Map<string, string>();

// Periodic in-memory cache eviction for idle rooms (every 10 minutes)
const cacheCleanupInterval = setInterval(() => {
  const now = Date.now();
  // Evict room info cache older than 10 minutes or for inactive rooms
  roomInfoCache.forEach((info, roomId) => {
    const hasActiveUsers = (roomUsersMap.get(String(roomId))?.size ?? 0) > 0;
    if (!hasActiveUsers && now - info.fetchedAt > 600000) {
      roomInfoCache.delete(roomId);
    }
  });

  // Evict LWW shape timestamps for rooms with no active users
  roomShapeTimestamps.forEach((_map, roomId) => {
    const hasActiveUsers = (roomUsersMap.get(String(roomId))?.size ?? 0) > 0;
    if (!hasActiveUsers) {
      roomShapeTimestamps.delete(roomId);
    }
  });

  // Evict roomIdCache entries older than 10 minutes
  roomIdCache.forEach((entry, key) => {
    if (now - entry.timestamp > 600000) {
      roomIdCache.delete(key);
    }
  });
}, 600000);

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
  if (roomIdOrSlug === undefined || roomIdOrSlug === null) return null;
  const key = String(roomIdOrSlug).trim();
  if (!key) return null;

  const cached = roomIdCache.get(key);
  if (cached && Date.now() - cached.timestamp < 300000) {
    return cached.id;
  }

  const numericRoomId = Number(key);
  if (Number.isInteger(numericRoomId) && numericRoomId > 0) {
    try {
      const roomById = await PrismaClient.room.findUnique({
        where: { id: numericRoomId },
        select: { id: true },
      });
      if (roomById) {
        roomIdCache.set(key, { id: roomById.id, timestamp: Date.now() });
        roomIdCache.set(roomById.id, { id: roomById.id, timestamp: Date.now() });
        return roomById.id;
      }
    } catch (_e) {}
  }

  try {
    const roomBySlug = await PrismaClient.room.findUnique({
      where: { slug: key },
      select: { id: true },
    });
    if (roomBySlug) {
      roomIdCache.set(key, { id: roomBySlug.id, timestamp: Date.now() });
      return roomBySlug.id;
    }
  } catch (_e) {}

  return null;
}

async function getRoomInfo(
  roomId: number
): Promise<{ adminId: string; isLocked: boolean; roles: Map<string, string>; fetchedAt: number } | null> {
  const cached = roomInfoCache.get(roomId);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < 30000) {
    return cached;
  }
  try {
    const room = await PrismaClient.room.findUnique({
      where: { id: roomId },
      select: { adminId: true, isLocked: true },
    });
    if (!room) return null;

    const members = await PrismaClient.roomMember.findMany({
      where: { roomId },
      select: { userId: true, role: true },
    });
    const rolesMap = new Map<string, string>();
    members.forEach((m) => rolesMap.set(m.userId, m.role));
    const info = { adminId: room.adminId, isLocked: room.isLocked, roles: rolesMap, fetchedAt: now };
    roomInfoCache.set(roomId, info);
    return info;
  } catch (_e) {
    return cached ?? null;
  }
}

/** Check if a user has permission to draw in a room using fast in-memory checks */
async function canUserDraw(roomId: number, userId: string): Promise<{ canDraw: boolean; reason?: string }> {
  const info = await getRoomInfo(roomId);
  if (!info) return { canDraw: false, reason: "Room not found" };
  if (info.adminId === userId) return { canDraw: true };
  if (info.isLocked) return { canDraw: false, reason: "Canvas is locked by admin." };

  const role = info.roles.get(userId);
  if (role === "viewer") {
    return { canDraw: false, reason: "You are in viewer mode." };
  }

  return { canDraw: true };
}

function sendWsError(ws: WebSocket, message: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "error",
        message,
      })
    );
  }
}

function checkUser(token: string): string | null {
  try {
    const decode = jwt.verify(token, JWT_SECRET);
    if (typeof decode === "string" || !decode || !decode.userId) {
      return null;
    }
    return decode.userId;
  } catch (e) {
    return null;
  }
}

/** Broadcast current presence list for a room to all members in that room */
function broadcastPresence(roomIdStr: string) {
  const presence = roomPresence.get(roomIdStr);
  if (!presence) return;
  const members = Array.from(presence.values());
  const msg = JSON.stringify({ type: "presence_update", roomId: roomIdStr, members });
  const roomUsers = roomUsersMap.get(roomIdStr);
  if (roomUsers) {
    roomUsers.forEach((u) => {
      if (u.ws.readyState === WebSocket.OPEN) {
        u.ws.send(msg);
      }
    });
  }
}

// ── Smart Non-Destructive Background DB Sync for Shapes ──────────────────────
// Instead of wiping the entire shape table, we perform surgical diff updates.
const dbSyncDebounceTimers = new Map<number, NodeJS.Timeout>();

function queueSmartShapeSync(roomId: number, userId: string, shapes: any[]) {
  if (dbSyncDebounceTimers.has(roomId)) {
    clearTimeout(dbSyncDebounceTimers.get(roomId)!);
  }
  const timer = setTimeout(async () => {
    dbSyncDebounceTimers.delete(roomId);
    try {
      const existingInDb = await PrismaClient.shape.findMany({
        where: { roomId },
        select: { id: true },
      });

      const incomingIds = new Set<number>(
        shapes
          .map((s: any) => Number(s.id))
          .filter((id) => Number.isInteger(id) && id > 0)
      );

      // 1. Delete only shapes that are present in DB but missing from the current active canvas state
      const toDeleteIds = existingInDb
        .map((row) => row.id)
        .filter((id) => !incomingIds.has(id));

      if (toDeleteIds.length > 0) {
        await PrismaClient.shape.deleteMany({
          where: { id: { in: toDeleteIds }, roomId },
        });
      }

      // 2. Insert only truly new shapes that do not have a DB id yet
      const shapesToCreate = shapes.filter((s: any) => !s.id || !incomingIds.has(Number(s.id)));
      if (shapesToCreate.length > 0) {
        await PrismaClient.shape.createMany({
          data: shapesToCreate.map((s: any) => {
            const { type, style, ...data } = s || {};
            const clientUpdatedAt =
              s && typeof s.updatedAt === "number" && !isNaN(s.updatedAt)
                ? new Date(s.updatedAt)
                : new Date();
            return {
              roomId,
              userId,
              type: type || "unknown",
              data: data || {},
              style: style || {},
              updatedAt: clientUpdatedAt,
            };
          }),
        });
      }
    } catch (err) {
      console.error("Smart shape sync error:", err);
    }
  }, 350);
  dbSyncDebounceTimers.set(roomId, timer);
}

function startServer(port: number) {
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`✓ ws-backend listening on ws://0.0.0.0:${port}`);
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
  const url = request.url;
  if (!url) return;

  const queryParams = new URLSearchParams(url.split("?")[1]);
  const token = queryParams.get("token") || "";
  let userId = checkUser(token);

  if (!userId) {
    ws.close(1008, "Unauthorized: invalid or missing token.");
    return;
  }

  // Fast user name resolution
  let userName = userNameCache.get(userId) || "User";
  if (!userNameCache.has(userId)) {
    try {
      const dbUser = await PrismaClient.user.findUnique({ where: { id: userId }, select: { name: true } });
      if (dbUser?.name) {
        userName = dbUser.name;
        userNameCache.set(userId, userName);
      }
    } catch (_e) {}
  }

  (ws as any).isAlive = true;
  ws.on("pong", () => {
    (ws as any).isAlive = true;
  });

  const userObj: User = {
    userId,
    name: userName,
    rooms: [],
    ws,
  };
  users.push(userObj);

  // Per-client message rate limiting (max 150 msgs/second)
  let messageCount = 0;
  let windowStart = Date.now();

  ws.on("message", async function message(data) {
    const now = Date.now();
    if (now - windowStart > 1000) {
      messageCount = 0;
      windowStart = now;
    }
    messageCount++;
    if (messageCount > 150) {
      // Throttle abusive traffic
      return;
    }

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

        const roomIdStr = String(resolvedRoomId);
        if (!userObj.rooms.includes(roomIdStr)) {
          userObj.rooms.push(roomIdStr);
        }

        if (!roomUsersMap.has(roomIdStr)) {
          roomUsersMap.set(roomIdStr, new Set());
        }
        roomUsersMap.get(roomIdStr)!.add(userObj);

        if (!roomPresence.has(roomIdStr)) {
          roomPresence.set(roomIdStr, new Map());
        }
        roomPresence.get(roomIdStr)!.set(userId!, { userId: userId!, name: userObj.name });
        broadcastPresence(roomIdStr);
        return;
      }

      // ── leave_room ─────────────────────────────────────────────────────────────
      if (parsedData.type === "leave_room") {
        const resolvedRoomId = await resolveRoomId(parsedData.roomId);
        if (!resolvedRoomId) return;
        const roomIdStr = String(resolvedRoomId);
        userObj.rooms = userObj.rooms.filter((x) => x !== roomIdStr);
        roomUsersMap.get(roomIdStr)?.delete(userObj);
        roomPresence.get(roomIdStr)?.delete(userId!);
        broadcastPresence(roomIdStr);
        return;
      }

      // ── cursor (60 FPS low-latency broadcast) ───────────────────────────────────
      if (parsedData.type === "cursor") {
        const senderRoomId = String(parsedData.roomId ?? "");
        if (senderRoomId) {
          const roomUsers = roomUsersMap.get(senderRoomId);
          if (roomUsers && roomUsers.size > 0) {
            const cursorPayload = JSON.stringify({
              type: "cursor",
              userId: userObj.userId,
              name: parsedData.name || userObj.name,
              x: parsedData.x,
              y: parsedData.y,
              roomId: senderRoomId,
            });
            roomUsers.forEach((u) => {
              if (u.ws !== ws && u.ws.readyState === WebSocket.OPEN) {
                u.ws.send(cursorPayload);
              }
            });
          }
        }
        return;
      }

      // ── chat (new shape drawn) ─────────────────────────────────────────────────
      if (parsedData.type === "chat") {
        const roomId = await resolveRoomId(parsedData.roomId);
        const messagePayload = parsedData.message;
        if (!roomId) {
          sendWsError(ws, "Invalid room id");
          return;
        }

        const check = await canUserDraw(roomId, userId!);
        if (!check.canDraw) {
          sendWsError(ws, check.reason || "You do not have permission to draw.");
          return;
        }

        let parsedShape: any;
        try {
          if (typeof messagePayload === "string") {
            const parsed = JSON.parse(messagePayload);
            parsedShape = parsed.shape ?? parsed;
          } else if (messagePayload && typeof messagePayload === "object") {
            parsedShape = (messagePayload as any).shape ?? messagePayload;
          }
        } catch (err) {
          sendWsError(ws, "Invalid shape payload");
          return;
        }

        const { type, style, ...data } = parsedShape || {};
        if (!type) {
          sendWsError(ws, "Invalid shape type");
          return;
        }

        // Fast asynchronous single-row DB save (does not block or lock table)
        PrismaClient.shape
          .create({
            data: {
              roomId,
              userId: userId!,
              type,
              data: data || {},
              style: style || {},
            },
          })
          .then((savedShape) => {
            // Echo assigned id back to the creator so client can track future edits/moves
            if (ws.readyState === WebSocket.OPEN && savedShape.id) {
              ws.send(
                JSON.stringify({
                  type: "shape_persisted",
                  tempSeed: parsedShape.seed,
                  id: savedShape.id,
                  roomId,
                })
              );
            }
          })
          .catch((err) => console.error("Shape create error:", err));

        // Fast broadcast to room users
        const roomUsers = roomUsersMap.get(String(roomId));
        if (roomUsers) {
          const chatMsg = JSON.stringify({
            type: "chat",
            message: messagePayload,
            roomId,
          });
          roomUsers.forEach((u) => {
            if (u.ws !== ws && u.ws.readyState === WebSocket.OPEN) {
              u.ws.send(chatMsg);
            }
          });
        }
        return;
      }

      // ── move_shape ─────────────────────────────────────────────────────────────
      if (parsedData.type === "move_shape") {
        const roomId = await resolveRoomId(parsedData.roomId);
        if (!roomId) return;

        const check = await canUserDraw(roomId, userId!);
        if (!check.canDraw) {
          sendWsError(ws, check.reason || "Canvas is locked / view-only.");
          return;
        }

        const shape = parsedData.shape;
        const shapeIndex = parsedData.shapeIndex;
        const shapeKey = getShapeKey(shape, shapeIndex);
        const incomingTimestamp = getShapeTimestamp(shape, parsedData.timestamp);

        const { accepted } = checkAndUpdateLWW(roomId, shapeKey, incomingTimestamp);

        if (!accepted) {
          // Conflict detected: sync latest shapes from DB
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

        // Surgical single-shape DB update if shape ID exists (99.9% faster than wipe)
        if (shape && shape.id) {
          const { type, style, id, ...shapeData } = shape;
          PrismaClient.shape
            .updateMany({
              where: { id: Number(id), roomId },
              data: {
                data: shapeData || {},
                style: style || {},
                updatedAt: new Date(incomingTimestamp),
              },
            })
            .catch((err) => console.error("Shape update error:", err));
        } else if (Array.isArray(parsedData.shapes)) {
          // Fallback to debounced smart sync
          queueSmartShapeSync(roomId, userId!, parsedData.shapes);
        }

        // Fast pre-serialized broadcast to peers
        const roomUsers = roomUsersMap.get(String(roomId));
        if (roomUsers) {
          const moveMsg = JSON.stringify({
            ...parsedData,
            shape: shape ? { ...shape, updatedAt: incomingTimestamp } : shape,
            timestamp: incomingTimestamp,
            roomId,
          });
          roomUsers.forEach((u) => {
            if (u.ws !== ws && u.ws.readyState === WebSocket.OPEN) {
              u.ws.send(moveMsg);
            }
          });
        }
        return;
      }

      // ── delete_shape ───────────────────────────────────────────────────────────
      if (parsedData.type === "delete_shape") {
        const roomId = await resolveRoomId(parsedData.roomId);
        if (!roomId) return;

        const check = await canUserDraw(roomId, userId!);
        if (!check.canDraw) {
          sendWsError(ws, check.reason || "Canvas is locked / view-only.");
          return;
        }

        // Surgical single delete if ID is provided
        if (parsedData.shapeId) {
          PrismaClient.shape
            .deleteMany({
              where: { id: Number(parsedData.shapeId), roomId },
            })
            .catch((err) => console.error("Single delete error:", err));
        } else if (Array.isArray(parsedData.shapes)) {
          queueSmartShapeSync(roomId, userId!, parsedData.shapes);
        }

        const roomUsers = roomUsersMap.get(String(roomId));
        if (roomUsers) {
          const syncMsg = JSON.stringify({ ...parsedData, roomId });
          roomUsers.forEach((u) => {
            if (u.ws !== ws && u.ws.readyState === WebSocket.OPEN) {
              u.ws.send(syncMsg);
            }
          });
        }
        return;
      }

      // ── undo / redo / sync_shapes ──────────────────────────────────────────────
      if (
        parsedData.type === "undo" ||
        parsedData.type === "redo" ||
        parsedData.type === "sync_shapes"
      ) {
        const roomId = await resolveRoomId(parsedData.roomId);
        if (!roomId) return;

        const check = await canUserDraw(roomId, userId!);
        if (!check.canDraw) {
          sendWsError(ws, check.reason || "Canvas is locked / view-only.");
          return;
        }

        if (Array.isArray(parsedData.shapes)) {
          queueSmartShapeSync(roomId, userId!, parsedData.shapes);
        }

        const roomUsers = roomUsersMap.get(String(roomId));
        if (roomUsers) {
          const syncMsg = JSON.stringify({ ...parsedData, roomId });
          roomUsers.forEach((u) => {
            if (u.ws !== ws && u.ws.readyState === WebSocket.OPEN) {
              u.ws.send(syncMsg);
            }
          });
        }
        return;
      }

      // ── kick_user (admin) ──────────────────────────────────────────────────────
      if (parsedData.type === "kick_user") {
        const roomId = await resolveRoomId(parsedData.roomId);
        if (!roomId) return;

        const info = await getRoomInfo(roomId);
        if (info?.adminId !== userId) {
          sendWsError(ws, "Only admin can kick users");
          return;
        }

        const targetUserId: string = parsedData.targetUserId;
        const roomUsers = roomUsersMap.get(String(roomId));
        if (roomUsers) {
          const kickMsg = JSON.stringify({ type: "kicked", roomId });
          roomUsers.forEach((u) => {
            if (u.userId === targetUserId && u.ws.readyState === WebSocket.OPEN) {
              u.ws.send(kickMsg);
            }
          });
        }
        roomPresence.get(String(roomId))?.delete(targetUserId);
        broadcastPresence(String(roomId));
        return;
      }

      // ── lock_room (admin) ──────────────────────────────────────────────────────
      if (parsedData.type === "lock_room") {
        const roomId = await resolveRoomId(parsedData.roomId);
        if (!roomId) return;

        const info = await getRoomInfo(roomId);
        if (info?.adminId !== userId) {
          sendWsError(ws, "Only admin can lock/unlock room");
          return;
        }

        const newLockState = parsedData.isLocked !== undefined ? parsedData.isLocked : !info.isLocked;

        try {
          await PrismaClient.room.update({ where: { id: roomId }, data: { isLocked: newLockState } });
          if (info) {
            info.isLocked = newLockState;
            info.fetchedAt = Date.now();
          }
        } catch (_e) {
          sendWsError(ws, "Failed to update room lock state");
          return;
        }

        const lockMsg = JSON.stringify({ type: newLockState ? "room_locked" : "room_unlocked", roomId });
        const roomUsers = roomUsersMap.get(String(roomId));
        if (roomUsers) {
          roomUsers.forEach((u) => {
            if (u.ws.readyState === WebSocket.OPEN) {
              u.ws.send(lockMsg);
            }
          });
        }
        return;
      }

      // ── set_draw_permission / set_role (admin) ─────────────────────────────────
      if (parsedData.type === "set_draw_permission" || parsedData.type === "set_role") {
        const roomId = await resolveRoomId(parsedData.roomId);
        if (!roomId) return;

        const info = await getRoomInfo(roomId);
        if (info?.adminId !== userId) {
          sendWsError(ws, "Only admin can update draw permissions and roles");
          return;
        }

        const targetUserId: string = parsedData.targetUserId || parsedData.userId;
        const role: string = parsedData.role;
        if (!targetUserId || !role) return;

        try {
          await PrismaClient.roomMember.upsert({
            where: { userId_roomId: { userId: targetUserId, roomId } },
            update: { role },
            create: { userId: targetUserId, roomId, role },
          });
          if (info) {
            info.roles.set(targetUserId, role);
            info.fetchedAt = Date.now();
          }
        } catch (_e) {
          sendWsError(ws, "Failed to update member role");
          return;
        }

        const roomUsers = roomUsersMap.get(String(roomId));
        if (roomUsers) {
          const permMsg = JSON.stringify({ type: "permission_update", role, roomId });
          roomUsers.forEach((u) => {
            if (u.userId === targetUserId && u.ws.readyState === WebSocket.OPEN) {
              u.ws.send(permMsg);
            }
          });
        }

        broadcastPresence(String(roomId));
        return;
      }
    } catch (e) {
      console.error("Failed to process WebSocket message:", e);
    }
  });

  ws.on("close", () => {
    userObj.rooms.forEach((roomIdStr) => {
      roomUsersMap.get(roomIdStr)?.delete(userObj);
      roomPresence.get(roomIdStr)?.delete(userId!);
      broadcastPresence(roomIdStr);
    });
    const index = users.findIndex((x) => x.ws === ws);
    if (index !== -1) {
      users.splice(index, 1);
    }
  });
});

// Optional Keep-Alive Ping for free-tier deployments (e.g. Render/Koyeb)
const wsKeepAliveUrl = process.env.KEEP_ALIVE_URL;
let wsKeepAliveTimer: NodeJS.Timeout | null = null;
if (wsKeepAliveUrl) {
  console.log(`ws-backend keep-alive monitor initialized for ${wsKeepAliveUrl}`);
  wsKeepAliveTimer = setInterval(() => {
    fetch(`${wsKeepAliveUrl}/health`)
      .then((r) => r.json())
      .catch((err) => console.warn("ws-backend keep-alive ping error:", err?.message || err));
  }, 10 * 60 * 1000);
}

function handleWsShutdown(signal: string) {
  console.log(`Received ${signal}, closing ws-backend...`);
  if (wsKeepAliveTimer) clearInterval(wsKeepAliveTimer);
  clearInterval(heartbeatInterval);
  clearInterval(cacheCleanupInterval);
  wss.close(() => {
    httpServer.close(() => {
      console.log("ws-backend closed gracefully.");
      process.exit(0);
    });
  });
}

process.on("SIGINT", () => handleWsShutdown("SIGINT"));
process.on("SIGTERM", () => handleWsShutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection in ws-backend:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception in ws-backend:", error);
});

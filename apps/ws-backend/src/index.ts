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
}
const users: User[] = [];

async function resolveRoomId(roomIdOrSlug: unknown) {
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
      const room = await PrismaClient.room.findUnique({
        where: { id: numericRoomId },
        select: { id: true },
      });
      if (room) {
        return room.id;
      }
    }

    const room = await PrismaClient.room.findUnique({
      where: { slug: trimmedValue },
      select: { id: true },
    });
    return room?.id ?? null;
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
  return null;
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

  (ws as any).isAlive = true;
  ws.on("pong", () => {
    (ws as any).isAlive = true;
  });
  users.push({
    userId,
    rooms: [],
    ws,
  });

  ws.on("message", async function message(data) {
    try {
      let parsedData;
      if (typeof data !== "string") {
        parsedData = JSON.parse(data.toString());
      } else {
        parsedData = JSON.parse(data);
      }
      if (!parsedData) return;

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
        }
      }
      if (parsedData.type === "leave_room") {
        const user = users.find((x) => x.ws === ws);
        if (!user) {
          return;
        }
        const resolvedRoomId = await resolveRoomId(parsedData.roomId);
        if (!resolvedRoomId) {
          return;
        }

        user.rooms = user.rooms.filter((x) => x !== String(resolvedRoomId));
      }
      if (parsedData.type === "chat") {
        const roomId = await resolveRoomId(parsedData.roomId);
        const message = parsedData.message;
        if (!roomId) {
          console.error("Invalid roomId:", parsedData.roomId);
          sendWsError(ws, "Invalid room id");
          return;
        }

        let parsedShape: any;
        try {
          parsedShape = JSON.parse(message).shape;
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

        await PrismaClient.shape.create({
          data: {
            roomId,
            userId,
            type,
            data: data || {},
            style: style || {},
          },
        });
        users.forEach((user) => {
          if (user.ws === ws) {
            return;
          }

          if (user.rooms.includes(String(roomId))) {
            if (user.ws.readyState === WebSocket.OPEN) {
              user.ws.send(
                JSON.stringify({
                  type: "chat",
                  message: message,
                  roomId,
                }),
              );
            }
          }
        });
      }

      // Cursor presence: relay to other room members without any DB I/O
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

      // Relay mutation messages (delete, move, undo, redo)
      // and persist the updated shape list to the database
      if (
        parsedData.type === "delete_shape" ||
        parsedData.type === "move_shape" ||
        parsedData.type === "undo" ||
        parsedData.type === "redo"
      ) {
        const roomId = await resolveRoomId(parsedData.roomId);
        if (!roomId) {
          return;
        }

        // Persist the full shape list to the database if provided
        if (Array.isArray(parsedData.shapes)) {
          try {
            await PrismaClient.$transaction([
              PrismaClient.shape.deleteMany({
                where: { roomId },
              }),
              PrismaClient.shape.createMany({
                data: parsedData.shapes.map((shape: any) => {
                  const { type, style, ...data } = shape || {};
                  return {
                    roomId,
                    userId,
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
      }
    } catch (e) {
      console.error("Failed to process WebSocket message:", e);
    }
  });

  ws.on("close", () => {
    const index = users.findIndex((x) => x.ws === ws);
    if (index !== -1) {
      users.splice(index, 1);
    }
    console.log("WS CONNECTION CLOSED, REMOVED USER");
  });
});

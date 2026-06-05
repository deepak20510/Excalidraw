import { WebSocket, WebSocketServer } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { PrismaClient } from "@repo/db/client";

const DEFAULT_PORT = 8080;
const configuredPort = Number(process.env.WS_PORT ?? DEFAULT_PORT);

interface User {
  ws: WebSocket;
  rooms: string[];
  userId: string;
}

const users: User[] = [];

function attachHandlers(wss: WebSocketServer) {
  wss.on("connection", function connection(ws, request) {
    const url = request.url;
    if (!url) {
      ws.close();
      return;
    }
    
    try {
      const queryParams = new URLSearchParams(url.split("?")[1]);
      const token = queryParams.get("token") || "";
      const decoded = jwt.verify(token, JWT_SECRET);

      if (!decoded || !(decoded as JwtPayload).userId) {
        ws.close();
        return;
      }

      const userId = (decoded as JwtPayload).userId;
      const user: User = {
        ws,
        rooms: [],
        userId,
      };
      users.push(user);

      ws.on("message", async function message(data) {
        let parsedData;
        try {
          parsedData = JSON.parse(data.toString());
        } catch (e) {
          return;
        }

        if (parsedData.type === "join_room") {
          const u = users.find(x => x.ws === ws);
          if (u) {
            const roomIdStr = String(parsedData.roomId);
            if (!u.rooms.includes(roomIdStr)) {
              u.rooms.push(roomIdStr);
            }
          }
        }

        if (parsedData.type === "leave_room") {
          const u = users.find(x => x.ws === ws);
          if (u) {
            const roomIdStr = String(parsedData.roomId);
            u.rooms = u.rooms.filter(x => x !== roomIdStr);
          }
        }

        if (parsedData.type === "chat") {
          const u = users.find(x => x.ws === ws);
          if (!u) return;

          const roomId = Number(parsedData.roomId);
          const messageText = parsedData.message;

          // Save message to database
          try {
            await PrismaClient.chat.create({
              data: {
                roomId,
                message: messageText,
                userId: u.userId,
              },
            });
          } catch (e) {
            console.error("Failed to save chat to database:", e);
          }

          // Broadcast to everyone in the room
          users.forEach(otherUser => {
            if (otherUser.rooms.includes(String(roomId))) {
              otherUser.ws.send(JSON.stringify({
                type: "chat",
                message: messageText,
                roomId,
                userId: u.userId,
              }));
            }
          });
        }
      });

      ws.on("close", () => {
        const index = users.findIndex(x => x.ws === ws);
        if (index !== -1) {
          users.splice(index, 1);
        }
      });

    } catch (e) {
      ws.close();
    }
  });
}

function startServer(port: number) {
  const wss = new WebSocketServer({ port });

  wss.once("listening", () => {
    console.log(`ws-backend listening on ws://localhost:${port}`);
  });

  wss.once("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      startServer(port + 1);
      return;
    }

    throw error;
  });

  attachHandlers(wss);
}

startServer(configuredPort);

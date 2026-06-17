import { WebSocketServer, WebSocket } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { PrismaClient } from "@repo/db/client";

const wss = new WebSocketServer({ port: 8082 });

interface User {
  ws: WebSocket;
  rooms: string[];
  userId: string;
}
const users: User[] = [];

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
    const firstUser = await PrismaClient.user.findFirst();
    if (firstUser) {
      userId = firstUser.id;
      console.log("FALLBACK USER ID:", userId);
    } else {
      console.log("No user found in DB for fallback. Closing WS.");
      ws.close();
      return;
    }
  }
  users.push({
    userId,
    rooms: [],
    ws,
  });

  ws.on("message", async function message(data) {
    let parsedData;
    if (typeof data !== "string") {
      parsedData = JSON.parse(data.toString());
    } else {
      parsedData = JSON.parse(data);
    }
    if (parsedData.type === "join_room") {
      const user = users.find((x) => x.ws === ws);
      if (user) {
        const roomIdStr = String(parsedData.roomId);
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
      user.rooms = user.rooms.filter((x) => x !== String(parsedData.roomId));
    }
    if (parsedData.type === "chat") {
      const roomId = Number(parsedData.roomId);
      const message = parsedData.message;

      await PrismaClient.chat.create({
        data: {
          roomId,
          message,
          userId,
        },
      });
      users.forEach((user) => {
        if (user.rooms.includes(String(roomId))) {
          user.ws.send(
            JSON.stringify({
              type: "chat",
              message: message,
              roomId,
            }),
          );
        }
      });
    }
  });
});

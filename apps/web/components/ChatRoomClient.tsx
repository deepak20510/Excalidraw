"use client";

import { useEffect, useState } from "react";
import { useSocket } from "../hooks/useSocket";

export function ChatRoomClient({
  messages,
  id,
}: {
  messages: { message: string }[];
  id: string;
}) {
  const [chats, setChats] = useState(messages);
  const [currentMessage, setCurrentMessage] = useState("");

  const { socket, loading } = useSocket();

  useEffect(() => {
    if (!socket || loading) return;

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "join_room",
          roomId: id,
        }),
      );
    }

    socket.onmessage = (event) => {
      const parseData = JSON.parse(event.data);

      if (parseData.type === "chat") {
        setChats((c) => [...c, { message: parseData.message }]);
      }
    };
  }, [socket, loading, id]);

  return (
    <div>
      {chats.map((m, index) => (
        <div key={index}>{m.message}</div>
      ))}

      <input
        type="text"
        value={currentMessage}
        onChange={(e) => setCurrentMessage(e.target.value)}
      />

      <button
        onClick={() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                type: "chat",
                roomId: id,
                message: currentMessage,
              }),
            );
          }
        }}
      >
        Send Message
      </button>
    </div>
  );
}

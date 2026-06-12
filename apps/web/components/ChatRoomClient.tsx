// ChatRoomClient component with proper WebSocket handling
"use client";

import { useEffect, useState } from "react";
import { useSocket } from "../hooks/useSocket";

export function ChatRoomClient({
  messages: initialMessages,
  id,
}: {
  messages: { message: string }[];
  id: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [currentMessage, setCurrentMessage] = useState("");
  const { socket, loading } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === "chat") {
        setMessages((prev) => [...prev, { message: data.message }]);
      }
    };

    socket.addEventListener("message", handleMessage);

    const joinRoom = () => {
      socket.send(JSON.stringify({ type: "join_room", roomId: id }));
    };

    if (socket.readyState === WebSocket.OPEN) {
      joinRoom();
    } else {
      socket.addEventListener("open", joinRoom);
    }

    return () => {
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("open", joinRoom);
    };
  }, [socket, id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  const sendMessage = () => {
    if (socket?.readyState === WebSocket.OPEN && currentMessage.trim() !== "") {
      socket.send(
        JSON.stringify({
          type: "chat",
          roomId: id,
          message: currentMessage,
        }),
      );
      setCurrentMessage("");
    }
  };

  return (
    <div>
      {messages.map((m, i) => (
        <div key={i}>{m.message}</div>
      ))}

      <input
        type="text"
        value={currentMessage}
        onChange={(e) => setCurrentMessage(e.target.value)}
      />

      <button onClick={sendMessage}>Send Message</button>
    </div>
  );
}

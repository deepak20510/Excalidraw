"use client";

import { WS_URL } from "@/config";
import { useEffect, useState } from "react";
import { Canvas } from "./Canvas";
import { useRouter } from "next/navigation";

export function RoomCanvas({ roomId }: { roomId: string }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!roomId || Number.isNaN(Number(roomId))) {
      console.error("Invalid roomId received by RoomCanvas:", roomId);
      setConnectionError("Invalid room id. Please rejoin the room from the home page.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/signin");
      return;
    }

    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onopen = () => {
      setConnectionError("");
      setSocket(ws);
      ws.send(JSON.stringify({ type: "join_room", roomId: roomId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "error" && typeof data.message === "string") {
          setConnectionError(data.message);
        }
      } catch (error) {
        console.error("Failed to parse websocket message:", error);
      }
    };

    ws.onerror = () => {
      setConnectionError("WebSocket connection failed.");
    };

    ws.onclose = () => {
      setSocket(null);
    };

    return () => {
      ws.close();
    };
  }, [roomId, router]);

  if (!socket) {
    return (
      <div className="w-screen h-screen flex justify-center items-center bg-[#030712] text-slate-400 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span>{connectionError || "Connecting to whiteboard server..."}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Canvas roomId={roomId} socket={socket} />
    </div>
  );
}

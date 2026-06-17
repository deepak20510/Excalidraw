"use client";

import { WS_URL } from "@/config";
import { initDraw } from "@/draw";
import { useEffect, useRef, useState } from "react";
import { Canvas } from "./Canvas";

export function RoomCanvas({ roomId }: { roomId: string }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(
      `${WS_URL}?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiMDI1YzY5My1lMGU3LTQ3MDAtYTYwZi1lZTlmNmUwNmYzYTkiLCJpYXQiOjE3ODE2Nzk1ODd9.CPLTWX6xp8qz3_N-OKLwMkEjucKfR3g8OrZFfVleN4U`,
    );
    ws.onopen = () => {
      setSocket(ws);
      ws.send(JSON.stringify({ type: "join_room", roomId: roomId }));
    };
  }, []);

  if (!socket) {
    return <div>Connecting to Server....</div>;
  }

  return (
    <div>
      <Canvas roomId={roomId} socket={socket} />
    </div>
  );
}

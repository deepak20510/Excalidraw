"use client";

import { initDraw } from "@/draw";
import { useEffect, useRef } from "react";

export function Canvas({ roomId }: { roomId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      initDraw(canvasRef.current, roomId);
    }
  }, [canvasRef]);
  return (
    <div>
      <canvas ref={canvasRef} height={700} width={1600}></canvas>
      <div className="absolute bottom-0 right-0"></div>
    </div>
  );
}

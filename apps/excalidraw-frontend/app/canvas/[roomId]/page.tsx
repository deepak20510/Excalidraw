"use client";
import { useEffect, useRef } from "react";

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (!ctx) return;

      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.strokeRect(25, 25, 100, 100);
    }
  }, [canvasRef]);
  return (
    <div>
      <canvas ref={canvasRef} height={500} width={500}></canvas>
    </div>
  );
}

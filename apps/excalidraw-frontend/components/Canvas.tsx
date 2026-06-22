import { initDraw } from "@/draw";
import { useEffect, useRef } from "react";

export function Canvas({
  roomId,
  socket,
}: {
  roomId: string;
  socket: WebSocket;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (canvasRef.current) {
      void initDraw(canvasRef.current, roomId, socket).then((dispose) => {
        cleanup = dispose;
      });
    }

    return () => {
      cleanup?.();
    };
  }, [roomId, socket]);

  return (
    <div>
      <canvas ref={canvasRef} height={700} width={1600} />
    </div>
  );
}

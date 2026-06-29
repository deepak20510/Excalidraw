import { HTTP_BACKEND } from "@/config";
import axios from "axios";

export type Shape =
  | {
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      type: "circle";
      centerX: number;
      centerY: number;
      radius: number;
    }
  | {
      type: "pencil";
      points: { x: number; y: number }[];
    };

type ChatMessage = {
  message: string;
};

type ChatsResponse = {
  messages: ChatMessage[];
};

type ShapeMessage = {
  shape: Shape;
};

function isShape(value: unknown): value is Shape {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }

  const shape = value as Record<string, unknown>;

  if (shape.type === "rect") {
    return (
      typeof shape.x === "number" &&
      typeof shape.y === "number" &&
      typeof shape.width === "number" &&
      typeof shape.height === "number"
    );
  }

  if (shape.type === "circle") {
    return (
      typeof shape.centerX === "number" &&
      typeof shape.centerY === "number" &&
      typeof shape.radius === "number"
    );
  }

  return false;
}

function parseShapeMessage(value: unknown): Shape | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ShapeMessage>;
    return isShape(parsed.shape) ? parsed.shape : null;
  } catch {
    return null;
  }
}

function serializeShapeMessage(shape: Shape) {
  return JSON.stringify({ shape });
}

function areShapesEqual(first: Shape, second: Shape) {
  if (first.type !== second.type) {
    return false;
  }

  if (first.type === "rect" && second.type === "rect") {
    return (
      first.x === second.x &&
      first.y === second.y &&
      first.width === second.width &&
      first.height === second.height
    );
  }

  if (first.type === "circle" && second.type === "circle") {
    return (
      first.centerX === second.centerX &&
      first.centerY === second.centerY &&
      first.radius === second.radius
    );
  }

  return false;
}

export async function initDraw(
  canvas: HTMLCanvasElement,
  roomId: string,
  socket: WebSocket,
) {
  const ctx = canvas.getContext("2d");

  const existingShapes: Shape[] = await getExistingShapes(roomId);
  if (!ctx) return;

  const handleMessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type !== "chat") {
        return;
      }

      const shape = parseShapeMessage(message.message);
      if (!shape) {
        return;
      }

      const alreadyExists = existingShapes.some((existingShape) =>
        areShapesEqual(existingShape, shape),
      );

      if (!alreadyExists) {
        existingShapes.push(shape);
        clearCanvas(existingShapes, canvas, ctx);
      }
    } catch (e) {
      console.error("Error parsing websocket message:", e);
    }
  };
  socket.addEventListener("message", handleMessage);

  clearCanvas(existingShapes, canvas, ctx);
  ctx.strokeStyle = "white";

  let clicked = false;
  let startX = 0;
  let startY = 0;

  const handleMouseDown = (e: MouseEvent) => {
    clicked = true;
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!clicked) {
      return;
    }

    clicked = false;

    const rect = canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    const width = endX - startX;
    const height = endY - startY;

    //@ts-ignore
    const selectedTool = window.selectedTool;
    let shape: Shape | null = null;
    if (selectedTool === "rect") {
      shape = {
        type: "rect",
        x: startX,
        y: startY,
        height,
        width,
      };
    } else if (selectedTool === "circle") {
      const radius = Math.max(width, height) / 2;
      shape = {
        type: "circle",
        radius: radius,
        centerX: startX + radius,
        centerY: startY + radius,
      };
    }
    if (!shape) {
      return;
    }
    existingShapes.push(shape);
    clearCanvas(existingShapes, canvas, ctx);

    socket.send(
      JSON.stringify({
        type: "chat",
        message: serializeShapeMessage(shape),
        roomId,
      }),
    );
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (clicked) {
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      const width = currentX - startX;
      const height = currentY - startY;

      clearCanvas(existingShapes, canvas, ctx);

      ctx.fillStyle = "rgba(0, 0, 0, 1)";
      ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      //@ts-ignore
      const selectedTool = window.selectedTool;
      if (selectedTool === "rect") {
        ctx.strokeRect(startX, startY, width, height);
      } else if (selectedTool === "circle") {
        const radius = Math.sqrt(width * width + height * height) / 2;
        const centerX = startX + radius;
        const centerY = startY + radius;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.closePath();
      }
    }
  };

  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("mouseup", handleMouseUp);
  canvas.addEventListener("mousemove", handleMouseMove);

  return () => {
    socket.removeEventListener("message", handleMessage);
    canvas.removeEventListener("mousedown", handleMouseDown);
    canvas.removeEventListener("mouseup", handleMouseUp);
    canvas.removeEventListener("mousemove", handleMouseMove);
  };
}

function clearCanvas(
  existingShapes: Shape[],
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(0,0,0,1)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  existingShapes.forEach((shape) => {
    if (shape.type === "rect") {
      ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    } else if (shape.type === "circle") {
      ctx.beginPath();
      ctx.arc(shape.centerX, shape.centerY, shape.radius, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.closePath();
    }
  });
}

async function getExistingShapes(roomId: string) {
  if (!roomId || Number.isNaN(Number(roomId))) {
    console.error("Skipping shape fetch for invalid roomId:", roomId);
    return [];
  }

  try {
    const res = await axios.get<ChatsResponse>(
      `${HTTP_BACKEND}/chats/${roomId}`,
    );
    const messages = res.data.messages;
    const shapes = messages
      .map((x) => parseShapeMessage(x.message))
      .filter((shape): shape is Shape => shape !== null);
    return shapes;
  } catch (e) {
    console.error("Failed to fetch existing shapes:", e);
    return [];
  }
}

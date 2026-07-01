import { HTTP_BACKEND } from "@/config";
import axios from "axios";
import { Shape } from "./Game";

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

  if (shape.type === "pencil") {
    return (
      Array.isArray(shape.points) &&
      (shape.points as unknown[]).length > 0 &&
      (shape.points as unknown[]).every(
        (p: unknown) =>
          typeof p === "object" &&
          p !== null &&
          typeof (p as Record<string, unknown>).x === "number" &&
          typeof (p as Record<string, unknown>).y === "number",
      )
    );
  }

  if (shape.type === "line" || shape.type === "arrow") {
    return (
      typeof shape.x1 === "number" &&
      typeof shape.y1 === "number" &&
      typeof shape.x2 === "number" &&
      typeof shape.y2 === "number"
    );
  }

  if (shape.type === "text") {
    return (
      typeof shape.x === "number" &&
      typeof shape.y === "number" &&
      typeof shape.text === "string"
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

export async function getExistingShapes(roomId: string) {
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

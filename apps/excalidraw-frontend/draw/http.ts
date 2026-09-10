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

  if (shape.type === "diamond") {
    return (
      typeof shape.x === "number" &&
      typeof shape.y === "number" &&
      typeof shape.width === "number" &&
      typeof shape.height === "number"
    );
  }

  if (shape.type === "image") {
    return (
      typeof shape.x === "number" &&
      typeof shape.y === "number" &&
      typeof shape.width === "number" &&
      typeof shape.height === "number" &&
      typeof shape.src === "string"
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

// In-flight promise cache to deduplicate parallel requests (e.g. RoomCanvas prefetch + Game init)
const inFlightShapeRequests = new Map<string, Promise<Shape[]>>();
const shapeCache = new Map<string, { shapes: Shape[]; timestamp: number }>();

export async function getExistingShapes(roomId: string, forceRefresh = false): Promise<Shape[]> {
  if (!roomId || Number.isNaN(Number(roomId))) {
    console.error("Skipping shape fetch for invalid roomId:", roomId);
    return [];
  }

  const now = Date.now();
  if (!forceRefresh) {
    const cached = shapeCache.get(roomId);
    if (cached && now - cached.timestamp < 3000) {
      return cached.shapes;
    }
  }

  const existingInFlight = inFlightShapeRequests.get(roomId);
  if (existingInFlight && !forceRefresh) {
    return existingInFlight;
  }

  const fetchPromise = (async () => {
    try {
      const res = await axios.get<ChatsResponse>(
        `${HTTP_BACKEND}/chats/${roomId}`,
      );
      const messages = res.data.messages || [];
      const shapes = messages
        .map((x) => parseShapeMessage(x.message))
        .filter((shape): shape is Shape => shape !== null);

      shapeCache.set(roomId, { shapes, timestamp: Date.now() });
      return shapes;
    } catch (e) {
      console.error("Failed to fetch existing shapes:", e);
      return [];
    } finally {
      inFlightShapeRequests.delete(roomId);
    }
  })();

  inFlightShapeRequests.set(roomId, fetchPromise);
  return fetchPromise;
}

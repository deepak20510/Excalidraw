import { HTTP_BACKEND } from "@/config";
import axios from "axios";
import { Shape } from "./Game";

type ChatMessage = {
  message: string;
};

type ChatsResponse = {
  shapes?: Shape[];
  messages?: ChatMessage[];
};

type ShapeMessage = {
  shape: Shape;
};

// Create resilient Axios client with 8-second timeout
const httpClient = axios.create({
  timeout: 8000,
});

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

// In-flight promise cache to deduplicate parallel requests
const inFlightShapeRequests = new Map<string, Promise<Shape[]>>();
const shapeCache = new Map<string, { shapes: Shape[]; etag?: string; timestamp: number }>();

async function fetchWithRetry(url: string, etag?: string, retries = 2): Promise<{ data: ChatsResponse; notModified?: boolean; etag?: string }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const headers: Record<string, string> = {};
      if (etag) {
        headers["If-None-Match"] = etag;
      }
      const res = await httpClient.get<ChatsResponse>(url, {
        headers,
        validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
      });

      if (res.status === 304) {
        return { data: {}, notModified: true };
      }

      return {
        data: res.data,
        etag: res.headers.etag,
      };
    } catch (err: any) {
      if (attempt === retries) throw err;
      // Exponential backoff wait: 300ms, 600ms
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw new Error("Failed to fetch after retries");
}

export async function getExistingShapes(roomId: string, forceRefresh = false): Promise<Shape[]> {
  if (!roomId || Number.isNaN(Number(roomId))) {
    console.error("Skipping shape fetch for invalid roomId:", roomId);
    return [];
  }

  const now = Date.now();
  const cached = shapeCache.get(roomId);
  if (!forceRefresh && cached && now - cached.timestamp < 2500) {
    return cached.shapes;
  }

  const existingInFlight = inFlightShapeRequests.get(roomId);
  if (existingInFlight && !forceRefresh) {
    return existingInFlight;
  }

  const fetchPromise = (async () => {
    try {
      const { data, notModified, etag } = await fetchWithRetry(
        `${HTTP_BACKEND}/chats/${roomId}`,
        cached?.etag
      );

      // If 304 Not Modified, use cached shapes instantly
      if (notModified && cached) {
        cached.timestamp = Date.now();
        return cached.shapes;
      }

      // Fast path: Server returned direct shapes array
      if (Array.isArray(data.shapes) && data.shapes.length > 0) {
        const validShapes = data.shapes.filter(isShape);
        shapeCache.set(roomId, { shapes: validShapes, etag, timestamp: Date.now() });
        return validShapes;
      }

      // Legacy fallback: Server returned stringified messages array
      const messages = data.messages || [];
      const shapes = messages
        .map((x) => parseShapeMessage(x.message))
        .filter((shape): shape is Shape => shape !== null);

      shapeCache.set(roomId, { shapes, etag, timestamp: Date.now() });
      return shapes;
    } catch (e: any) {
      console.warn("Failed to fetch existing shapes, using cached or empty fallback:", e?.message || e);
      return cached?.shapes || [];
    } finally {
      inFlightShapeRequests.delete(roomId);
    }
  })();

  inFlightShapeRequests.set(roomId, fetchPromise);
  return fetchPromise;
}

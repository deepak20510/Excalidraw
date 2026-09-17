import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import compression from "compression";
import { JWT_SECRET } from "@repo/backend-common/config";
import { middleware } from "./middleware";
import {
  CreateUserSchema,
  SigninSchema,
  CreateRoomSchema,
} from "@repo/common/types";
import { PrismaClient } from "@repo/db/client";
import cors from "cors";
import rateLimit from "express-rate-limit";

const app = express();

// Enable HTTP compression (Gzip / Deflate)
app.use(compression());

// Strict request payload size limits (protect against large body attacks)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Structured Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path !== "/health") {
      const log = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;
      if (res.statusCode >= 500) {
        console.error(log);
      } else if (res.statusCode >= 400) {
        console.warn(log);
      } else if (process.env.NODE_ENV !== "production") {
        console.log(log);
      }
    }
  });
  next();
});

const defaultCorsOrigins = ["http://localhost:3000", "http://localhost:3001"];
const configuredCorsOrigins =
  process.env.CORS_ORIGIN?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];
const corsOrigins = [...defaultCorsOrigins, ...configuredCorsOrigins];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests or matching origins, or wildcard in production if configured
      if (!origin || corsOrigins.includes(origin) || process.env.CORS_ALLOW_ALL === "true") {
        callback(null, true);
      } else {
        callback(null, true); // Permissive default to ensure production web apps don't drop
      }
    },
    credentials: true,
  }),
);

const DEFAULT_PORT = 3001;
const FALLBACK_PORT = 3101;
const configuredPort = Number(
  process.env.HTTP_PORT ?? process.env.PORT ?? DEFAULT_PORT,
);

// Trust proxy headers for accurate IP rate limiting in reverse proxy environments (Vercel, Render, AWS, Nginx)
if (process.env.NODE_ENV === "production" || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

// ── Rate Limiters ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
});
app.use(globalLimiter);

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many signup attempts, please try again after 15 minutes." },
});

const signinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many signin attempts, please try again after 15 minutes." },
});

const createRoomLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many rooms created recently, please try again after 15 minutes." },
});

const chatsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Shape sync rate limit exceeded, backing off." },
});

// ── In-Memory Fast Caches for Repeat Requests ─────────────────────────────────
interface CacheEntry<T> {
  data: T;
  etag: string;
  timestamp: number;
}
const roomCache = new Map<string, { data: any; timestamp: number }>();
const shapesCache = new Map<number, CacheEntry<any>>();

// Evict old cache entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  roomCache.forEach((entry, key) => {
    if (now - entry.timestamp > 10000) roomCache.delete(key);
  });
  shapesCache.forEach((entry, key) => {
    if (now - entry.timestamp > 5000) shapesCache.delete(key);
  });
}, 60000);

// Invalidate shapes cache when shapes change
export function invalidateRoomShapesCache(roomId: number) {
  shapesCache.delete(roomId);
}

// ── Uptime & Health Monitoring ────────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  let dbStatus = "unknown";
  try {
    // Fast database query test
    await PrismaClient.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch (err: any) {
    dbStatus = `error: ${err?.message || "connection failed"}`;
  }

  const memory = process.memoryUsage();
  res.status(dbStatus === "connected" ? 200 : 503).json({
    status: dbStatus === "connected" ? "ok" : "degraded",
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbStatus,
    memory: {
      rssMB: Math.round(memory.rss / (1024 * 1024)),
      heapUsedMB: Math.round(memory.heapUsed / (1024 * 1024)),
      heapTotalMB: Math.round(memory.heapTotal / (1024 * 1024)),
    },
    timestamp: new Date().toISOString(),
  });
});

// ── Authentication Endpoints ──────────────────────────────────────────────────
app.post("/signup", signupLimiter, async (req, res) => {
  const parseData = CreateUserSchema.safeParse(req.body);
  if (!parseData.success) {
    res.status(400).json({
      success: false,
      message: "Incorrect inputs: please provide a valid username and password.",
      errors: parseData.error.issues,
    });
    return;
  }

  try {
    const hashedPassword = await bcrypt.hash(parseData.data.password, 10);
    const user = await PrismaClient.user.create({
      data: {
        email: parseData.data.username,
        password: hashedPassword,
        name: parseData.data.name,
      },
    });

    res.status(201).json({
      success: true,
      userId: user.id,
    });
  } catch (_e) {
    res.status(409).json({
      success: false,
      message: "User already exists with this username/email",
    });
  }
});

app.post("/signin", signinLimiter, async (req, res) => {
  const data = SigninSchema.safeParse(req.body);
  if (!data.success) {
    res.status(400).json({
      success: false,
      message: "Incorrect inputs",
    });
    return;
  }

  try {
    const user = await PrismaClient.user.findFirst({
      where: {
        email: data.data.username,
      },
    });

    if (!user) {
      res.status(403).json({
        success: false,
        message: "Invalid credentials",
      });
      return;
    }

    const passwordMatch = await bcrypt.compare(
      data.data.password,
      user.password,
    );
    if (!passwordMatch) {
      res.status(403).json({
        success: false,
        message: "Invalid credentials",
      });
      return;
    }

    const token = jwt.sign(
      {
        userId: user.id,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    res.json({ success: true, token, name: user.name, email: user.email });
  } catch (e) {
    console.error("Signin server error:", e);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// ── Room Endpoints ────────────────────────────────────────────────────────────
const MAX_ROOMS_PER_USER = 50; // Spending & resource cap

app.post("/room", middleware, createRoomLimiter, async (req, res) => {
  const data = CreateRoomSchema.safeParse(req.body);
  if (!data.success) {
    res.status(400).json({
      success: false,
      message: "Incorrect inputs",
    });
    return;
  }

  const userId = (req as any).userId;

  try {
    // Check spending/resource cap
    const userRoomCount = await PrismaClient.room.count({
      where: { adminId: userId },
    });

    if (userRoomCount >= MAX_ROOMS_PER_USER) {
      res.status(429).json({
        success: false,
        message: `Account room limit reached (maximum ${MAX_ROOMS_PER_USER} rooms allowed).`,
      });
      return;
    }

    const room = await PrismaClient.room.create({
      data: {
        slug: data.data.name.trim(),
        adminId: userId,
      },
    });

    res.status(201).json({
      success: true,
      roomId: room.id,
      slug: room.slug,
    });
  } catch (e) {
    res.status(409).json({
      success: false,
      message: "A room with this name already exists. Please choose a unique name.",
    });
  }
});

app.get("/room/:slug", async (req, res) => {
  const slug = req.params.slug;
  const cached = roomCache.get(`slug_${slug}`);
  if (cached && Date.now() - cached.timestamp < 3000) {
    res.json({ success: true, room: cached.data });
    return;
  }

  try {
    const room = await PrismaClient.room.findFirst({
      where: { slug },
      select: { id: true, slug: true, adminId: true, isLocked: true, createdAt: true },
    });

    if (!room) {
      res.status(404).json({
        success: false,
        message: "Room not found",
      });
      return;
    }

    roomCache.set(`slug_${slug}`, { data: room, timestamp: Date.now() });
    res.json({ success: true, room });
  } catch (e) {
    console.error("Room fetch error:", e);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

app.get("/room/by-id/:roomId", async (req, res) => {
  const roomId = Number(req.params.roomId);
  if (Number.isNaN(roomId)) {
    res.status(400).json({ success: false, message: "Invalid room id" });
    return;
  }

  const cached = roomCache.get(`id_${roomId}`);
  if (cached && Date.now() - cached.timestamp < 3000) {
    res.json({ success: true, room: cached.data });
    return;
  }

  try {
    const room = await PrismaClient.room.findUnique({
      where: { id: roomId },
      select: { id: true, slug: true, adminId: true, isLocked: true, createdAt: true },
    });
    if (!room) {
      res.status(404).json({ success: false, message: "Room not found" });
      return;
    }
    roomCache.set(`id_${roomId}`, { data: room, timestamp: Date.now() });
    res.json({ success: true, room });
  } catch (e) {
    console.error("Room by ID error:", e);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/room/:roomId/members", middleware, async (req, res) => {
  const roomId = Number(req.params.roomId);
  if (Number.isNaN(roomId)) {
    res.status(400).json({ success: false, message: "Invalid room id" });
    return;
  }
  try {
    const members = await PrismaClient.roomMember.findMany({
      where: { roomId },
      include: {
        user: { select: { id: true, name: true, email: true, photo: true } },
      },
      orderBy: { joinedAt: "asc" },
    });
    res.json({ success: true, members });
  } catch (e) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/room/:roomId/members", middleware, async (req, res) => {
  const roomId = Number(req.params.roomId);
  const requesterId = (req as any).userId;
  const { userId, role } = req.body as { userId: string; role: string };

  if (Number.isNaN(roomId) || !userId || !["editor", "viewer"].includes(role)) {
    res.status(400).json({ success: false, message: "Invalid input" });
    return;
  }
  try {
    const room = await PrismaClient.room.findUnique({ where: { id: roomId }, select: { adminId: true } });
    if (!room) {
      res.status(404).json({ success: false, message: "Room not found" });
      return;
    }
    if (room.adminId !== requesterId) {
      res.status(403).json({ success: false, message: "Only admin can update member roles" });
      return;
    }
    const member = await PrismaClient.roomMember.upsert({
      where: { userId_roomId: { userId, roomId } },
      update: { role },
      create: { userId, roomId, role },
    });
    res.json({ success: true, member });
  } catch (e) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.delete("/room/:roomId/members/:userId", middleware, async (req, res) => {
  const roomId = Number(req.params.roomId);
  const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0]! : String(req.params.userId ?? "");
  const requesterId = (req as any).userId;

  if (Number.isNaN(roomId)) {
    res.status(400).json({ success: false, message: "Invalid room id" });
    return;
  }
  try {
    const room = await PrismaClient.room.findUnique({ where: { id: roomId }, select: { adminId: true } });
    if (!room) {
      res.status(404).json({ success: false, message: "Room not found" });
      return;
    }
    if (room.adminId !== requesterId) {
      res.status(403).json({ success: false, message: "Only admin can kick members" });
      return;
    }
    if (targetUserId === requesterId) {
      res.status(400).json({ success: false, message: "Admin cannot kick themselves" });
      return;
    }
    await PrismaClient.roomMember.deleteMany({
      where: { userId: targetUserId, roomId },
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.patch("/room/:roomId/lock", middleware, async (req, res) => {
  const roomId = Number(req.params.roomId);
  const requesterId = (req as any).userId;

  if (Number.isNaN(roomId)) {
    res.status(400).json({ success: false, message: "Invalid room id" });
    return;
  }
  try {
    const room = await PrismaClient.room.findUnique({ where: { id: roomId }, select: { adminId: true, isLocked: true } });
    if (!room) {
      res.status(404).json({ success: false, message: "Room not found" });
      return;
    }
    if (room.adminId !== requesterId) {
      res.status(403).json({ success: false, message: "Only admin can lock/unlock the room" });
      return;
    }
    const updated = await PrismaClient.room.update({
      where: { id: roomId },
      data: { isLocked: !room.isLocked },
      select: { isLocked: true },
    });
    // Invalidate cached room
    roomCache.delete(`id_${roomId}`);
    res.json({ success: true, isLocked: updated.isLocked });
  } catch (e) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ── Optimized Shape Sync with ETag Caching & Pagination ──────────────────────
app.get("/chats/:roomId", chatsLimiter, async (req, res) => {
  const roomId = Number(req.params.roomId);
  if (Number.isNaN(roomId)) {
    res.status(400).json({
      success: false,
      message: "Invalid room id",
    });
    return;
  }

  // Pagination support
  const limit = Math.min(Math.max(Number(req.query.limit) || 2000, 1), 5000);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  // Check short-lived in-memory cache
  const cached = shapesCache.get(roomId);
  const ifNoneMatch = req.headers["if-none-match"];

  if (cached && Date.now() - cached.timestamp < 3000) {
    if (ifNoneMatch && ifNoneMatch === cached.etag) {
      res.status(304).end();
      return;
    }
    res.setHeader("ETag", cached.etag);
    res.setHeader("Cache-Control", "private, no-cache, must-revalidate");
    res.json(cached.data);
    return;
  }

  try {
    // Fast query leveraging composite index [roomId, id]
    const shapes = await PrismaClient.shape.findMany({
      where: { roomId },
      select: {
        id: true,
        type: true,
        data: true,
        style: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
      take: limit,
      skip: offset,
    });

    let maxUpdatedAt = 0;
    const formattedShapes = shapes.map((shape) => {
      const ts = shape.updatedAt ? new Date(shape.updatedAt).getTime() : 0;
      if (ts > maxUpdatedAt) maxUpdatedAt = ts;
      return {
        id: shape.id,
        type: shape.type,
        style: shape.style,
        updatedAt: ts || undefined,
        ...(shape.data as any),
      };
    });

    // Generate ETag from latest shape update timestamp and count
    const etag = `W/"${roomId}-${shapes.length}-${maxUpdatedAt}"`;

    if (ifNoneMatch && ifNoneMatch === etag) {
      res.status(304).end();
      return;
    }

    // Prepare response with both modern lean array AND legacy messages for full backward compatibility
    const responsePayload = {
      success: true,
      shapes: formattedShapes,
      messages: formattedShapes.map((shape) => ({
        message: JSON.stringify({ shape }),
      })),
    };

    // Cache the response
    shapesCache.set(roomId, {
      data: responsePayload,
      etag,
      timestamp: Date.now(),
    });

    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, no-cache, must-revalidate");
    res.json(responsePayload);
  } catch (err: any) {
    console.error("Shape fetch error:", err?.message || err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// ── Global Error Handling Middleware ──────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled express error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "An unexpected internal server error occurred.",
  });
});

// ── Server Startup & Graceful Shutdown ────────────────────────────────────────
function startServer(port: number) {
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`✓ http-backend listening on http://0.0.0.0:${port}`);
  });

  server.once("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      const nextPort = port < FALLBACK_PORT ? FALLBACK_PORT : port + 1;
      console.warn(`Port ${port} in use, trying ${nextPort}...`);
      startServer(nextPort);
      return;
    }
    throw error;
  });

  return server;
}

// Optional Keep-Alive Ping for free-tier deployments (e.g. Render/Koyeb)
const keepAliveUrl = process.env.KEEP_ALIVE_URL;
let keepAliveTimer: NodeJS.Timeout | null = null;
if (keepAliveUrl) {
  console.log(`Keep-alive monitor initialized for ${keepAliveUrl}`);
  keepAliveTimer = setInterval(() => {
    fetch(`${keepAliveUrl}/health`)
      .then((r) => r.json())
      .catch((err) => console.warn("Keep-alive ping error:", err?.message || err));
  }, 10 * 60 * 1000); // every 10 minutes
}

const server = startServer(configuredPort);

function handleShutdown(signal: string) {
  console.log(`Received ${signal}, closing http-backend gracefully...`);
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  server.close(() => {
    console.log("http-backend closed.");
    process.exit(0);
  });
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection in http-backend:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception in http-backend:", error);
});

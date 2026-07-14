import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
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
app.use((req, _res, next) => {
  console.log(req.method, req.url, req.headers.origin);
  next();
});
app.use(express.json());

const defaultCorsOrigins = ["http://localhost:3000", "http://localhost:3001"];
const configuredCorsOrigins =
  process.env.CORS_ORIGIN?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];
const corsOrigins = [...defaultCorsOrigins, ...configuredCorsOrigins];

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);

const DEFAULT_PORT = 3001;
const FALLBACK_PORT = 3101;
const configuredPort = Number(
  process.env.HTTP_PORT ?? process.env.PORT ?? DEFAULT_PORT,
);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Configure Express to trust proxy headers in production (Render, Vercel, AWS ELB, etc.)
if (process.env.NODE_ENV === "production" || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

// Global rate limiting for the whole application
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per 15 minutes
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    message: "Too many requests from this IP, please try again after 15 minutes.",
  },
});
app.use(globalLimiter);

// Specific rate limiting for signup endpoint as requested
app.use(
  "/signup",
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 signup requests per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      message: "Too many signup attempts, please try again after 15 minutes.",
    },
  }),
);

app.post("/signup", async (req, res) => {
  const parseData = CreateUserSchema.safeParse(req.body);
  if (!parseData.success) {
    res.status(400).json({
      message: "Incorrect inputs",
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
    res.json({
      userId: user.id,
    });
  } catch (e) {
    res.status(411).json({
      message: "User already exists with this username",
    });
  }
});

app.post("/signin", async (req, res) => {
  const data = SigninSchema.safeParse(req.body);
  if (!data.success) {
    res.status(400).json({
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
        message: "Invalid credentials",
      });
      return;
    }

    const token = jwt.sign(
      {
        userId: user.id,
      },
      JWT_SECRET,
    );

    res.json({ token });
  } catch (e) {
    res.status(500).json({
      message: "Internal server error",
    });
  }
});

app.post("/room", middleware, async (req, res) => {
  const data = CreateRoomSchema.safeParse(req.body);
  if (!data.success) {
    res.status(400).json({
      message: "Incorrect inputs",
    });
    return;
  }

  const userId = (req as any).userId;

  try {
    const room = await PrismaClient.room.create({
      data: {
        slug: data.data.name,
        adminId: userId,
      },
    });

    res.json({
      roomId: room.id,
    });
  } catch (e) {
    res.status(411).json({
      message: "Room already exists",
    });
  }
});

app.get("/room/:slug", async (req, res) => {
  const slug = req.params.slug;
  try {
    const room = await PrismaClient.room.findFirst({
      where: {
        slug,
      },
    });

    if (!room) {
      res.status(404).json({
        message: "Room not found",
      });
      return;
    }

    res.json({
      room,
    });
  } catch (e) {
    res.status(500).json({
      message: "Internal server error",
    });
  }
});

function startServer(port: number) {
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`http-backend listening on port ${port}`);
  });

  server.once("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      const nextPort = port < FALLBACK_PORT ? FALLBACK_PORT : port + 1;
      startServer(nextPort);
      return;
    }

    throw error;
  });

  return server;
}

app.get("/chats/:roomId", async (req, res) => {
  const roomId = Number(req.params.roomId);
  if (Number.isNaN(roomId)) {
    res.status(400).json({
      message: "Invalid room id",
    });
    return;
  }

  const messages = await PrismaClient.chat.findMany({
    where: {
      roomId: roomId,
    },
    orderBy: {
      id: "asc",
    },
  });
  res.json({
    messages,
  });
});

startServer(configuredPort);

<div align="center">

<br />

# DraftBoard

**A real-time collaborative infinite canvas — built for teams who think visually.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma%20ORM-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-EF4444?style=flat-square&logo=turborepo&logoColor=white)](https://turbo.build/)
[![pnpm](https://img.shields.io/badge/pnpm-9.0-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)

[Features](#-features) · [Architecture](#-architecture) · [Getting Started](#-getting-started) · [Environment Variables](#-environment-variables) · [API Reference](#-api-reference)

</div>

---

## ✨ Features

### 🎨 Rich Drawing Toolkit
- **8 shape primitives** — Rectangle, Circle, Diamond, Line, Arrow, Pencil (freehand), Text, and Image
- **Smooth freehand strokes** via quadratic Bézier interpolation
- **Hand-crafted aesthetics** powered by [Rough.js](https://roughjs.com/) for a sketchy, natural look
- **Per-shape styles** — stroke colour, fill colour, stroke width, opacity, stroke style (solid/dashed/dotted), roughness, and fill pattern (solid/hatch/cross-hatch)

### 🌐 Real-Time Collaboration
- **WebSocket-powered live sync** — every stroke appears on collaborators' canvases instantly
- **Live cursor presence** — see where teammates are pointing, with colour-coded named cursors that fade out on inactivity
- **Last-Write-Wins (LWW) Operational Transform** on the server for conflict-free concurrent edits
- **Exponential back-off reconnection** — the client transparently reconnects after network drops

### 🏠 Room & Permission System
- Create named rooms with a unique slug
- **Admin controls** — lock/unlock the canvas, set per-member roles (`editor` / `viewer`), and kick users in real time
- Room state is broadcast to all connected members via WebSocket presence events

### 🖼️ Infinite Canvas
- **Pan** with the Hand tool or `Space` + drag
- **Zoom** with the scroll wheel or pinch-to-zoom on touch devices
- **Minimap** for quick canvas navigation
- Full **touch support** including multi-touch pinch-zoom

### ⏱️ History & Layer Management
- Unlimited **Undo / Redo** with a full history stack (synced across collaborators)
- **Bring to Front / Send to Back / Bring Forward / Send Backward** layering commands
- **Select & Drag** shapes to reposition them; style edits broadcast to peers immediately

### 🔒 Authentication & Security
- JWT-based auth (7-day tokens) with bcrypt password hashing
- **Rate limiting** — 100 req / 15 min globally, 10 req / 15 min on `/signup`
- WebSocket connections are closed instantly on invalid/missing tokens

---

## 🏗 Architecture

This is a **pnpm + Turborepo monorepo** with three independently deployable services.

```
draw-app/
├── apps/
│   ├── excalidraw-frontend/   # Next.js 15 App Router (port 3000)
│   ├── http-backend/          # Express REST API (port 3001)
│   └── ws-backend/            # Node.js WebSocket server (port 8082)
└── packages/
    ├── db/                    # Prisma ORM + PostgreSQL schema
    ├── common/                # Shared Zod validation schemas
    ├── backend-common/        # Shared JWT config
    ├── ui/                    # Shared React UI primitives
    ├── eslint-config/         # Shared ESLint config
    └── typescript-config/     # Shared tsconfig bases
```

### Data Flow

```
Browser (Next.js)
    │
    ├── REST (HTTP)  ──►  http-backend (Express)  ──►  PostgreSQL (Prisma)
    │                         - Auth (signup/signin)
    │                         - Room CRUD
    │                         - Member management
    │
    └── WebSocket  ──────►  ws-backend (ws)  ──►  PostgreSQL (Prisma)
                               - join_room / leave_room
                               - chat (shape drawn)
                               - move_shape (drag/style)
                               - cursor (live presence)
                               - delete_shape / undo / redo
                               - lock_room / kick_user
                               - set_draw_permission
```

### Database Schema

| Model | Description |
|-------|-------------|
| `User` | Auth identity — email, bcrypt password, display name, avatar |
| `Room` | Whiteboard room — unique slug, admin FK, `isLocked` flag |
| `RoomMember` | M2M join — user ↔ room with `editor` / `viewer` role |
| `Shape` | Persisted drawing element — type, JSON data payload, JSON style, timestamps |

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | ≥ 18 |
| pnpm | 9.0.0 |
| PostgreSQL | ≥ 14 |

### 1. Clone & Install

```bash
git clone https://github.com/deepak20510/Excalidraw.git
cd Excalidraw/draw-app
pnpm install
```

> `postinstall` automatically runs `prisma generate` to build the type-safe Prisma client.

### 2. Configure Environment

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

See [Environment Variables](#-environment-variables) for details.

### 3. Run Database Migrations

```bash
pnpm migrate:db
```

### 4. Start Development Servers

```bash
# Run all three services in parallel via Turborepo
pnpm dev
```

Or start each service individually:

```bash
# Terminal 1 — HTTP API
pnpm --filter http-backend dev       # http://localhost:3001

# Terminal 2 — WebSocket server
pnpm --filter ws-backend dev         # ws://localhost:8082

# Terminal 3 — Next.js frontend
pnpm --filter excalidraw-frontend dev # http://localhost:3000
```

---

## 🔑 Environment Variables

Create a `.env` file at the **monorepo root** (alongside `package.json`). All services read from this file.

```env
# ─── Database ──────────────────────────────────────────
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# ─── Auth ──────────────────────────────────────────────
JWT_SECRET=replace-with-a-long-random-secret

# ─── CORS (comma-separated origins) ───────────────────
CORS_ORIGIN=https://your-app.vercel.app

# ─── Frontend (Next.js public env vars) ───────────────
NEXT_PUBLIC_HTTP_BACKEND=https://your-http-service.onrender.com
NEXT_PUBLIC_WS_URL=wss://your-ws-service.onrender.com

# ─── Backend ports (optional, defaults shown) ─────────
HTTP_PORT=3001
WS_PORT=8082
NODE_ENV=production
```

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/signup` | — | Register a new user |
| `POST` | `/signin` | — | Sign in, receive JWT |

### Rooms

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/room` | ✅ | Create a new room |
| `GET` | `/room/:slug` | — | Get room by slug |
| `GET` | `/room/by-id/:roomId` | — | Get room by numeric ID |
| `GET` | `/chats/:roomId` | — | Fetch all persisted shapes for a room |

### Room Members (Admin Only)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/room/:roomId/members` | ✅ | List all room members and roles |
| `POST` | `/room/:roomId/members` | ✅ | Upsert a member's role (`editor`/`viewer`) |
| `DELETE` | `/room/:roomId/members/:userId` | ✅ | Kick a member from the room |
| `PATCH` | `/room/:roomId/lock` | ✅ | Toggle canvas lock state |

### WebSocket Messages

Connect to the WS server with a valid JWT:
```
ws://localhost:8082?token=<jwt>
```

| `type` | Direction | Description |
|--------|-----------|-------------|
| `join_room` | Client → Server | Subscribe to a room's event stream |
| `leave_room` | Client → Server | Unsubscribe from a room |
| `chat` | Client ↔ Server | Broadcast a newly drawn shape |
| `move_shape` | Client ↔ Server | Broadcast a shape move/style update (LWW OT) |
| `delete_shape` | Client ↔ Server | Broadcast a shape deletion |
| `undo` / `redo` | Client ↔ Server | Broadcast history navigation |
| `cursor` | Client ↔ Server | Broadcast live cursor position |
| `sync_shapes` | Server → Client | Full canvas state sync (conflict resolution) |
| `presence_update` | Server → Client | Room member list update |
| `room_locked` / `room_unlocked` | Server → Client | Canvas lock state change |
| `permission_update` | Server → Client | Notify user of role change |
| `kicked` | Server → Client | Notify user they were removed |
| `error` | Server → Client | Error message |

---

## 🛠 Available Scripts

Run from the monorepo root:

```bash
pnpm dev              # Start all services in watch mode
pnpm build            # Production build (all services)
pnpm lint             # Lint all packages
pnpm format           # Prettier format all .ts/.tsx/.md files
pnpm check-types      # TypeScript type-check all packages

pnpm migrate:db       # Run Prisma migrations (production)
pnpm generate:db      # Regenerate Prisma client

pnpm build:frontend   # Build only the Next.js app
pnpm build:http       # Build only the HTTP backend
pnpm build:ws         # Build only the WS backend
```

---

## 🚢 Deployment

The project is configured for deployment across multiple platforms:

| Service | Recommended Platform | Notes |
|---------|---------------------|-------|
| `excalidraw-frontend` | **Vercel** | `vercel.json` already included |
| `http-backend` | **Render / Railway** | Listens on `0.0.0.0`, auto falls back to next port if busy |
| `ws-backend` | **Render / Railway** | WebSocket-compatible host required; `wss://` in production |
| Database | **Supabase / Neon / RDS** | Any PostgreSQL-compatible provider |

> **Note:** Ensure `CORS_ORIGIN` includes your frontend's production URL and `NEXT_PUBLIC_*` vars are set in your Vercel project settings.

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Drawing Engine | HTML5 Canvas API, Rough.js |
| HTTP Backend | Express.js, JWT, bcryptjs, express-rate-limit |
| WebSocket Backend | `ws` library, Node.js HTTP server |
| Database | PostgreSQL, Prisma ORM |
| Monorepo | pnpm workspaces, Turborepo |
| Validation | Zod |
| Deployment | Vercel (frontend), Render (backends) |

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---

<div align="center">
  <sub>Built with ❤️ — <a href="https://github.com/deepak20510">@deepak20510</a></sub>
</div>

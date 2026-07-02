# Deployment guide

This project is set up for a clean production deployment using:

- Vercel for the frontend
- Render for the HTTP backend and WebSocket backend
- PostgreSQL for the Prisma database

## 1. Prepare the database

Create a PostgreSQL database and copy its connection string into the Render service environment variables as `DATABASE_URL`.

Run the Prisma migrations after the database is available:

```bash
pnpm generate:db
pnpm migrate:db
```

## 2. Deploy the frontend to Vercel

1. Push this repository to GitHub.
2. Import the repository in Vercel.
3. Set the project root to the monorepo root.
4. Configure the following environment variables in Vercel:
   - `NEXT_PUBLIC_HTTP_BACKEND=https://your-http-service.onrender.com`
   - `NEXT_PUBLIC_WS_URL=wss://your-ws-service.onrender.com`
5. Deploy.

## 3. Deploy the backend services to Render

1. Create a new Render web service from this repository.
2. Use the root as the repository root.
3. Set the build and start commands:
   - HTTP backend: `pnpm install --frozen-lockfile && pnpm --filter http-backend build`
   - Start: `pnpm --filter http-backend start`
   - WS backend: `pnpm install --frozen-lockfile && pnpm --filter ws-backend build`
   - Start: `pnpm --filter ws-backend start`
4. Set environment variables:
   - `NODE_ENV=production`
   - `PORT=10000`
   - `HTTP_PORT=10000` for the HTTP service
   - `WS_PORT=10000` for the WS service
   - `DATABASE_URL=...`
   - `JWT_SECRET=...`
   - `CORS_ORIGIN=https://your-frontend.vercel.app`
5. Deploy and confirm the `/health` endpoint returns `{"status":"ok"}`.

## 4. Production hardening checklist

- Make sure `JWT_SECRET` is a long random string.
- Make sure `CORS_ORIGIN` includes your Vercel domain.
- Make sure the frontend uses the Render HTTPS URLs, not localhost.
- Make sure the WebSocket URL uses `wss://` in production.
- Verify that Prisma migrations completed successfully.

## 5. Expected runtime behavior

- Auth signup/signin works.
- Room creation works.
- Real-time chat and shape updates work.
- The app does not rely on local development ports in production.

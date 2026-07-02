const defaultBackendUrl = "http://localhost:3001";
const defaultWsUrl = "ws://localhost:8082";

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_HTTP_BACKEND ?? defaultBackendUrl;
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? defaultWsUrl;

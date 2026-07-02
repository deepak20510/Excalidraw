const defaultHttpBackend = "http://localhost:3001";
const defaultWsUrl = "ws://localhost:8082";

export const HTTP_BACKEND =
  process.env.NEXT_PUBLIC_HTTP_BACKEND ?? defaultHttpBackend;
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? defaultWsUrl;

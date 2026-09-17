const defaultHttpBackend = "http://localhost:3001";
const defaultWsUrl = "ws://localhost:8082";

const rawHttp = process.env.NEXT_PUBLIC_HTTP_BACKEND ?? defaultHttpBackend;
const rawWs = process.env.NEXT_PUBLIC_WS_URL ?? defaultWsUrl;

/**
 * Automatically ensures secure protocols (https and wss) when running in production browsers
 * to prevent mixed content blocking.
 */
export function getSafeHttpBackend(): string {
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    if (rawHttp.startsWith("http://") && !rawHttp.includes("localhost")) {
      return rawHttp.replace(/^http:\/\//i, "https://");
    }
  }
  return rawHttp;
}

export function getSafeWsUrl(): string {
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    if (rawWs.startsWith("ws://") && !rawWs.includes("localhost")) {
      return rawWs.replace(/^ws:\/\//i, "wss://");
    }
  }
  return rawWs;
}

export const HTTP_BACKEND = getSafeHttpBackend();
export const WS_URL = getSafeWsUrl();

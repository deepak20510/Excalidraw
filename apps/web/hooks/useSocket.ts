import { useEffect, useState } from "react";
import { WS_URL } from "../app/config";

export function useSocket() {
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    let active = true;
    let token = "";
    if (typeof window !== "undefined") {
      token = localStorage.getItem("token") || new URLSearchParams(window.location.search).get("token") || "";
    }
    // Remove placeholder token used in examples
    if (token === "YOUR_JWT_TOKEN_FROM_POSTMAN") token = "";
    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onopen = () => {
      if (active) {
        setSocket(ws);
        setLoading(false);
      }
      console.log("WS OPEN");
    };

    ws.onclose = () => {
      if (active) {
        setSocket(null);
        setLoading(false);
      }
      console.log("WS CLOSED");
    };

    ws.onerror = (e) => {
      if (active) {
        setLoading(false);
      }
      console.log("WS ERROR", e);
    };

    return () => {
      active = false;
      ws.close();
    };
  }, []);

  return {
    socket,
    loading,
  };
}

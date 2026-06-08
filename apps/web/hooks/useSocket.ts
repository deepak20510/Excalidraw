import { useEffect, useState } from "react";
import { WS_URL } from "../app/config";

export function useSocket() {
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? (localStorage.getItem("token") || new URLSearchParams(window.location.search).get("token") || "") : "";
    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onopen = () => {
      setSocket(ws);
      setLoading(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  return {
    socket,
    loading,
  };
}

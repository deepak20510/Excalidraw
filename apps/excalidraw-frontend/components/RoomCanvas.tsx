"use client";

import { HTTP_BACKEND } from "@/config";
import { WS_URL } from "@/config";
import { useEffect, useState } from "react";
import { Canvas } from "./Canvas";
import { useRouter } from "next/navigation";
import { PencilLine } from "lucide-react";

/** Decode a JWT payload without verifying signature (client-side only) */
function decodeJwt(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1];
    if (!part) return {};
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

interface RoomInfo {
  id: number;
  slug: string;
  adminId: string;
  isLocked: boolean;
}

export function RoomCanvas({ roomId }: { roomId: string }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("User");
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [initialMemberRoles, setInitialMemberRoles] = useState<Record<string, "editor" | "viewer">>({});
  const router = useRouter();

  useEffect(() => {
    if (!roomId || Number.isNaN(Number(roomId))) {
      console.error("Invalid roomId received by RoomCanvas:", roomId);
      setConnectionError("Invalid room id. Please rejoin the room from the home page.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/signin");
      return;
    }

    // Extract userId from JWT payload
    const payload = decodeJwt(token);
    const resolvedUserId = typeof payload.userId === "string" ? payload.userId : String(payload.userId ?? "");
    setUserId(resolvedUserId);

    // Use stored name if available, fall back to email prefix or "User"
    const storedName = localStorage.getItem("userName") || localStorage.getItem("userEmail") || "";
    const displayName = storedName
      ? storedName.split("@")[0]!.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim() || "User"
      : "User";
    setUserName(displayName);

    // Fetch room info (slug, adminId, isLocked)
    fetch(`${HTTP_BACKEND}/room/by-id/${roomId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.room) setRoomInfo(data.room);
      })
      .catch(() => {
        // non-fatal — canvas will still work without room info
      });

    // Fetch room member roles
    fetch(`${HTTP_BACKEND}/room/${roomId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 403) {
          localStorage.removeItem("token");
          setConnectionError("Session expired. Please log in again.");
          router.push("/signin");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data && Array.isArray(data.members)) {
          const roles: Record<string, "editor" | "viewer"> = {};
          data.members.forEach((m: { userId: string; role: "editor" | "viewer" }) => {
            roles[m.userId] = m.role;
          });
          setInitialMemberRoles(roles);
        }
      })
      .catch(() => {});

    let activeSocket: WebSocket | null = null;
    let reconnectTimeoutId: NodeJS.Timeout | null = null;
    let reconnectDelay = 1000;
    const maxReconnectDelay = 16000;
    let isCleanedUp = false;

    function connect() {
      if (isCleanedUp) return;

      const ws = new WebSocket(`${WS_URL}?token=${token}`);
      activeSocket = ws;

      ws.onopen = () => {
        if (isCleanedUp) {
          ws.close();
          return;
        }
        setConnectionError("");
        setSocket(ws);
        reconnectDelay = 1000;
        ws.send(JSON.stringify({ type: "join_room", roomId: roomId }));
      };

      ws.onmessage = (event) => {
        if (isCleanedUp) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "error" && typeof data.message === "string") {
            setConnectionError(data.message);
          }
          // Update isLocked state from WS events
          if (data.type === "room_locked") {
            setRoomInfo((prev) => prev ? { ...prev, isLocked: true } : prev);
          }
          if (data.type === "room_unlocked") {
            setRoomInfo((prev) => prev ? { ...prev, isLocked: false } : prev);
          }
        } catch (error) {
          console.error("Failed to parse websocket message:", error);
        }
      };

      ws.onerror = () => {
        if (isCleanedUp) return;
        setConnectionError("WebSocket connection failed.");
      };

      ws.onclose = (event) => {
        if (isCleanedUp) return;
        setSocket(null);

        if (event.code === 1008) {
          isCleanedUp = true;
          if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
          setConnectionError("Unauthorized session. Please log in again.");
          localStorage.removeItem("token");
          router.push("/signin");
          return;
        }

        console.log(`WebSocket closed. Reconnecting in ${reconnectDelay}ms...`);
        reconnectTimeoutId = setTimeout(() => {
          connect();
        }, reconnectDelay);

        reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
      };
    }

    connect();

    return () => {
      isCleanedUp = true;
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
      }
      if (activeSocket) {
        activeSocket.close();
      }
    };
  }, [roomId, router]);

  if (!socket) {
    return (
      <div className="w-screen h-screen flex justify-center items-center bg-[#030712] text-slate-100 font-sans relative overflow-hidden select-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none animate-pulse" />

        <div className="relative p-8 bg-zinc-900/90 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-2xl flex flex-col items-center gap-4 text-center max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-3 rounded-2xl shadow-lg shadow-indigo-500/30 animate-bounce">
            <PencilLine className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-white">DraftBoard Engine</h3>
            <p className="text-xs text-zinc-400 mt-1">
              {connectionError || "Establishing secure WebSocket channel..."}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-xl">
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span>Syncing Room #{roomId}...</span>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = !!roomInfo && roomInfo.adminId === userId;
  const isLocked = roomInfo?.isLocked ?? false;
  const roomName = roomInfo?.slug ?? `Room #${roomId}`;

  return (
    <div>
      <Canvas
        roomId={roomId}
        socket={socket}
        userId={userId}
        userName={userName}
        isAdmin={isAdmin}
        isLocked={isLocked}
        roomName={roomName}
        initialMemberRoles={initialMemberRoles}
      />
    </div>
  );
}

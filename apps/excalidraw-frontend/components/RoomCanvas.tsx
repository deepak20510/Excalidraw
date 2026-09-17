"use client";

import { HTTP_BACKEND, WS_URL } from "@/config";
import { useEffect, useRef, useState } from "react";
import { Canvas } from "./Canvas";
import { useRouter } from "next/navigation";
import { PencilLine, RefreshCw, ArrowLeft, WifiOff, AlertTriangle } from "lucide-react";
import { getExistingShapes } from "@/draw/http";
import type { Shape } from "@/draw/Game";

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
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "reconnecting" | "error">("connecting");
  const [connectionError, setConnectionError] = useState("");
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("User");
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [initialMemberRoles, setInitialMemberRoles] = useState<Record<string, "editor" | "viewer">>({});
  const initialShapesPromiseRef = useRef<Promise<Shape[]> | null>(null);
  const router = useRouter();

  // Retry trigger
  const [connectAttempt, setConnectAttempt] = useState(0);

  useEffect(() => {
    if (!roomId || Number.isNaN(Number(roomId))) {
      console.error("Invalid roomId received by RoomCanvas:", roomId);
      setConnectionError("Invalid room id. Please rejoin the room from the home page.");
      setConnectionStatus("error");
      return;
    }

    // Immediately trigger shapes prefetch in parallel with WS & metadata
    initialShapesPromiseRef.current = getExistingShapes(roomId);

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

    // Fetch room info with 8s timeout
    const roomController = new AbortController();
    const roomTimeout = setTimeout(() => roomController.abort(), 8000);
    fetch(`${HTTP_BACKEND}/room/by-id/${roomId}`, { signal: roomController.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data.room) setRoomInfo(data.room);
      })
      .catch((_err) => {
        // Non-fatal, canvas functions even if room metadata is pending
      })
      .finally(() => clearTimeout(roomTimeout));

    // Fetch room member roles in parallel
    const membersController = new AbortController();
    const membersTimeout = setTimeout(() => membersController.abort(), 8000);
    fetch(`${HTTP_BACKEND}/room/${roomId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: membersController.signal,
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
      .catch(() => {})
      .finally(() => clearTimeout(membersTimeout));

    // Detect slow server wake-ups (Render / Fly free tier 30-50s cold start)
    const slowTimer = setTimeout(() => {
      setIsSlowConnection(true);
    }, 7000);

    let activeSocket: WebSocket | null = null;
    let reconnectTimeoutId: NodeJS.Timeout | null = null;
    let reconnectDelay = 1000;
    const maxReconnectDelay = 12000;
    let isCleanedUp = false;

    function connect() {
      if (isCleanedUp) return;

      try {
        const ws = new WebSocket(`${WS_URL}?token=${token}`);
        activeSocket = ws;

        ws.onopen = () => {
          if (isCleanedUp) {
            ws.close();
            return;
          }
          clearTimeout(slowTimer);
          setIsSlowConnection(false);
          setConnectionError("");
          setConnectionStatus("connected");
          setSocket(ws);
          reconnectDelay = 1000;
        };

        ws.onmessage = (event) => {
          if (isCleanedUp) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === "error" && typeof data.message === "string") {
              setConnectionError(data.message);
            }
            if (data.type === "room_locked") {
              setRoomInfo((prev) => (prev ? { ...prev, isLocked: true } : prev));
            }
            if (data.type === "room_unlocked") {
              setRoomInfo((prev) => (prev ? { ...prev, isLocked: false } : prev));
            }
          } catch (error) {
            console.error("Failed to parse websocket message:", error);
          }
        };

        ws.onerror = () => {
          if (isCleanedUp) return;
          setConnectionStatus("reconnecting");
        };

        ws.onclose = (event) => {
          if (isCleanedUp) return;
          setConnectionStatus("reconnecting");

          if (event.code === 1008) {
            isCleanedUp = true;
            if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
            setConnectionError("Unauthorized session. Please log in again.");
            setConnectionStatus("error");
            localStorage.removeItem("token");
            router.push("/signin");
            return;
          }

          reconnectTimeoutId = setTimeout(() => {
            connect();
          }, reconnectDelay);

          reconnectDelay = Math.min(reconnectDelay * 1.5, maxReconnectDelay);
        };
      } catch (err: any) {
        setConnectionError("Failed to initiate WebSocket connection.");
        setConnectionStatus("error");
      }
    }

    connect();

    return () => {
      isCleanedUp = true;
      clearTimeout(slowTimer);
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
      }
      if (activeSocket) {
        activeSocket.close();
      }
    };
  }, [roomId, router, connectAttempt]);

  // If socket is not yet open on initial load, show sleek loading with recovery options
  if (!socket) {
    return (
      <div className="w-screen h-screen flex justify-center items-center bg-[#09090b] text-slate-100 font-sans relative overflow-hidden select-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />

        <div className="relative p-8 bg-zinc-900/95 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-2xl flex flex-col items-center gap-5 text-center max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-3 rounded-2xl shadow-lg shadow-indigo-500/30">
            <PencilLine className="w-6 h-6 text-white" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Joining Room #{roomId}</h3>
            <p className="text-xs text-zinc-400 mt-1.5">
              {connectionError || "Connecting to real-time collaboration server..."}
            </p>
          </div>

          <div className="flex items-center gap-2.5 text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-xl">
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span>Establishing live channel...</span>
          </div>

          {isSlowConnection && (
            <div className="w-full bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-left flex items-start gap-2.5 text-xs text-amber-300 animate-in fade-in duration-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <p className="font-semibold text-amber-200">Server is waking up</p>
                <p className="text-[11px] text-amber-300/80 mt-0.5 leading-relaxed">
                  Free tier cloud servers (like Render or Koyeb) spin down when idle. First connection may take 20-30 seconds.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 w-full">
            <button
              onClick={() => router.push("/")}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <button
              onClick={() => setConnectAttempt((prev) => prev + 1)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = !!roomInfo && roomInfo.adminId === userId;
  const isLocked = roomInfo?.isLocked ?? false;
  const roomName = roomInfo?.slug ?? `Room #${roomId}`;

  return (
    <div className="relative w-full h-full">
      {connectionStatus === "reconnecting" && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/90 text-zinc-900 font-semibold text-xs shadow-lg backdrop-blur-md animate-pulse">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Reconnecting to room... (Canvas is accessible)</span>
        </div>
      )}

      <Canvas
        roomId={roomId}
        socket={socket}
        userId={userId}
        userName={userName}
        isAdmin={isAdmin}
        isLocked={isLocked}
        roomName={roomName}
        initialMemberRoles={initialMemberRoles}
        initialShapes={initialShapesPromiseRef.current || undefined}
      />
    </div>
  );
}

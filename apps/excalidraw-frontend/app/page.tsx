"use client";

import React, { useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  Sparkles,
  PencilLine,
  Share2,
  Layers,
  Shield,
  MousePointer,
  Laptop,
  Zap,
  Move,
  Diamond,
  Circle,
  RectangleHorizontalIcon,
  Palette,
  CheckCircle2,
  ChevronRight,
  Download,
  Hand,
  Type,
  Eraser,
  Undo2,
  Redo2,
  Minus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { HTTP_BACKEND } from "@/config";

type ErrorResponse = {
  message?: string;
};

function subscribeToAuthChange(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === "token") {
      onStoreChange();
    }
  };

  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

function getAuthSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(window.localStorage.getItem("token"));
}

export default function LandingPage() {
  const [year] = useState(() => new Date().getFullYear().toString());
  const [showRoomInput, setShowRoomInput] = useState(false);
  const [roomSlug, setRoomSlug] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const isLoggedIn = useSyncExternalStore(
    subscribeToAuthChange,
    getAuthSnapshot,
    () => false
  );

  const handleStartWhiteboarding = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/signin");
    } else {
      setShowRoomInput(true);
    }
  };

  const handleJoinOrCreateRoom = async () => {
    if (!roomSlug.trim()) return;
    setError("");
    setLoading(true);
    const token = localStorage.getItem("token") || "";
    try {
      let roomId;
      try {
        const getRes = await axios.get(`${HTTP_BACKEND}/room/${roomSlug}`);
        roomId = getRes.data.room.id;
      } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          const createRes = await axios.post(
            `${HTTP_BACKEND}/room`,
            { name: roomSlug },
            { headers: { Authorization: token } }
          );
          roomId = createRes.data.roomId;
        } else {
          throw err;
        }
      }

      if (roomId) {
        router.push(`/canvas/${roomId}`);
      }
    } catch (err: unknown) {
      setError(
        axios.isAxiosError<ErrorResponse>(err)
          ? err.response?.data?.message ||
              "Failed to join or create the room."
          : "Failed to join or create the room."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden relative">
      {/* Dynamic Background Mesh & Ambient Glows */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-40 right-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-2xl border-b border-white/[0.08] bg-[#030712]/70 px-6 py-4 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-xl tracking-tight group cursor-pointer">
            <div className="bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-2 rounded-xl shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
              <PencilLine className="w-5 h-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent font-black tracking-tight text-2xl">
              DraftBoard
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-400">
            <a
              href="#features"
              className="hover:text-white transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 hover:after:w-full after:bg-indigo-400 after:transition-all"
            >
              Features
            </a>
            <a
              href="#workspace"
              className="hover:text-white transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 hover:after:w-full after:bg-indigo-400 after:transition-all"
            >
              Workspace
            </a>
            <a
              href="#architecture"
              className="hover:text-white transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 hover:after:w-full after:bg-indigo-400 after:transition-all"
            >
              Architecture
            </a>
          </div>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowRoomInput(true)}
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  <Sparkles size={14} />
                  <span>My Rooms</span>
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem("token");
                    window.dispatchEvent(
                      new StorageEvent("storage", { key: "token" })
                    );
                    setShowRoomInput(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-white/10 hover:bg-white/10 text-xs font-semibold text-zinc-300 transition-all cursor-pointer"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link href="/signin">
                  <button className="px-4 py-2 rounded-xl bg-zinc-900 border border-white/10 hover:bg-white/10 text-xs font-semibold text-zinc-200 transition-all cursor-pointer">
                    Log In
                  </button>
                </Link>
                <Link href="/signup">
                  <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 cursor-pointer">
                    Get Started Free
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative max-w-7xl mx-auto px-6 pt-24 pb-16 text-center">
        {/* Release Pill Badge */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xs font-semibold text-indigo-300 mb-8 backdrop-blur-xl shadow-lg shadow-indigo-500/10">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          <span>DraftBoard 2.0 • Ultra-Fluid Vector Canvas Engine</span>
          <ChevronRight size={14} className="text-indigo-400" />
        </div>

        <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-white max-w-5xl mx-auto leading-[1.08]">
          Where raw imagination becomes <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-lg">
            interactive vector art.
          </span>
        </h1>

        <p className="mt-8 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto font-normal leading-relaxed">
          An unbound collaborative whiteboard with hand-drawn RoughJS styling, a floating center-top toolbar, live WebSocket sync, and instant PNG export.
        </p>

        {!showRoomInput ? (
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={handleStartWhiteboarding}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-95 text-white font-extrabold text-base px-8 py-4 rounded-2xl transition-all shadow-xl shadow-indigo-500/25 active:scale-[0.98] cursor-pointer"
            >
              <span>Launch Whiteboard</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <a
              href="#features"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 text-slate-200 font-semibold text-base px-8 py-4 rounded-2xl transition-all backdrop-blur-md cursor-pointer"
            >
              Explore Features
            </a>
          </div>
        ) : (
          <div className="mt-10 max-w-md mx-auto p-4 bg-zinc-900/90 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider text-left pl-1">
                Enter Room Name or Join Existing
              </span>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="e.g. system-architecture-room"
                  value={roomSlug}
                  onChange={(e) => setRoomSlug(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinOrCreateRoom()}
                  className="w-full px-4 py-3 bg-zinc-950/80 border border-white/10 focus:border-indigo-500 rounded-xl text-sm placeholder-zinc-500 text-zinc-100 outline-none transition-all"
                />
                <button
                  onClick={handleJoinOrCreateRoom}
                  disabled={loading}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-95 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg text-sm whitespace-nowrap disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Joining..." : "Enter Room"}
                </button>
              </div>
              {error && (
                <p className="text-red-400 text-xs text-left bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
                  {error}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Interactive App Preview Mockup */}
        <div id="workspace" className="mt-20 relative rounded-3xl border border-white/10 bg-zinc-950/60 p-4 shadow-2xl backdrop-blur-2xl overflow-hidden max-w-6xl mx-auto">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/[0.04] via-transparent to-purple-500/[0.04] pointer-events-none" />

          {/* Browser Window Bar */}
          <div className="flex items-center justify-between pb-3 px-3 border-b border-white/10 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="px-6 py-1 rounded-xl bg-zinc-900 text-xs text-zinc-400 font-mono border border-white/5 tracking-wide">
              draftboard.dev/canvas/system-architecture
            </div>
            <div className="flex gap-1.5 opacity-40">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            </div>
          </div>

          {/* Workspace Mockup Window */}
          <div className="relative w-full h-[520px] bg-[#09090b] rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center shadow-inner select-none">
            {/* Center-Top Floating Pill Toolbar Preview */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1.5 bg-zinc-900/90 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl z-20">
              <span className="p-2 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30">
                <MousePointer size={15} />
              </span>
              <span className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200">
                <Hand size={15} />
              </span>
              <div className="w-[1px] h-5 bg-white/10" />
              <span className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200">
                <RectangleHorizontalIcon size={15} />
              </span>
              <span className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200">
                <Diamond size={15} />
              </span>
              <span className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200">
                <Circle size={15} />
              </span>
              <span className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200">
                <ArrowRight size={15} />
              </span>
              <span className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200">
                <Minus size={15} />
              </span>
              <div className="w-[1px] h-5 bg-white/10" />
              <span className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200">
                <PencilLine size={15} />
              </span>
              <span className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200">
                <Type size={15} />
              </span>
              <span className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200">
                <Eraser size={15} />
              </span>
              <div className="w-[1px] h-5 bg-white/10" />
              <span className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200">
                <Undo2 size={15} />
              </span>
              <span className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200">
                <Redo2 size={15} />
              </span>
              <span className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200">
                <Download size={15} />
              </span>
            </div>

            {/* Left Properties Panel Preview */}
            <div className="absolute left-4 top-16 w-56 bg-zinc-900/90 border border-white/10 rounded-2xl p-3 text-left shadow-2xl backdrop-blur-xl z-20 flex flex-col gap-3 text-xs">
              <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
                <span className="font-bold uppercase tracking-wider text-[10px] text-zinc-400">
                  Properties
                </span>
                <span className="text-[9px] font-mono uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded-full">
                  Diamond
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-400 font-medium">Stroke Swatches</span>
                <div className="flex gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-white ring-2 ring-indigo-500" />
                  <span className="w-4 h-4 rounded-full bg-rose-500 opacity-80" />
                  <span className="w-4 h-4 rounded-full bg-emerald-500 opacity-80" />
                  <span className="w-4 h-4 rounded-full bg-amber-500 opacity-80" />
                  <span className="w-4 h-4 rounded-full bg-purple-500 opacity-80" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-400 font-medium">Fill Style</span>
                <div className="grid grid-cols-3 gap-1 text-[9px] font-semibold text-center">
                  <span className="bg-indigo-600/30 border border-indigo-500 text-indigo-300 py-1 rounded-lg">Solid</span>
                  <span className="bg-zinc-800 border border-white/5 text-zinc-400 py-1 rounded-lg">Hatch</span>
                  <span className="bg-zinc-800 border border-white/5 text-zinc-400 py-1 rounded-lg">Cross</span>
                </div>
              </div>
            </div>

            {/* Vector Diagram Graphic */}
            <div className="relative border-2 border-dashed border-indigo-500/40 rounded-3xl p-8 bg-indigo-500/[0.02] shadow-2xl backdrop-blur-sm max-w-md w-full mx-4">
              <span className="absolute -top-3 left-6 px-3 py-0.5 bg-indigo-600 text-[10px] font-mono rounded-full text-white tracking-widest uppercase font-bold shadow-md">
                Distributed Canvas Node
              </span>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="border border-white/10 bg-zinc-900/90 p-3.5 rounded-2xl shadow-xl transition-transform hover:-translate-y-1 duration-300">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mb-2 mx-auto animate-ping" />
                  <p className="font-mono text-xs font-bold text-zinc-200">
                    WebSocket
                  </p>
                </div>
                <div className="border border-white/10 bg-zinc-900/90 p-3.5 rounded-2xl shadow-xl transition-transform hover:-translate-y-1 duration-300 flex flex-col justify-center items-center">
                  <Move className="w-4 h-4 text-purple-400 mb-1" />
                  <p className="font-mono text-xs font-bold text-zinc-200">
                    RoughJS
                  </p>
                </div>
                <div className="border border-white/10 bg-zinc-900/90 p-3.5 rounded-2xl shadow-xl transition-transform hover:-translate-y-1 duration-300">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 mb-2 mx-auto" />
                  <p className="font-mono text-xs font-bold text-zinc-200">
                    Vector 2D
                  </p>
                </div>
              </div>
            </div>

            {/* Remote Cursors Simulation */}
            <div className="absolute top-1/4 right-1/4 flex items-center gap-2 pointer-events-none animate-bounce">
              <MousePointer className="w-5 h-5 text-pink-500 fill-pink-500 transform rotate-90" />
              <span className="bg-pink-500 text-white font-mono text-[10px] px-2.5 py-0.5 rounded-full shadow-lg font-bold">
                Sarah_Designer
              </span>
            </div>
            <div className="absolute bottom-1/4 left-1/3 flex items-center gap-2 pointer-events-none">
              <MousePointer className="w-5 h-5 text-emerald-400 fill-emerald-400 transform rotate-90" />
              <span className="bg-emerald-500 text-white font-mono text-[10px] px-2.5 py-0.5 rounded-full shadow-lg font-bold">
                Alex_Architect
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Features Grid */}
      <section
        id="features"
        className="max-w-7xl mx-auto px-6 py-28 border-t border-white/10"
      >
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            Built for velocity. Engineered for perfection.
          </h2>
          <p className="mt-4 text-lg text-slate-400 font-normal">
            Every component crafted with precision for non-stop creative flow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="relative group overflow-hidden border border-white/10 bg-zinc-900/40 rounded-3xl p-8 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10">
            <div className="p-3.5 rounded-2xl bg-indigo-500/10 text-indigo-400 w-fit mb-6 ring-1 ring-indigo-500/20">
              <Share2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Real-Time Sync
            </h3>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed font-normal">
              Sub-10ms WebSocket presence stream. Draw with team members live with cursor indicators and state synchronization.
            </p>
          </div>

          <div className="relative group overflow-hidden border border-white/10 bg-zinc-900/40 rounded-3xl p-8 hover:border-purple-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10">
            <div className="p-3.5 rounded-2xl bg-purple-500/10 text-purple-400 w-fit mb-6 ring-1 ring-purple-500/20">
              <PencilLine className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              RoughJS Aesthetic
            </h3>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed font-normal">
              Hand-drawn sloppy sketch engine or crisp clean vector lines. Express architectural concepts with organic charm.
            </p>
          </div>

          <div className="relative group overflow-hidden border border-white/10 bg-zinc-900/40 rounded-3xl p-8 hover:border-pink-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-pink-500/10">
            <div className="p-3.5 rounded-2xl bg-pink-500/10 text-pink-400 w-fit mb-6 ring-1 ring-pink-500/20">
              <Palette className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Left Properties Inspector
            </h3>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed font-normal">
              Fine-tune stroke colors, solid/hatch fill styles, stroke thickness, opacity, and layer z-index order effortlessly.
            </p>
          </div>

          <div className="relative group overflow-hidden border border-white/10 bg-zinc-900/40 rounded-3xl p-8 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-400 w-fit mb-6 ring-1 ring-emerald-500/20">
              <Move className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Infinite Canvas & Hand Pan
            </h3>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed font-normal">
              Pan effortlessly across an unbounded canvas using the dedicated Hand tool or Spacebar drag.
            </p>
          </div>

          <div className="relative group overflow-hidden border border-white/10 bg-zinc-900/40 rounded-3xl p-8 hover:border-amber-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/10">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-400 w-fit mb-6 ring-1 ring-amber-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Single-Key Tool Shortcuts
            </h3>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed font-normal">
              Switch tools instantly using keyboard shortcuts (V, H, R, D, E, A, L, P, T, X) without touching the mouse.
            </p>
          </div>

          <div className="relative group overflow-hidden border border-white/10 bg-zinc-900/40 rounded-3xl p-8 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/10">
            <div className="p-3.5 rounded-2xl bg-cyan-500/10 text-cyan-400 w-fit mb-6 ring-1 ring-cyan-500/20">
              <Download className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              One-Click PNG Export
            </h3>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed font-normal">
              Export your diagrams and vector boards to high-resolution PNG image files with crisp transparent canvas rendering.
            </p>
          </div>
        </div>
      </section>

      {/* Architecture Specifications */}
      <section id="architecture" className="bg-zinc-950/60 border-y border-white/10 py-16 px-6 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-10 items-center justify-around text-slate-400 font-mono text-xs tracking-wider uppercase">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Sub-10ms Input Latency</span>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
            <span>Zero-Dependency HTML5 Canvas</span>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
            <span>RoughJS Vector Graphics</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 text-center text-xs text-slate-500 tracking-wide border-t border-white/5">
        <p>
          © {year} DraftBoard. Engineered for modern web whiteboard workflows.
        </p>
      </footer>
    </div>
  );
}

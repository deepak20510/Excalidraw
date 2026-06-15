"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowRight,
  Sparkles,
  PencilLine,
  Share2,
  Layers,
  Shield,
  MousePointer,
  Laptop,
  Grid3X3,
  Zap,
  Move,
} from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  const [year, setYear] = useState("");

  useEffect(() => {
    setYear(new Date().getFullYear().toString());
  }, []);

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden relative">
      {/* Decorative Grid & Radial Background Glows */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-20 right-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/[0.06] bg-[#030712]/60 px-6 py-4 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-bold text-xl tracking-tight group cursor-pointer">
            <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-1.5 rounded-lg shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <PencilLine className="w-5 h-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              DraftBoard
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a
              href="#features"
              className="hover:text-white transition-colors relative after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 hover:after:w-full after:bg-indigo-400 after:transition-all"
            >
              Features
            </a>
            <a
              href="#canvas"
              className="hover:text-white transition-colors relative after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 hover:after:w-full after:bg-indigo-400 after:transition-all"
            >
              Canvas
            </a>
            <a
              href="#security"
              className="hover:text-white transition-colors relative after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 hover:after:w-full after:bg-indigo-400 after:transition-all"
            >
              Security
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link href={"/signup"}>
              <button className="relative inline-flex items-center justify-center p-0.5 overflow-hidden text-sm font-medium rounded-xl group bg-gradient-to-br from-indigo-500 to-purple-500 group-hover:from-indigo-500 group-hover:to-purple-500 text-white focus:ring-2 focus:outline-none focus:ring-indigo-800 transition-all active:scale-95">
                <span className="relative px-5 py-2 transition-all ease-in duration-75 bg-slate-950 rounded-xl group-hover:bg-opacity-0 font-semibold">
                  Register
                </span>
              </button>
            </Link>
            <Link href={"/signin"}>
              <button className="relative inline-flex items-center justify-center p-0.5 overflow-hidden text-sm font-medium rounded-xl group bg-gradient-to-br from-indigo-500 to-purple-500 group-hover:from-indigo-500 group-hover:to-purple-500 text-white focus:ring-2 focus:outline-none focus:ring-indigo-800 transition-all active:scale-95">
                <span className="relative px-5 py-2 transition-all ease-in duration-75 bg-slate-950 rounded-xl group-hover:bg-opacity-0 font-semibold">
                  Login
                </span>
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative max-w-7xl mx-auto px-6 pt-28 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-xs font-semibold text-indigo-300 mb-8 backdrop-blur-md shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>The Virtual Canvas, Elevated</span>
        </div>

        <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-white max-w-4xl mx-auto leading-[1.1]">
          Where raw ideation meets <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-sm">
            pixel-perfect design.
          </span>
        </h1>

        <p className="mt-8 text-xl text-slate-400 max-w-2xl mx-auto font-normal leading-relaxed">
          A beautifully minimal, hyper-fluid workspace. Draw hand-styled
          architecture setups, interface designs, and workflows instantly.
        </p>

        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-95 text-white font-bold px-8 py-4 rounded-xl transition-all shadow-xl shadow-indigo-500/20 active:scale-[0.98]">
            Start Whiteboarding
            <ArrowRight className="w-5 h-5" />
          </button>
          <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900/60 hover:bg-slate-900 border border-white/[0.08] hover:border-white/[0.15] text-slate-200 font-semibold px-8 py-4 rounded-xl transition-all backdrop-blur-sm">
            Explore Features
          </button>
        </div>

        {/* Dynamic App Preview Mockup */}
        <div className="mt-24 relative rounded-2xl border border-white/[0.08] bg-slate-900/20 p-3 shadow-2xl backdrop-blur-xl overflow-hidden max-w-5xl mx-auto">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/[0.03] via-transparent to-purple-500/[0.03] pointer-events-none" />

          {/* Mockup Window Header */}
          <div className="flex items-center justify-between pb-3 px-3 border-b border-white/[0.06] mb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/60" />
              <span className="w-3 h-3 rounded-full bg-amber-500/60" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/60" />
            </div>
            <div className="px-6 py-1 rounded-lg bg-slate-950/80 text-xs text-slate-400 font-mono border border-white/[0.05] tracking-wide">
              draftboard.dev/canvas/new
            </div>
            <div className="flex gap-1.5 opacity-40">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            </div>
          </div>

          {/* Interactive Workspace Graphic */}
          <div className="relative w-full h-[500px] bg-[#050b18] rounded-xl border border-white/[0.04] overflow-hidden flex items-center justify-center pattern-grid shadow-inner">
            {/* Canvas floating control panel */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-1.5 p-1.5 bg-slate-900/90 border border-white/[0.08] rounded-xl shadow-2xl backdrop-blur-md">
              <span className="p-2.5 rounded-lg bg-indigo-500 text-white shadow-lg shadow-indigo-500/30">
                <MousePointer className="w-4 h-4" />
              </span>
              <span className="p-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors">
                <PencilLine className="w-4 h-4" />
              </span>
              <span className="p-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors">
                <Layers className="w-4 h-4" />
              </span>
              <span className="p-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors">
                <Grid3X3 className="w-4 h-4" />
              </span>
            </div>

            {/* Simulated Vector Sketch Elements */}
            <div className="relative border-2 border-dashed border-indigo-400/50 rounded-2xl p-8 transform -rotate-1 bg-indigo-500/[0.02] shadow-2xl backdrop-blur-sm max-w-lg w-full mx-4">
              <span className="absolute -top-3 left-4 px-2 py-0.5 bg-indigo-500 text-[10px] font-mono rounded text-white tracking-widest uppercase">
                Frontend Sync
              </span>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="border border-white/10 bg-slate-900/80 p-3 rounded-xl shadow-lg transition-transform hover:-translate-y-0.5 duration-300">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 mb-2 mx-auto animate-ping" />
                  <p className="font-mono text-[11px] font-semibold text-slate-200">
                    React Core
                  </p>
                </div>
                <div className="border border-white/10 bg-slate-900/80 p-3 rounded-xl shadow-lg transition-transform hover:-translate-y-0.5 duration-300 flex flex-col justify-center items-center">
                  <Move className="w-3 h-3 text-purple-400 mb-1.5" />
                  <p className="font-mono text-[11px] font-semibold text-slate-200">
                    Engine
                  </p>
                </div>
                <div className="border border-white/10 bg-slate-900/80 p-3 rounded-xl shadow-lg transition-transform hover:-translate-y-0.5 duration-300">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 mb-2 mx-auto" />
                  <p className="font-mono text-[11px] font-semibold text-slate-200">
                    Tailwind
                  </p>
                </div>
              </div>
            </div>

            {/* Fake Cursor Layer */}
            <div className="absolute top-1/3 right-1/4 flex items-center gap-2 pointer-events-none animate-bounce">
              <MousePointer className="w-5 h-5 text-pink-500 fill-pink-500 transform rotate-90" />
              <span className="bg-pink-500 text-white font-mono text-[10px] px-2 py-0.5 rounded-full shadow-lg font-bold">
                Sarah_Dev
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Features Grid */}
      <section
        id="features"
        className="max-w-7xl mx-auto px-6 py-32 border-t border-white/[0.04]"
      >
        <div className="text-center max-w-2xl mx-auto mb-20">
          <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Built for velocity. Engineered for design.
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            A precise feature-set packaged in an incredibly intuitive user flow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="relative group overflow-hidden border border-white/[0.06] bg-slate-900/[0.15] rounded-2xl p-8 hover:border-white/[0.12] transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/5">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
            <div className="p-3.5 rounded-xl bg-indigo-500/10 text-indigo-400 w-fit mb-6 ring-1 ring-indigo-500/20">
              <Share2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Real-Time Sync
            </h3>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed font-normal">
              Zero-latency collaboration protocols. Share workspace assets
              effortlessly with fluid, real-time indicator streams.
            </p>
          </div>

          <div className="relative group overflow-hidden border border-white/[0.06] bg-slate-900/[0.15] rounded-2xl p-8 hover:border-white/[0.12] transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/5">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-500/10 transition-colors" />
            <div className="p-3.5 rounded-xl bg-purple-500/10 text-purple-400 w-fit mb-6 ring-1 ring-purple-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Infinite Vector Scaling
            </h3>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed font-normal">
              An unbound whiteboard interface optimized for complex layouts.
              Seamless exports to production-grade asset targets.
            </p>
          </div>

          <div className="relative group overflow-hidden border border-white/[0.06] bg-slate-900/[0.15] rounded-2xl p-8 hover:border-white/[0.12] transition-all duration-300 hover:shadow-2xl hover:shadow-pink-500/5">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-pink-500/10 transition-colors" />
            <div className="p-3.5 rounded-xl bg-pink-500/10 text-pink-400 w-fit mb-6 ring-1 ring-pink-500/20">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Isolated Execution
            </h3>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed font-normal">
              Local-first data management strategies guarantee full authority
              and enterprise confidentiality over production assets.
            </p>
          </div>
        </div>
      </section>

      {/* Tech Specifications Badge Panel */}
      <section className="bg-white/[0.01] border-y border-white/[0.04] py-14 px-6 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-10 items-center justify-around text-slate-400 font-mono text-xs tracking-wider uppercase">
          <div className="flex items-center gap-2.5">
            <Laptop className="w-4 h-4 text-indigo-400" /> Local Storage Layer
          </div>
          <div className="flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-amber-400" /> Sub-10ms Input Handling
          </div>
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-purple-400" /> Fully Custom Engine
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-14 text-center text-xs text-slate-500 tracking-wide border-t border-white/[0.03]">
        <p>
          © {year} DraftBoard. Engineered with modern framework architectures.
        </p>
      </footer>
    </div>
  );
}

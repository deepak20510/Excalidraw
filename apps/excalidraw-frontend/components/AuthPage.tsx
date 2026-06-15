"use client";

import React, { useState } from "react";
import { PencilLine, Sparkles, Mail, Lock, ArrowRight } from "lucide-react";

export function AuthPage({ isSignin }: { isSignin: boolean }) {
  return (
    <div className="w-screen h-screen flex justify-center items-center bg-[#030712] text-slate-100 font-sans relative overflow-hidden">
      {/* Decorative Grid & Radial Background Glows */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Auth Card Container */}
      <div className="relative w-full max-w-md mx-4 p-8 bg-slate-900/20 border border-white/[0.06] rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/[0.02] via-transparent to-purple-500/[0.02] pointer-events-none" />

        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 font-bold text-xl tracking-tight mb-3">
            <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-1.5 rounded-lg shadow-lg shadow-indigo-500/20">
              <PencilLine className="w-5 h-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              DraftBoard
            </span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            {isSignin ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {isSignin
              ? "Enter your credentials to access your canvas"
              : "Get started with your infinite virtual whiteboard"}
          </p>
        </div>

        {/* Form Elements */}
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Email"
              className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-white/[0.06] focus:border-indigo-500/50 rounded-xl text-sm placeholder-slate-500 text-slate-200 outline-none transition-all focus:ring-2 focus:ring-indigo-500/10 tracking-wide"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Lock className="w-4 h-4" />
            </div>
            <input
              placeholder="Password"
              type="password"
              className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-white/[0.06] focus:border-indigo-500/50 rounded-xl text-sm placeholder-slate-500 text-slate-200 outline-none transition-all focus:ring-2 focus:ring-indigo-500/10 tracking-wide"
            />
          </div>

          {isSignin && (
            <div className="text-right">
              <a href="#" className="text-xs text-indigo-400 hover:underline">
                Forgot password?
              </a>
            </div>
          )}

          <button
            onClick={() => {}}
            className="w-full flex items-center justify-center gap-2 mt-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-95 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-xl shadow-indigo-500/10 active:scale-[0.99] text-sm"
          >
            {isSignin ? "Sign in" : "Sign up"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Footer Link */}
        <div className="mt-6 text-center text-xs text-slate-500">
          {isSignin ? (
            <p>
              Don't have an account?{" "}
              <a
                href="#"
                className="text-indigo-400 font-medium hover:underline"
              >
                Sign up
              </a>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <a
                href="#"
                className="text-indigo-400 font-medium hover:underline"
              >
                Sign in
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

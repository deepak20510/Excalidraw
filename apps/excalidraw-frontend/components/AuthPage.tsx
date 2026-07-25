"use client";

import React, { useState } from "react";
import {
  PencilLine,
  Mail,
  Lock,
  ArrowRight,
  User,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { HTTP_BACKEND } from "@/config";

type ErrorResponse = {
  message?: string;
};

export function AuthPage({ isSignin }: { isSignin: boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (overrideEmail?: string, overridePass?: string) => {
    setError("");
    const emailToUse = overrideEmail || username;
    const passToUse = overridePass || password;

    if (!emailToUse || !passToUse || (!isSignin && !name && !overrideEmail)) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      if (isSignin) {
        const res = await axios.post(`${HTTP_BACKEND}/signin`, {
          username: emailToUse,
          password: passToUse,
        });
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("userEmail", emailToUse);
        router.push("/");
      } else {
        await axios.post(`${HTTP_BACKEND}/signup`, {
          username: emailToUse,
          password: passToUse,
          name: name || "User",
        });
        localStorage.setItem("userEmail", emailToUse);
        if (name) localStorage.setItem("userName", name);
        router.push("/signin");
      }
    } catch (err: unknown) {
      setError(
        axios.isAxiosError<ErrorResponse>(err)
          ? err.response?.data?.message ||
              "An error occurred. Please check your credentials and try again."
          : "An error occurred. Please check your credentials and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen flex justify-center items-center bg-[#030712] text-slate-100 font-sans relative overflow-hidden select-none">
      {/* Decorative Grid & Dynamic Radial Glows */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/3 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[140px] pointer-events-none animate-pulse" />

      {/* Auth Card Container */}
      <div className="relative w-full max-w-md mx-4 p-8 bg-zinc-900/80 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        {/* Logo Header */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 font-bold text-xl tracking-tight mb-4 group cursor-pointer"
          >
            <div className="bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-2 rounded-xl shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-200">
              <PencilLine className="w-5 h-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent font-black tracking-tight text-2xl">
              DraftBoard
            </span>
          </Link>
          <h2 className="text-2xl font-black tracking-tight text-white mt-1">
            {isSignin ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="mt-1.5 text-xs text-zinc-400 font-normal">
            {isSignin
              ? "Access your infinite whiteboard workspace"
              : "Start collaborating in real-time within seconds"}
          </p>
        </div>

        {/* Form Switcher Tabs */}
        <div className="flex bg-zinc-950/80 p-1 rounded-2xl border border-white/5 mb-6 text-xs font-semibold">
          <Link
            href="/signin"
            className={`flex-1 py-2 rounded-xl text-center transition-all ${
              isSignin
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20 font-bold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className={`flex-1 py-2 rounded-xl text-center transition-all ${
              !isSignin
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20 font-bold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Register
          </Link>
        </div>

        {/* Form Inputs */}
        <div className="space-y-4">
          {!isSignin && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="w-full pl-10 pr-4 py-3 bg-zinc-950/70 border border-white/10 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 rounded-2xl text-sm placeholder-zinc-500 text-zinc-100 outline-none transition-all"
              />
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Email address"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="w-full pl-10 pr-4 py-3 bg-zinc-950/70 border border-white/10 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 rounded-2xl text-sm placeholder-zinc-500 text-zinc-100 outline-none transition-all"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="w-full pl-10 pr-10 py-3 bg-zinc-950/70 border border-white/10 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 rounded-2xl text-sm placeholder-zinc-500 text-zinc-100 outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>

          {error && (
            <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-3 rounded-2xl animate-fade-in flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={() => handleSubmit()}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 mt-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-95 text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-xl shadow-indigo-500/20 active:scale-[0.98] text-sm cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              <>
                <span>{isSignin ? "Sign In to Workspace" : "Create Free Account"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Benefits list */}
        <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Real-time WS Sync</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Vector Canvas</span>
          </div>
        </div>
      </div>
    </div>
  );
}

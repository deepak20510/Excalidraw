"use client";

import { useEffect, useRef, useState } from "react";
import rough from "roughjs";

interface AnimatedSplashProps {
  isReady: boolean;
  connectionError?: string;
  onFinish: () => void;
}

// Points for the wavy pencil curve
const SCRIBBLE_POINTS = [
  { x: 150, y: 280 },
  { x: 200, y: 310 },
  { x: 250, y: 270 },
  { x: 300, y: 300 },
  { x: 350, y: 260 },
  { x: 400, y: 290 },
  { x: 450, y: 270 },
];

export function AnimatedSplash({ isReady, connectionError, onFinish }: AnimatedSplashProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState(0); // 0: Rect, 1: Circle, 2: Arrow, 3: Scribble, 4: Text, 5: Finished
  const [progress, setProgress] = useState(0); // 0 to 1 within each stage
  const [fadeOut, setFadeOut] = useState(false);

  // Run the animation loop
  useEffect(() => {
    let animationFrameId: number;
    const durationPerStage = [600, 600, 500, 600, 800]; // milliseconds for each stage
    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;

      if (stage < 5) {
        const currentDuration = durationPerStage[stage] || 500;
        const currentProgress = Math.min(elapsed / currentDuration, 1);
        setProgress(currentProgress);

        if (currentProgress >= 1) {
          startTime = null;
          setStage((prev) => prev + 1);
          setProgress(0);
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [stage]);

  // Render the shapes onto the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Reset canvas transform and clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Deep dark background for splash canvas
    ctx.fillStyle = "rgba(10, 10, 15, 0.95)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const rc = rough.canvas(canvas);

    // Style helper options
    const rectOptions = { stroke: "#818cf8", strokeWidth: 2.5, roughness: 1.2, fillStyle: "solid" };
    const circleOptions = { stroke: "#f472b6", strokeWidth: 2.5, roughness: 1.5 };
    const arrowOptions = { stroke: "#fbbf24", strokeWidth: 2.5, roughness: 1.0 };
    const scribbleOptions = { stroke: "#10b981", strokeWidth: 2.2, roughness: 1.8 };
    const textUnderlineOptions = { stroke: "#a78bfa", strokeWidth: 2.0, roughness: 1.4 };

    // --- STAGE 0: RECTANGLE (Client Block) ---
    if (stage >= 0) {
      const rx = 140;
      const ry = 130;
      const rw = 120;
      const rh = 80;

      const p = stage === 0 ? progress : 1;
      
      // Calculate borders progressively
      // Segments: 1 (top), 2 (right), 3 (bottom), 4 (left)
      const totalLen = rw * 2 + rh * 2;
      const currentLen = totalLen * p;

      ctx.save();
      if (currentLen > 0) {
        const lines: [number, number, number, number][] = [];
        
        // Top line
        if (currentLen <= rw) {
          lines.push([rx, ry, rx + currentLen, ry]);
        } else {
          lines.push([rx, ry, rx + rw, ry]);
          
          // Right line
          const rLen = currentLen - rw;
          if (rLen <= rh) {
            lines.push([rx + rw, ry, rx + rw, ry + rLen]);
          } else {
            lines.push([rx + rw, ry, rx + rw, ry + rh]);
            
            // Bottom line
            const bLen = rLen - rh;
            if (bLen <= rw) {
              lines.push([rx + rw, ry + rh, rx + rw - bLen, ry + rh]);
            } else {
              lines.push([rx + rw, ry + rh, rx, ry + rh]);
              
              // Left line
              const lLen = bLen - rw;
              lines.push([rx, ry + rh, rx, ry + rh - Math.min(lLen, rh)]);
            }
          }
        }

        lines.forEach(([x1, y1, x2, y2]) => {
          rc.line(x1, y1, x2, y2, rectOptions);
        });
      }
      ctx.restore();
    }

    // --- STAGE 1: CIRCLE (Server Block) ---
    if (stage >= 1) {
      const cx = 450;
      const cy = 170;
      const r = 40;
      const p = stage === 1 ? progress : 1;

      if (p > 0) {
        // Draw progressive sketchy arc using RoughJS arc
        // roughjs arc parameters: (x, y, width, height, startAngle, stopAngle, closed, options)
        rc.arc(cx, cy, r * 2, r * 2, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * p, false, circleOptions);
      }
    }

    // --- STAGE 2: ARROW (Connection Line) ---
    if (stage >= 2) {
      const ax1 = 280;
      const ay1 = 170;
      const ax2 = 390;
      const ay2 = 170;
      const p = stage === 2 ? progress : 1;

      if (p > 0) {
        const currX = ax1 + (ax2 - ax1) * p;
        const currY = ay1 + (ay2 - ay1) * p;
        rc.line(ax1, ay1, currX, currY, arrowOptions);

        // Draw arrow wings when arrow line is almost complete
        if (p >= 0.8) {
          const wingP = (p - 0.8) / 0.2;
          const headLength = 12 * wingP;
          const angle = Math.atan2(ay2 - ay1, ax2 - ax1);
          
          const w1x = currX - headLength * Math.cos(angle - Math.PI / 6);
          const w1y = currY - headLength * Math.sin(angle - Math.PI / 6);
          const w2x = currX - headLength * Math.cos(angle + Math.PI / 6);
          const w2y = currY - headLength * Math.sin(angle + Math.PI / 6);

          rc.line(currX, currY, w1x, w1y, arrowOptions);
          rc.line(currX, currY, w2x, w2y, arrowOptions);
        }
      }
    }

    // --- STAGE 3: SCRIBBLING (Data / Wavy flow) ---
    if (stage >= 3) {
      const p = stage === 3 ? progress : 1;
      const ptsCount = Math.max(2, Math.floor(SCRIBBLE_POINTS.length * p));
      const activePts = SCRIBBLE_POINTS.slice(0, ptsCount);

      if (activePts.length >= 2) {
        const rawPts = activePts.map((pt) => [pt.x, pt.y] as [number, number]);
        rc.curve(rawPts, scribbleOptions);
      }
    }

    // --- STAGE 4: TEXT ("DraftBoard" title & underline) ---
    if (stage >= 4) {
      const p = stage === 4 ? progress : 1;
      const text = "DraftBoard";
      const lettersCount = Math.floor(text.length * p);
      const visibleText = text.substring(0, lettersCount);

      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      // Use clean font with hand-drawn vibes
      ctx.font = "bold 32px var(--font-sans)";
      ctx.textAlign = "center";
      ctx.fillText(visibleText, 300, 390);

      // Underline animation
      if (p > 0.6) {
        const underlineP = (p - 0.6) / 0.4;
        const ux1 = 200;
        const ux2 = 200 + 200 * underlineP;
        const uy = 405;
        rc.line(ux1, uy, ux2, uy, textUnderlineOptions);
      }
      ctx.restore();
    }
  }, [stage, progress]);

  // Handle the transitions when canvas shapes and WebSocket are both ready
  useEffect(() => {
    if (stage >= 5 && isReady) {
      // Trigger the fadeOut CSS transition
      setFadeOut(true);
      const timer = setTimeout(() => {
        onFinish();
      }, 500); // matches the opacity transition duration
      return () => clearTimeout(timer);
    }
  }, [stage, isReady, onFinish]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#030712",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 100,
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.5s ease-in-out",
        overflow: "hidden",
      }}
    >
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none" />

      <div
        style={{
          background: "rgba(15, 15, 25, 0.6)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 24,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
          width: "90%",
          maxWidth: 650,
        }}
      >
        <canvas
          ref={canvasRef}
          width={600}
          height={480}
          style={{
            width: "100%",
            height: "auto",
            aspectRatio: "600/480",
            borderRadius: 16,
            background: "rgba(10, 10, 15, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
          }}
        />

        {/* Action Status Indicator */}
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          {connectionError ? (
            <span style={{ color: "#f87171", fontSize: 14, fontWeight: 500 }} className="text-center">
              {connectionError}
            </span>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: isReady ? "#10b981" : "#fbbf24",
                  animation: "pulse 1.5s infinite",
                }}
              />
              <span
                style={{
                  color: "rgba(255, 255, 255, 0.6)",
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: "monospace",
                  letterSpacing: "0.05em",
                }}
              >
                {stage < 5 ? "INITIALIZING CANVAS..." : isReady ? "SUCCESSFULLY CONNECTED!" : "JOINING WHITEBOARD..."}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

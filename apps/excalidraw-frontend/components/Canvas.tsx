import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import {
  ArrowRight,
  Circle,
  Diamond,
  Download,
  Eraser,
  Hand,
  Maximize2,
  Minus,
  MousePointer2,
  Pencil,
  Plus,
  RectangleHorizontalIcon,
  Redo2,
  Type,
  Undo2,
} from "lucide-react";
import { Game, Shape } from "@/draw/Game";

export type Tool =
  | "select"
  | "hand"
  | "rect"
  | "diamond"
  | "circle" | "arrow"
  | "line"
  | "pencil"
  | "text"
  | "eraser";

export function Canvas({
  roomId,
  socket,
  onReady,
  userId,
  userName,
}: {
  socket: WebSocket;
  roomId: string;
  onReady?: () => void;
  userId?: string;
  userName?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game>();
  const [selectedTool, setSelectedTool] = useState<Tool>("rect");
  const [selectedShape, setSelectedShape] = useState<Shape | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  useEffect(() => {
    game?.setTool(selectedTool);
  }, [selectedTool, game]);

  useEffect(() => {
    if (canvasRef.current) {
      const g = new Game(
        canvasRef.current,
        roomId,
        socket,
        userId ?? "",
        userName ?? "User"
      );
      setGame(g);

      if (minimapRef.current) {
        g.registerMinimap(minimapRef.current);
      }

      g.initPromise.then(() => {
        onReady?.();
      });

      return () => {
        g.destroy();
      };
    }
  }, [canvasRef, roomId, socket, userId, userName, onReady]);

  useEffect(() => {
    if (game) {
      game.onSelectionChange = (shape) => {
        setSelectedShape(shape ? { ...shape } : null);
      };
      game.onZoomChange = (scale) => {
        setZoomLevel(Math.round(scale * 100));
      };
      game.onToolChange = (tool) => {
        setSelectedTool(tool);
      };
    }
  }, [game]);

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-[#09090b] select-none font-sans">
      <canvas
        ref={canvasRef}
        width={typeof window !== "undefined" ? window.innerWidth : 1280}
        height={typeof window !== "undefined" ? window.innerHeight : 720}
        className="block w-full h-full touch-none"
      />

      {/* Floating Center-Top Toolbar */}
      <Topbar
        setSelectedTool={setSelectedTool}
        selectedTool={selectedTool}
        game={game}
      />

      {/* Zoom Controls */}
      <ZoomControls
        zoomLevel={zoomLevel}
        onZoomIn={() => game?.zoomIn()}
        onZoomOut={() => game?.zoomOut()}
        onResetZoom={() => game?.resetZoom()}
        onFitToScreen={() => game?.fitToScreen()}
      />

      {/* Minimap */}
      <div className="fixed bottom-4 right-4 z-40 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-950/80 backdrop-blur-xl transition-all duration-200 hover:border-white/20">
        <canvas
          ref={minimapRef}
          width={200}
          height={140}
          className="cursor-crosshair block"
        />
      </div>

      {/* Shape Style Inspector */}
      {selectedShape && (
        <div className="fixed left-4 top-20 w-64 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 text-white shadow-2xl z-40 flex flex-col gap-4 animate-in fade-in slide-in-from-left-4 duration-200">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Shape Properties
            </h3>
            <span className="text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
              {selectedShape.type}
            </span>
          </div>

          {/* Stroke Color */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-zinc-400">
              Stroke Color
            </span>
            <div className="flex items-center gap-2">
              {["#ffffff", "#ef4444", "#22c55e", "#3b82f6", "#eab308", "#a855f7"].map((c) => (
                <button
                  key={c}
                  onClick={() =>
                    game?.updateSelectedShapeStyle({ strokeColor: c })
                  }
                  className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${
                    (selectedShape.style?.strokeColor || "#ffffff") === c
                      ? "ring-2 ring-indigo-500 scale-110 border-white"
                      : "border-white/20"
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={selectedShape.style?.strokeColor || "#ffffff"}
                onChange={(e) =>
                  game?.updateSelectedShapeStyle({ strokeColor: e.target.value })
                }
                className="w-6 h-6 rounded-lg bg-transparent border-0 cursor-pointer p-0"
              />
            </div>
          </div>

          {/* Fill Color */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-zinc-400">
              Background Fill
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  game?.updateSelectedShapeStyle({ fillColor: "transparent" })
                }
                className={`w-5 h-5 rounded-full border relative overflow-hidden transition-transform hover:scale-110 ${
                  (selectedShape.style?.fillColor || "transparent") ===
                  "transparent"
                    ? "ring-2 ring-indigo-500 scale-110 border-white"
                    : "border-white/20"
                }`}
                title="Transparent"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-red-500 to-transparent w-full h-[2px] top-1/2 -translate-y-1/2" />
              </button>
              {[
                "rgba(239, 68, 68, 0.3)",
                "rgba(34, 197, 94, 0.3)",
                "rgba(59, 130, 246, 0.3)",
                "rgba(234, 179, 8, 0.3)",
                "rgba(168, 85, 247, 0.3)",
              ].map((c) => (
                <button
                  key={c}
                  onClick={() =>
                    game?.updateSelectedShapeStyle({ fillColor: c })
                  }
                  className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${
                    (selectedShape.style?.fillColor || "transparent") === c
                      ? "ring-2 ring-indigo-500 scale-110 border-white"
                      : "border-white/20"
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={
                  selectedShape.style?.fillColor &&
                  selectedShape.style.fillColor !== "transparent"
                    ? selectedShape.style.fillColor
                    : "#000000"
                }
                onChange={(e) =>
                  game?.updateSelectedShapeStyle({ fillColor: e.target.value })
                }
                className="w-6 h-6 rounded-lg bg-transparent border-0 cursor-pointer p-0"
              />
            </div>
          </div>

          {/* Stroke Width */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[11px] font-semibold text-zinc-400">
              <span>Stroke Thickness</span>
              <span className="text-zinc-200 font-mono">
                {selectedShape.style?.strokeWidth ?? 2}px
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={selectedShape.style?.strokeWidth ?? 2}
              onChange={(e) =>
                game?.updateSelectedShapeStyle({
                  strokeWidth: Number(e.target.value),
                })
              }
              className="w-full accent-indigo-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Opacity */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[11px] font-semibold text-zinc-400">
              <span>Opacity</span>
              <span className="text-zinc-200 font-mono">
                {Math.round((selectedShape.style?.opacity ?? 1) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={selectedShape.style?.opacity ?? 1}
              onChange={(e) =>
                game?.updateSelectedShapeStyle({
                  opacity: Number(e.target.value),
                })
              }
              className="w-full accent-indigo-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Stroke Style */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-zinc-400">
              Stroke Pattern
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(["solid", "dashed", "dotted"] as const).map((s) => {
                const isSelected =
                  (selectedShape.style?.strokeStyle || "solid") === s;
                return (
                  <button
                    key={s}
                    onClick={() =>
                      game?.updateSelectedShapeStyle({ strokeStyle: s })
                    }
                    className={`py-1.5 text-[11px] font-medium rounded-lg capitalize border transition-all ${
                      isSelected
                        ? "bg-indigo-600/30 border-indigo-500 text-indigo-300"
                        : "bg-zinc-800/60 border-white/5 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Roughness */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-zinc-400">
              Sloppiness (Hand-drawn)
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: "Architect", val: 0 },
                { label: "Artist", val: 1 },
                { label: "Cartoon", val: 2 },
              ].map((r) => {
                const isSelected =
                  (selectedShape.style?.roughness ?? 0) === r.val;
                return (
                  <button
                    key={r.val}
                    onClick={() =>
                      game?.updateSelectedShapeStyle({ roughness: r.val })
                    }
                    className={`py-1.5 text-[11px] font-medium rounded-lg border transition-all ${
                      isSelected
                        ? "bg-indigo-600/30 border-indigo-500 text-indigo-300"
                        : "bg-zinc-800/60 border-white/5 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Topbar({
  selectedTool,
  setSelectedTool,
  game,
}: {
  selectedTool: Tool;
  setSelectedTool: (s: Tool) => void;
  game: Game | undefined;
}) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-zinc-900/90 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/80">
        {/* Selection & Pan */}
        <IconButton
          onClick={() => setSelectedTool("select")}
          activated={selectedTool === "select"}
          icon={<MousePointer2 size={16} />}
          label="Selection"
          shortcut="V"
        />
        <IconButton
          onClick={() => setSelectedTool("hand")}
          activated={selectedTool === "hand"}
          icon={<Hand size={16} />}
          label="Hand (Pan)"
          shortcut="H"
        />

        <div className="w-[1px] h-6 bg-white/10 mx-1" />

        {/* Shapes */}
        <IconButton
          onClick={() => setSelectedTool("rect")}
          activated={selectedTool === "rect"}
          icon={<RectangleHorizontalIcon size={16} />}
          label="Rectangle"
          shortcut="R"
        />
        <IconButton
          onClick={() => setSelectedTool("diamond")}
          activated={selectedTool === "diamond"}
          icon={<Diamond size={16} />}
          label="Diamond"
          shortcut="D"
        />
        <IconButton
          onClick={() => setSelectedTool("circle")}
          activated={selectedTool === "circle"}
          icon={<Circle size={16} />}
          label="Ellipse"
          shortcut="E"
        />
        <IconButton
          onClick={() => setSelectedTool("arrow")}
          activated={selectedTool === "arrow"}
          icon={<ArrowRight size={16} />}
          label="Arrow"
          shortcut="A"
        />
        <IconButton
          onClick={() => setSelectedTool("line")}
          activated={selectedTool === "line"}
          icon={<Minus size={16} />}
          label="Line"
          shortcut="L"
        />

        <div className="w-[1px] h-6 bg-white/10 mx-1" />

        {/* Freehand, Text & Eraser */}
        <IconButton
          onClick={() => setSelectedTool("pencil")}
          activated={selectedTool === "pencil"}
          icon={<Pencil size={16} />}
          label="Pencil"
          shortcut="P"
        />
        <IconButton
          onClick={() => setSelectedTool("text")}
          activated={selectedTool === "text"}
          icon={<Type size={16} />}
          label="Text"
          shortcut="T"
        />
        <IconButton
          onClick={() => setSelectedTool("eraser")}
          activated={selectedTool === "eraser"}
          icon={<Eraser size={16} />}
          label="Eraser"
          shortcut="X"
        />

        <div className="w-[1px] h-6 bg-white/10 mx-1" />

        {/* History & Export */}
        <IconButton
          onClick={() => game?.undo()}
          activated={false}
          icon={<Undo2 size={16} />}
          label="Undo"
          title="Undo (Ctrl+Z)"
        />
        <IconButton
          onClick={() => game?.redo()}
          activated={false}
          icon={<Redo2 size={16} />}
          label="Redo"
          title="Redo (Ctrl+Y)"
        />
        <IconButton
          onClick={() => game?.exportAsPNG()}
          activated={false}
          icon={<Download size={16} />}
          label="Export PNG"
        />
      </div>
    </div>
  );
}

function ZoomControls({
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToScreen,
}: {
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToScreen: () => void;
}) {
  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-1 p-1 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl">
      <button
        title="Zoom out"
        onClick={onZoomOut}
        className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-colors"
      >
        <Minus size={14} />
      </button>

      <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

      <button
        title="Reset zoom (100%)"
        onClick={onResetZoom}
        className="px-2 h-8 flex items-center justify-center rounded-xl text-xs font-mono font-semibold text-zinc-300 hover:text-zinc-100 hover:bg-white/10 transition-colors"
      >
        {zoomLevel}%
      </button>

      <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

      <button
        title="Zoom in"
        onClick={onZoomIn}
        className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-colors"
      >
        <Plus size={14} />
      </button>

      <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

      <button
        title="Fit all shapes to screen"
        onClick={onFitToScreen}
        className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-colors"
      >
        <Maximize2 size={14} />
      </button>
    </div>
  );
}
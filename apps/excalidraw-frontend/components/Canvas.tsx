import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
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
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { Game, Shape } from "@/draw/Game";

export type Tool =
  | "select"
  | "hand"
  | "rect"
  | "diamond"
  | "circle"
  | "arrow"
  | "line"
  | "pencil"
  | "text"
  | "eraser";

const STROKE_PRESETS = [
  "#ffffff",
  "#94a3b8",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

const FILL_PRESETS = [
  "rgba(239, 68, 68, 0.3)",
  "rgba(249, 115, 22, 0.3)",
  "rgba(234, 179, 8, 0.3)",
  "rgba(34, 197, 94, 0.3)",
  "rgba(59, 130, 246, 0.3)",
  "rgba(168, 85, 247, 0.3)",
];

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

      {/* Left-Side Properties Panel (Animates in when a shape is selected) */}
      {selectedShape && (
        <div className="fixed left-4 top-20 w-72 max-h-[calc(100vh-6rem)] overflow-y-auto bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 text-white shadow-2xl z-40 flex flex-col gap-4 animate-in fade-in slide-in-from-left-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Shape Properties
              </h3>
            </div>
            <span className="text-[10px] font-mono font-semibold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
              {selectedShape.type}
            </span>
          </div>

          {/* Stroke Color (10 Swatches + Custom Picker) */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-zinc-400">
              Stroke Color
            </span>
            <div className="grid grid-cols-6 gap-1.5 items-center">
              {STROKE_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() =>
                    game?.updateSelectedShapeStyle({ strokeColor: c })
                  }
                  className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 flex items-center justify-center ${
                    (selectedShape.style?.strokeColor || "#ffffff") === c
                      ? "ring-2 ring-indigo-500 scale-110 border-white"
                      : "border-white/20"
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              {/* Custom Color Input */}
              <label
                className="w-6 h-6 rounded-full border border-white/20 cursor-pointer overflow-hidden relative flex items-center justify-center bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 hover:scale-110 transition-transform"
                title="Custom color"
              >
                <input
                  type="color"
                  value={selectedShape.style?.strokeColor || "#ffffff"}
                  onChange={(e) =>
                    game?.updateSelectedShapeStyle({
                      strokeColor: e.target.value,
                    })
                  }
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Fill Color + Custom Picker */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-zinc-400">
              Fill Color
            </span>
            <div className="grid grid-cols-7 gap-1.5 items-center">
              {/* Transparent */}
              <button
                onClick={() =>
                  game?.updateSelectedShapeStyle({ fillColor: "transparent" })
                }
                className={`w-6 h-6 rounded-full border relative overflow-hidden transition-transform hover:scale-110 ${
                  (selectedShape.style?.fillColor || "transparent") ===
                  "transparent"
                    ? "ring-2 ring-indigo-500 scale-110 border-white"
                    : "border-white/20 bg-zinc-800"
                }`}
                title="Transparent fill"
              >
                <div className="absolute inset-0 bg-red-500/80 w-full h-[2px] top-1/2 -translate-y-1/2 rotate-45" />
              </button>

              {FILL_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() =>
                    game?.updateSelectedShapeStyle({ fillColor: c })
                  }
                  className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 ${
                    (selectedShape.style?.fillColor || "transparent") === c
                      ? "ring-2 ring-indigo-500 scale-110 border-white"
                      : "border-white/20"
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}

              {/* Custom Fill Color Input */}
              <label
                className="w-6 h-6 rounded-full border border-white/20 cursor-pointer overflow-hidden relative flex items-center justify-center bg-gradient-to-tr from-emerald-500 via-blue-500 to-purple-500 hover:scale-110 transition-transform"
                title="Custom fill color"
              >
                <input
                  type="color"
                  value={
                    selectedShape.style?.fillColor &&
                    selectedShape.style.fillColor !== "transparent"
                      ? selectedShape.style.fillColor
                      : "#000000"
                  }
                  onChange={(e) =>
                    game?.updateSelectedShapeStyle({
                      fillColor: e.target.value,
                    })
                  }
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Fill Style (Solid / Hatch / Cross-Hatch) */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-zinc-400">
              Fill Style
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: "Solid", val: "solid" },
                { label: "Hatch", val: "hatch" },
                { label: "Cross-Hatch", val: "cross-hatch" },
              ].map((style) => {
                const isSelected =
                  (selectedShape.style?.fillStyle || "solid") === style.val;
                return (
                  <button
                    key={style.val}
                    onClick={() =>
                      game?.updateSelectedShapeStyle({
                        fillStyle: style.val as "solid" | "hatch" | "cross-hatch",
                      })
                    }
                    className={`py-1.5 text-[11px] font-medium rounded-xl border transition-all ${
                      isSelected
                        ? "bg-indigo-600/30 border-indigo-500 text-indigo-300 font-semibold"
                        : "bg-zinc-800/60 border-white/5 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {style.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stroke Width (Thin / Normal / Bold) */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-[11px] font-semibold text-zinc-400">
              <span>Stroke Width</span>
              <span className="text-zinc-200 font-mono text-[10px]">
                {selectedShape.style?.strokeWidth ?? 2}px
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: "Thin", val: 2 },
                { label: "Normal", val: 4 },
                { label: "Bold", val: 6 },
              ].map((w) => {
                const isSelected =
                  (selectedShape.style?.strokeWidth ?? 2) === w.val;
                return (
                  <button
                    key={w.val}
                    onClick={() =>
                      game?.updateSelectedShapeStyle({ strokeWidth: w.val })
                    }
                    className={`py-1.5 text-[11px] font-medium rounded-xl border transition-all ${
                      isSelected
                        ? "bg-indigo-600/30 border-indigo-500 text-indigo-300 font-semibold"
                        : "bg-zinc-800/60 border-white/5 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stroke Style (Solid / Dashed / Dotted) */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-zinc-400">
              Stroke Style
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
                    className={`py-1.5 text-[11px] font-medium rounded-xl capitalize border transition-all ${
                      isSelected
                        ? "bg-indigo-600/30 border-indigo-500 text-indigo-300 font-semibold"
                        : "bg-zinc-800/60 border-white/5 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opacity Slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[11px] font-semibold text-zinc-400">
              <span>Opacity</span>
              <span className="text-zinc-200 font-mono text-[10px]">
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

          {/* Layer Controls */}
          <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
            <span className="text-[11px] font-semibold text-zinc-400">
              Layer Order
            </span>
            <div className="grid grid-cols-4 gap-1">
              <button
                onClick={() => game?.bringToFront()}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-800/60 hover:bg-white/10 border border-white/5 text-zinc-300 transition-colors text-[10px]"
                title="Bring to Front"
              >
                <ChevronsUp size={14} />
                <span className="mt-0.5 font-semibold">Front</span>
              </button>
              <button
                onClick={() => game?.bringForward()}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-800/60 hover:bg-white/10 border border-white/5 text-zinc-300 transition-colors text-[10px]"
                title="Bring Forward"
              >
                <ArrowUp size={14} />
                <span className="mt-0.5 font-semibold">Forward</span>
              </button>
              <button
                onClick={() => game?.sendBackward()}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-800/60 hover:bg-white/10 border border-white/5 text-zinc-300 transition-colors text-[10px]"
                title="Send Backward"
              >
                <ArrowDown size={14} />
                <span className="mt-0.5 font-semibold">Backward</span>
              </button>
              <button
                onClick={() => game?.sendToBack()}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-800/60 hover:bg-white/10 border border-white/5 text-zinc-300 transition-colors text-[10px]"
                title="Send to Back"
              >
                <ChevronsDown size={14} />
                <span className="mt-0.5 font-semibold">Back</span>
              </button>
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
        className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-colors cursor-pointer"
      >
        <Minus size={14} />
      </button>

      <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

      <button
        title="Reset zoom (100%)"
        onClick={onResetZoom}
        className="px-2 h-8 flex items-center justify-center rounded-xl text-xs font-mono font-semibold text-zinc-300 hover:text-zinc-100 hover:bg-white/10 transition-colors cursor-pointer"
      >
        {zoomLevel}%
      </button>

      <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

      <button
        title="Zoom in"
        onClick={onZoomIn}
        className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-colors cursor-pointer"
      >
        <Plus size={14} />
      </button>

      <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

      <button
        title="Fit all shapes to screen"
        onClick={onFitToScreen}
        className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-colors cursor-pointer"
      >
        <Maximize2 size={14} />
      </button>
    </div>
  );
}
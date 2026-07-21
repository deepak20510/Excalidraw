import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import { ArrowRight, Circle, Download, Eraser, Maximize2, Minus, MousePointer2, Pencil, Plus, RectangleHorizontalIcon, Type } from "lucide-react";
import { Game, Shape } from "@/draw/Game";

export type Tool = "circle" | "rect" | "pencil" | "select" | "eraser" | "line" | "arrow" | "text";

/** Decode a JWT payload without signature verification (client-side only) */
function decodeJwtPayload(token: string): { userId?: string } {
    try {
        const payloadBase64 = token.split(".")[1];
        if (!payloadBase64) return {};
        const json = atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"));
        return JSON.parse(json);
    } catch {
        return {};
    }
}

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
    const [selectedTool, setSelectedTool] = useState<Tool>("circle");
    const [selectedShape, setSelectedShape] = useState<Shape | null>(null);
    const [zoomLevel, setZoomLevel] = useState<number>(100);

    useEffect(() => {
        game?.setTool(selectedTool);
    }, [selectedTool, game]);

    useEffect(() => {
        if (canvasRef.current) {
            const g = new Game(canvasRef.current, roomId, socket, userId ?? "", userName ?? "User");
            setGame(g);

            // Register minimap canvas if already mounted
            if (minimapRef.current) {
                g.registerMinimap(minimapRef.current);
            }

            // Call onReady when the game's shapes initialization is complete
            g.initPromise.then(() => {
                onReady?.();
            });

            return () => {
                g.destroy();
            }
        }
    }, [canvasRef, onReady]);

    useEffect(() => {
        if (game) {
            game.onSelectionChange = (shape) => {
                // Ensure we get a fresh reference so React triggers a re-render
                setSelectedShape(shape ? { ...shape } : null);
            };
            game.onZoomChange = (scale) => {
                setZoomLevel(Math.round(scale * 100));
            };
        }
    }, [game]);

    return <div style={{
        height: "100vh",
        overflow: "hidden",
        position: "relative"
    }}>
        <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight}></canvas>
        <Topbar setSelectedTool={setSelectedTool} selectedTool={selectedTool} game={game} />

        {/* Zoom Controls */}
        <ZoomControls
            zoomLevel={zoomLevel}
            onZoomIn={() => game?.zoomIn()}
            onZoomOut={() => game?.zoomOut()}
            onResetZoom={() => game?.resetZoom()}
            onFitToScreen={() => game?.fitToScreen()}
        />

        {/* Minimap */}
        <canvas
            ref={minimapRef}
            width={200}
            height={140}
            style={{
                position: "fixed",
                bottom: 16,
                right: 16,
                width: 200,
                height: 140,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
                cursor: "crosshair",
                zIndex: 40,
                backdropFilter: "blur(8px)",
            }}
        />
        
        {/* Excalidraw styling panel */}
        {selectedShape && (
            <div style={{
                position: "fixed",
                left: 16,
                top: 76,
                width: 250,
                background: "rgba(24, 24, 27, 0.9)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 12,
                padding: 16,
                color: "white",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                zIndex: 50,
            }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(255, 255, 255, 0.8)", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: 8 }}>
                    Stroke Style
                </h3>

                {/* Stroke Color */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.5)", fontWeight: 500 }}>Stroke Color</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {["#ffffff", "#ef4444", "#22c55e", "#3b82f6", "#eab308"].map(c => (
                            <button
                                key={c}
                                onClick={() => game?.updateSelectedShapeStyle({ strokeColor: c })}
                                style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: "50%",
                                    background: c,
                                    border: (selectedShape.style?.strokeColor || "#ffffff") === c ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.2)",
                                    cursor: "pointer",
                                    padding: 0
                                }}
                            />
                        ))}
                        <input
                            type="color"
                            value={selectedShape.style?.strokeColor || "#ffffff"}
                            onChange={(e) => game?.updateSelectedShapeStyle({ strokeColor: e.target.value })}
                            style={{
                                width: 22,
                                height: 22,
                                border: "none",
                                padding: 0,
                                background: "none",
                                cursor: "pointer",
                            }}
                        />
                    </div>
                </div>

                {/* Background (Fill) Color */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.5)", fontWeight: 500 }}>Background Color</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button
                            onClick={() => game?.updateSelectedShapeStyle({ fillColor: "transparent" })}
                            style={{
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                background: "transparent",
                                border: (selectedShape.style?.fillColor || "transparent") === "transparent" ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.2)",
                                cursor: "pointer",
                                position: "relative",
                                overflow: "hidden",
                                padding: 0
                            }}
                        >
                            <span style={{
                                position: "absolute",
                                top: 0,
                                left: 8,
                                width: 2,
                                height: 20,
                                background: "#ef4444",
                                transform: "rotate(45deg)",
                            }} />
                        </button>
                        {["rgba(239, 68, 68, 0.3)", "rgba(34, 197, 94, 0.3)", "rgba(59, 130, 246, 0.3)", "rgba(234, 179, 8, 0.3)"].map(c => (
                            <button
                                key={c}
                                onClick={() => game?.updateSelectedShapeStyle({ fillColor: c })}
                                style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: "50%",
                                    background: c,
                                    border: (selectedShape.style?.fillColor || "transparent") === c ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.2)",
                                    cursor: "pointer",
                                    padding: 0
                                }}
                            />
                        ))}
                        <input
                            type="color"
                            value={selectedShape.style?.fillColor && selectedShape.style.fillColor !== "transparent" ? selectedShape.style.fillColor : "#000000"}
                            onChange={(e) => game?.updateSelectedShapeStyle({ fillColor: e.target.value })}
                            style={{
                                width: 22,
                                height: 22,
                                border: "none",
                                padding: 0,
                                background: "none",
                                cursor: "pointer",
                            }}
                        />
                    </div>
                </div>

                {/* Stroke Width */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255, 255, 255, 0.5)", fontWeight: 500 }}>
                        <span>Stroke Width</span>
                        <span style={{ color: "white" }}>{selectedShape.style?.strokeWidth ?? 2}px</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="10"
                        value={selectedShape.style?.strokeWidth ?? 2}
                        onChange={(e) => game?.updateSelectedShapeStyle({ strokeWidth: Number(e.target.value) })}
                        style={{ cursor: "pointer", width: "100%" }}
                    />
                </div>

                {/* Opacity */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255, 255, 255, 0.5)", fontWeight: 500 }}>
                        <span>Opacity</span>
                        <span style={{ color: "white" }}>{Math.round((selectedShape.style?.opacity ?? 1) * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={selectedShape.style?.opacity ?? 1}
                        onChange={(e) => game?.updateSelectedShapeStyle({ opacity: Number(e.target.value) })}
                        style={{ cursor: "pointer", width: "100%" }}
                    />
                </div>

                {/* Stroke Style */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.5)", fontWeight: 500 }}>Stroke Style</span>
                    <div style={{ display: "flex", gap: 6 }}>
                        {(["solid", "dashed", "dotted"] as const).map(s => {
                            const isSelected = (selectedShape.style?.strokeStyle || "solid") === s;
                            return (
                                <button
                                    key={s}
                                    onClick={() => game?.updateSelectedShapeStyle({ strokeStyle: s })}
                                    style={{
                                        flex: 1,
                                        padding: "6px 0",
                                        borderRadius: 6,
                                        background: isSelected ? "rgba(59, 130, 246, 0.2)" : "rgba(255, 255, 255, 0.05)",
                                        border: isSelected ? "1px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.1)",
                                        color: isSelected ? "#60a5fa" : "rgba(255, 255, 255, 0.8)",
                                        fontSize: 10,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        textTransform: "capitalize",
                                    }}
                                >
                                    {s}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Roughness (Hand-drawn feel) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.5)", fontWeight: 500 }}>Sloppiness (Roughness)</span>
                    <div style={{ display: "flex", gap: 6 }}>
                        {[
                            { label: "Clean", val: 0 },
                            { label: "Sketchy", val: 1 },
                            { label: "Artist", val: 2 },
                        ].map(r => {
                            const isSelected = (selectedShape.style?.roughness ?? 0) === r.val;
                            return (
                                <button
                                    key={r.val}
                                    onClick={() => game?.updateSelectedShapeStyle({ roughness: r.val })}
                                    style={{
                                        flex: 1,
                                        padding: "6px 0",
                                        borderRadius: 6,
                                        background: isSelected ? "rgba(59, 130, 246, 0.2)" : "rgba(255, 255, 255, 0.05)",
                                        border: isSelected ? "1px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.1)",
                                        color: isSelected ? "#60a5fa" : "rgba(255, 255, 255, 0.8)",
                                        fontSize: 10,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                    }}
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
}

function Topbar({selectedTool, setSelectedTool, game}: {
    selectedTool: Tool,
    setSelectedTool: (s: Tool) => void,
    game: Game | undefined,
}) {
    return <div style={{
            position: "fixed",
            top: 10,
            left: 10
        }}>
            <div className="flex gap-t">
                <IconButton 
                    onClick={() => {
                        setSelectedTool("select")
                    }}
                    activated={selectedTool === "select"}
                    icon={<MousePointer2 />}
                />
                <IconButton 
                    onClick={() => {
                        setSelectedTool("eraser")
                    }}
                    activated={selectedTool === "eraser"}
                    icon={<Eraser />}
                />
                <IconButton 
                    onClick={() => {
                        setSelectedTool("pencil")
                    }}
                    activated={selectedTool === "pencil"}
                    icon={<Pencil />}
                />
                <IconButton onClick={() => {
                    setSelectedTool("rect")
                }} activated={selectedTool === "rect"} icon={<RectangleHorizontalIcon />} ></IconButton>
                <IconButton onClick={() => {
                    setSelectedTool("circle")
                }} activated={selectedTool === "circle"} icon={<Circle />}></IconButton>
                <IconButton onClick={() => {
                    setSelectedTool("line")
                }} activated={selectedTool === "line"} icon={<Minus />}></IconButton>
                <IconButton onClick={() => {
                    setSelectedTool("arrow")
                }} activated={selectedTool === "arrow"} icon={<ArrowRight />}></IconButton>
                <IconButton onClick={() => {
                    setSelectedTool("text")
                }} activated={selectedTool === "text"} icon={<Type />}></IconButton>
                <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.15)", margin: "0 2px", alignSelf: "center" }} />
                <IconButton
                    onClick={() => game?.exportAsPNG()}
                    activated={false}
                    icon={<Download />}
                />
            </div>
        </div>
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
    const btnStyle = {
        background: "none",
        border: "none",
        color: "rgba(255,255,255,0.85)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center" as const,
        justifyContent: "center" as const,
        width: 32,
        height: 32,
        borderRadius: 8,
        fontSize: 16,
        transition: "background 0.15s",
        flexShrink: 0 as const,
    };

    return (
        <div
            style={{
                position: "fixed",
                bottom: 24,
                left: 24,
                display: "flex",
                alignItems: "center",
                gap: 2,
                background: "rgba(24, 24, 27, 0.92)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 12,
                padding: "4px 6px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                zIndex: 50,
            }}
        >
            {/* Zoom Out */}
            <button
                title="Zoom out"
                onClick={onZoomOut}
                style={btnStyle}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
                <Minus size={14} />
            </button>

            {/* Divider */}
            <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.12)", margin: "0 2px" }} />

            {/* Zoom % — click to reset to 100% */}
            <button
                title="Reset to 100%"
                onClick={onResetZoom}
                style={{
                    ...btnStyle,
                    width: "auto",
                    padding: "0 8px",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "monospace",
                    letterSpacing: "0.03em",
                    color: "rgba(255,255,255,0.9)",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
                {zoomLevel}%
            </button>

            {/* Divider */}
            <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.12)", margin: "0 2px" }} />

            {/* Zoom In */}
            <button
                title="Zoom in"
                onClick={onZoomIn}
                style={btnStyle}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
                <Plus size={14} />
            </button>

            {/* Divider */}
            <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.12)", margin: "0 2px" }} />

            {/* Fit to screen */}
            <button
                title="Fit to screen"
                onClick={onFitToScreen}
                style={btnStyle}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
                <Maximize2 size={14} />
            </button>
        </div>
    );
}
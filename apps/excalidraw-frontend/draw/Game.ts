import type { Tool } from "@/components/Canvas";
import { getExistingShapes } from "./http";
import rough from "roughjs";

export type ShapeStyle = {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  roughness: number;
};

export type Shape =
  | {
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      style?: ShapeStyle;
    }
  | {
      type: "circle";
      centerX: number;
      centerY: number;
      radius: number;
      style?: ShapeStyle;
    }
  | {
      type: "pencil";
      points: { x: number; y: number }[];
      style?: ShapeStyle;
    }
  | {
      type: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      style?: ShapeStyle;
    }
  | {
      type: "arrow";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      style?: ShapeStyle;
    }
  | {
      type: "text";
      x: number;
      y: number;
      text: string;
      style?: ShapeStyle;
    };

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private roughCanvas: ReturnType<typeof rough.canvas> | null = null;
  private existingShapes: Shape[];
  private roomId: string;
  private clicked: boolean;
  private startX = 0;
  private startY = 0;
  private selectedTool: Tool = "circle";
  private currentPencilPoints: { x: number; y: number }[] = [];

  // Selection + Drag state
  private selectedShapeIndex: number | null = null;
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  // Active Style state (for new shapes), Selection callback, and Zoom callback
  public onSelectionChange?: (selectedShape: Shape | null) => void;
  public onZoomChange?: (scale: number) => void;
  private activeStyle: ShapeStyle = {
    strokeColor: "#ffffff",
    fillColor: "transparent",
    strokeWidth: 2,
    opacity: 1,
    strokeStyle: "solid",
    roughness: 1,
  };

  // Infinite canvas state
  private panX = 0;
  private panY = 0;
  private scale = 1;
  private isPanning = false;
  private spacePressed = false;
  private lastPanX = 0;
  private lastPanY = 0;

  // Undo / Redo history
  private history: Shape[][] = [];
  private historyPointer = -1;

  // Minimap state
  private minimapCanvas: HTMLCanvasElement | null = null;
  private minimapCtx: CanvasRenderingContext2D | null = null;
  private isDraggingMinimap = false;

  socket: WebSocket;

  constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.roughCanvas = rough.canvas(canvas);
    this.existingShapes = [];
    this.roomId = roomId;
    this.socket = socket;
    this.clicked = false;
    this.init();
    this.initHandlers();
    this.initMouseHandlers();
  }

  destroy() {
    this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
    this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
    this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
    this.canvas.removeEventListener("wheel", this.wheelHandler);
    window.removeEventListener("keydown", this.keyDownHandler);
    window.removeEventListener("keyup", this.keyUpHandler);
    this.socket.removeEventListener("message", this.messageListener);
    if (this.minimapCanvas) {
      this.minimapCanvas.removeEventListener("mousedown", this.minimapMouseDownHandler);
      this.minimapCanvas.removeEventListener("mousemove", this.minimapMouseMoveHandler);
    }
    window.removeEventListener("mouseup", this.minimapMouseUpHandler);
  }

  private triggerSelectionCallback() {
    if (this.onSelectionChange) {
      if (this.selectedShapeIndex !== null) {
        this.onSelectionChange(this.existingShapes[this.selectedShapeIndex]!);
      } else {
        this.onSelectionChange(null);
      }
    }
  }

  public getActiveStyle(): ShapeStyle {
    return this.activeStyle;
  }

  public updateActiveStyle(properties: Partial<ShapeStyle>) {
    this.activeStyle = { ...this.activeStyle, ...properties };
  }

  public updateSelectedShapeStyle(properties: Partial<ShapeStyle>) {
    if (this.selectedShapeIndex !== null) {
      const shape = this.existingShapes[this.selectedShapeIndex]!;
      if (!shape.style) {
        shape.style = {
          strokeColor: "#ffffff",
          fillColor: "transparent",
          strokeWidth: 2,
          opacity: 1,
          strokeStyle: "solid",
          roughness: 1,
        };
      }
      shape.style = { ...shape.style, ...properties };

      // Also update activeStyle so next drawn shape matches
      this.activeStyle = { ...this.activeStyle, ...properties };

      this.pushHistory();
      this.clearCanvas();
      this.triggerSelectionCallback();

      // Broadcast this update to other clients!
      this.socket.send(
        JSON.stringify({
          type: "move_shape",
          shapeIndex: this.selectedShapeIndex,
          shape,
          shapes: this.existingShapes,
          roomId: this.roomId,
        }),
      );
    }
  }

  setTool(tool: Tool) {
    this.selectedTool = tool;
    // Deselect when switching away from select tool
    if (tool !== "select") {
      this.selectedShapeIndex = null;
      this.triggerSelectionCallback();
      this.clearCanvas();
    }
    // Visual cursor feedback for eraser
    this.canvas.style.cursor = tool === "eraser" ? "crosshair" : "default";
  }

  async init() {
    this.existingShapes = await getExistingShapes(this.roomId);
    this.pushHistory();
    this.clearCanvas();
  }

  /** Save a snapshot of existingShapes to the history stack */
  private pushHistory() {
    // Discard any future states beyond the current pointer
    this.history = this.history.slice(0, this.historyPointer + 1);
    this.history.push(
      this.existingShapes.map((s) => {
        if (s.type === "pencil") {
          return {
            type: "pencil" as const,
            points: s.points.map((p) => ({ ...p })),
            style: s.style ? { ...s.style } : undefined,
          };
        }
        return {
          ...s,
          style: s.style ? { ...s.style } : undefined,
        };
      }),
    );
    this.historyPointer = this.history.length - 1;
  }

  undo() {
    if (this.historyPointer > 0) {
      this.historyPointer--;
      this.existingShapes = [...this.history[this.historyPointer]!];
      this.selectedShapeIndex = null;
      this.triggerSelectionCallback();
      this.clearCanvas();
    }
  }

  redo() {
    if (this.historyPointer < this.history.length - 1) {
      this.historyPointer++;
      this.existingShapes = [...this.history[this.historyPointer]!];
      this.selectedShapeIndex = null;
      this.triggerSelectionCallback();
      this.clearCanvas();
    }
  }

  private messageListener = (event: MessageEvent<any>) => {
    if (typeof event.data !== "string") {
      return;
    }

    try {
      const message = JSON.parse(event.data);
      if (message.type === "chat") {
        const parsedShape = JSON.parse(message.message);
        if (parsedShape.shape) {
          this.existingShapes.push(parsedShape.shape);
          this.pushHistory();
          this.clearCanvas();
        }
      } else if (message.type === "undo") {
        this.undo();
      } else if (message.type === "redo") {
        this.redo();
      } else if (message.type === "delete_shape") {
        const index = message.shapeIndex as number;
        if (index >= 0 && index < this.existingShapes.length) {
          this.existingShapes.splice(index, 1);
          this.selectedShapeIndex = null;
          this.triggerSelectionCallback();
          this.pushHistory();
          this.clearCanvas();
        }
      } else if (message.type === "move_shape") {
        const index = message.shapeIndex as number;
        const movedShape = message.shape;
        if (index >= 0 && index < this.existingShapes.length && movedShape) {
          this.existingShapes[index] = movedShape;
          // Update selected shape reference if it was the one moved
          if (this.selectedShapeIndex === index) {
            this.triggerSelectionCallback();
          }
          this.pushHistory();
          this.clearCanvas();
        }
      }
    } catch (e) {
      console.error("Error parsing WS message:", e);
    }
  };

  initHandlers() {
    this.socket.addEventListener("message", this.messageListener);
  }

  /** Convert screen (pixel) coordinates to world coordinates */
  private screenToWorld(screenX: number, screenY: number) {
    return {
      x: screenX / this.scale + this.panX,
      y: screenY / this.scale + this.panY,
    };
  }

  /** Get bounding box for any shape (in world coordinates) */
  private getShapeBounds(shape: Shape): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    if (shape.type === "rect") {
      const minX = Math.min(shape.x, shape.x + shape.width);
      const maxX = Math.max(shape.x, shape.x + shape.width);
      const minY = Math.min(shape.y, shape.y + shape.height);
      const maxY = Math.max(shape.y, shape.y + shape.height);
      return { minX, minY, maxX, maxY };
    } else if (shape.type === "circle") {
      const r = Math.abs(shape.radius);
      return {
        minX: shape.centerX - r,
        minY: shape.centerY - r,
        maxX: shape.centerX + r,
        maxY: shape.centerY + r,
      };
    } else if (shape.type === "line" || shape.type === "arrow") {
      return {
        minX: Math.min(shape.x1, shape.x2),
        minY: Math.min(shape.y1, shape.y2),
        maxX: Math.max(shape.x1, shape.x2),
        maxY: Math.max(shape.y1, shape.y2),
      };
    } else if (shape.type === "text") {
      this.ctx.save();
      this.ctx.font = "20px sans-serif";
      const metrics = this.ctx.measureText(shape.text);
      const textWidth = metrics.width;
      const textHeight = 20;
      this.ctx.restore();
      return {
        minX: shape.x,
        minY: shape.y - textHeight,
        maxX: shape.x + textWidth,
        maxY: shape.y + 4,
      };
    } else {
      // pencil — bounding box of all points
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const p of shape.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      return { minX, minY, maxX, maxY };
    }
  }

  /** Hit-test a world-space point against a shape */
  private hitTestShape(shape: Shape, wx: number, wy: number): boolean {
    if (shape.type === "rect") {
      const bounds = this.getShapeBounds(shape);
      return (
        wx >= bounds.minX &&
        wx <= bounds.maxX &&
        wy >= bounds.minY &&
        wy <= bounds.maxY
      );
    } else if (shape.type === "circle") {
      const dx = wx - shape.centerX;
      const dy = wy - shape.centerY;
      return dx * dx + dy * dy <= shape.radius * shape.radius;
    } else if (shape.type === "line" || shape.type === "arrow") {
      const tolerance = 6 / this.scale;
      return (
        this.pointToSegmentDist(
          wx,
          wy,
          shape.x1,
          shape.y1,
          shape.x2,
          shape.y2,
        ) <= tolerance
      );
    } else if (shape.type === "text") {
      const bounds = this.getShapeBounds(shape);
      return (
        wx >= bounds.minX &&
        wx <= bounds.maxX &&
        wy >= bounds.minY &&
        wy <= bounds.maxY
      );
    } else {
      // pencil — check proximity to any segment (within 6 world-px tolerance)
      const tolerance = 6 / this.scale;
      for (let i = 0; i < shape.points.length - 1; i++) {
        const a = shape.points[i]!;
        const b = shape.points[i + 1]!;
        if (this.pointToSegmentDist(wx, wy, a.x, a.y, b.x, b.y) <= tolerance) {
          return true;
        }
      }
      return false;
    }
  }

  /** Distance from point (px, py) to line segment (ax, ay)-(bx, by) */
  private pointToSegmentDist(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  /** Find the top-most shape under a world-space point (last drawn = on top) */
  private findShapeAt(wx: number, wy: number): number | null {
    for (let i = this.existingShapes.length - 1; i >= 0; i--) {
      if (this.hitTestShape(this.existingShapes[i]!, wx, wy)) {
        return i;
      }
    }
    return null;
  }

  /** Translate a shape by (dx, dy) in world coordinates */
  private moveShape(shape: Shape, dx: number, dy: number) {
    if (shape.type === "rect") {
      shape.x += dx;
      shape.y += dy;
    } else if (shape.type === "circle") {
      shape.centerX += dx;
      shape.centerY += dy;
    } else if (shape.type === "pencil") {
      for (const p of shape.points) {
        p.x += dx;
        p.y += dy;
      }
    } else if (shape.type === "line" || shape.type === "arrow") {
      shape.x1 += dx;
      shape.y1 += dy;
      shape.x2 += dx;
      shape.y2 += dy;
    } else if (shape.type === "text") {
      shape.x += dx;
      shape.y += dy;
    }
  }

  /** Draw a pencil shape using quadratic curves for smoothness */
  private drawPencilShape(points: { x: number; y: number }[]) {
    if (points.length < 2) return;

    this.ctx.beginPath();
    this.ctx.moveTo(points[0]!.x, points[0]!.y);

    if (points.length === 2) {
      this.ctx.lineTo(points[1]!.x, points[1]!.y);
    } else {
      // Use quadratic curves through midpoints for smoothness
      for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i]!.x + points[i + 1]!.x) / 2;
        const midY = (points[i]!.y + points[i + 1]!.y) / 2;
        this.ctx.quadraticCurveTo(points[i]!.x, points[i]!.y, midX, midY);
      }
      // Draw the last segment
      const last = points[points.length - 1]!;
      const secondLast = points[points.length - 2]!;
      this.ctx.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y);
    }

    this.ctx.stroke();
  }

  /** Draw an arrowhead at (tipX, tipY) pointing from (fromX, fromY) */
  private drawArrowhead(
    fromX: number,
    fromY: number,
    tipX: number,
    tipY: number,
  ) {
    const headLength = 12 / this.scale;
    const angle = Math.atan2(tipY - fromY, tipX - fromX);
    this.ctx.beginPath();
    this.ctx.moveTo(tipX, tipY);
    this.ctx.lineTo(
      tipX - headLength * Math.cos(angle - Math.PI / 6),
      tipY - headLength * Math.sin(angle - Math.PI / 6),
    );
    this.ctx.moveTo(tipX, tipY);
    this.ctx.lineTo(
      tipX - headLength * Math.cos(angle + Math.PI / 6),
      tipY - headLength * Math.sin(angle + Math.PI / 6),
    );
    this.ctx.stroke();
  }

  clearCanvas() {
    // Reset transform to identity so clearRect covers the whole physical canvas
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "rgba(0, 0, 0)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Initialize or reuse the RoughJS canvas instance
    const rc =
      this.roughCanvas ?? (this.roughCanvas = rough.canvas(this.canvas));

    // Apply pan + zoom transform for all shape drawing
    this.ctx.save();
    this.ctx.setTransform(
      this.scale,
      0,
      0,
      this.scale,
      -this.panX * this.scale,
      -this.panY * this.scale,
    );

    this.existingShapes.forEach((shape, index) => {
      // Default styles if shape has no style properties
      const style = shape.style || {
        strokeColor: "#ffffff",
        fillColor: "transparent",
        strokeWidth: 2,
        opacity: 1,
        strokeStyle: "solid",
        roughness: 0,
      };

      this.ctx.save();
      this.ctx.globalAlpha = style.opacity;

      // Apply line dash style
      if (style.strokeStyle === "dashed") {
        this.ctx.setLineDash([10 / this.scale, 5 / this.scale]);
      } else if (style.strokeStyle === "dotted") {
        this.ctx.setLineDash([2 / this.scale, 4 / this.scale]);
      } else {
        this.ctx.setLineDash([]);
      }

      // Highlight selected shape with a blue outline (before applying stroke color)
      if (index === this.selectedShapeIndex) {
        this.ctx.strokeStyle = "rgba(59, 130, 246, 1)";
        this.ctx.lineWidth = Math.max(2, style.strokeWidth + 1) / this.scale;
      } else {
        this.ctx.strokeStyle = style.strokeColor;
        this.ctx.lineWidth = style.strokeWidth / this.scale;
      }

      this.ctx.fillStyle = style.fillColor;

      // Build RoughJS options
      const strokeLineDash =
        style.strokeStyle === "dashed"
          ? [10, 5]
          : style.strokeStyle === "dotted"
            ? [2, 4]
            : undefined;

      const roughOptions = {
        roughness:
          style.roughness === 1 ? 1.5 : style.roughness === 2 ? 2.8 : 0,
        stroke:
          index === this.selectedShapeIndex
            ? "rgba(59, 130, 246, 1)"
            : style.strokeColor,
        strokeWidth:
          index === this.selectedShapeIndex
            ? Math.max(2, style.strokeWidth + 1)
            : style.strokeWidth,
        fill: style.fillColor === "transparent" ? undefined : style.fillColor,
        fillStyle: "solid",
        strokeLineDash,
      };

      if (shape.type === "rect") {
        if (style.roughness > 0) {
          rc.rectangle(
            shape.x,
            shape.y,
            shape.width,
            shape.height,
            roughOptions,
          );
        } else {
          // Draw fill first if not transparent
          if (style.fillColor !== "transparent") {
            this.ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
          }
          this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        }
      } else if (shape.type === "circle") {
        if (style.roughness > 0) {
          const diameter = Math.abs(shape.radius) * 2;
          rc.circle(shape.centerX, shape.centerY, diameter, roughOptions);
        } else {
          // Draw fill first if not transparent
          if (style.fillColor !== "transparent") {
            this.ctx.beginPath();
            this.ctx.arc(
              shape.centerX,
              shape.centerY,
              Math.abs(shape.radius),
              0,
              Math.PI * 2,
            );
            this.ctx.fill();
            this.ctx.closePath();
          }
          this.ctx.beginPath();
          this.ctx.arc(
            shape.centerX,
            shape.centerY,
            Math.abs(shape.radius),
            0,
            Math.PI * 2,
          );
          this.ctx.stroke();
          this.ctx.closePath();
        }
      } else if (shape.type === "pencil") {
        if (style.roughness > 0 && shape.points.length >= 2) {
          const pts = shape.points.map((p) => [p.x, p.y] as [number, number]);
          rc.curve(pts, roughOptions);
        } else {
          this.drawPencilShape(shape.points);
        }
      } else if (shape.type === "line") {
        if (style.roughness > 0) {
          rc.line(shape.x1, shape.y1, shape.x2, shape.y2, roughOptions);
        } else {
          this.ctx.beginPath();
          this.ctx.moveTo(shape.x1, shape.y1);
          this.ctx.lineTo(shape.x2, shape.y2);
          this.ctx.stroke();
        }
      } else if (shape.type === "arrow") {
        if (style.roughness > 0) {
          const headLength = 12 / this.scale;
          const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
          const wing1X = shape.x2 - headLength * Math.cos(angle - Math.PI / 6);
          const wing1Y = shape.y2 - headLength * Math.sin(angle - Math.PI / 6);
          const wing2X = shape.x2 - headLength * Math.cos(angle + Math.PI / 6);
          const wing2Y = shape.y2 - headLength * Math.sin(angle + Math.PI / 6);

          rc.line(shape.x1, shape.y1, shape.x2, shape.y2, roughOptions);
          rc.line(shape.x2, shape.y2, wing1X, wing1Y, roughOptions);
          rc.line(shape.x2, shape.y2, wing2X, wing2Y, roughOptions);
        } else {
          this.ctx.beginPath();
          this.ctx.moveTo(shape.x1, shape.y1);
          this.ctx.lineTo(shape.x2, shape.y2);
          this.ctx.stroke();
          this.drawArrowhead(shape.x1, shape.y1, shape.x2, shape.y2);
        }
      } else if (shape.type === "text") {
        this.ctx.fillStyle =
          index === this.selectedShapeIndex
            ? "rgba(59, 130, 246, 1)"
            : style.strokeColor;
        this.ctx.font = "20px sans-serif";
        this.ctx.textBaseline = "alphabetic";
        this.ctx.fillText(shape.text, shape.x, shape.y);
      }

      this.ctx.restore();

      // Draw selection bounding box
      if (index === this.selectedShapeIndex) {
        const bounds = this.getShapeBounds(shape);
        const padding = 4 / this.scale;
        this.ctx.save();
        this.ctx.setLineDash([6 / this.scale, 4 / this.scale]);
        this.ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
        this.ctx.lineWidth = 1 / this.scale;
        this.ctx.strokeRect(
          bounds.minX - padding,
          bounds.minY - padding,
          bounds.maxX - bounds.minX + padding * 2,
          bounds.maxY - bounds.minY + padding * 2,
        );
        this.ctx.restore();
      }
    });

    // Reset lineWidth
    this.ctx.lineWidth = 1;

    this.ctx.restore();

    // Draw the minimap after every canvas redraw
    this.drawMinimap();
  }

  /** Register a minimap canvas element and attach its interaction handlers */
  public registerMinimap(canvas: HTMLCanvasElement) {
    this.minimapCanvas = canvas;
    this.minimapCtx = canvas.getContext("2d");
    canvas.addEventListener("mousedown", this.minimapMouseDownHandler);
    canvas.addEventListener("mousemove", this.minimapMouseMoveHandler);
    window.addEventListener("mouseup", this.minimapMouseUpHandler);
    // Draw immediately in case shapes are already loaded
    this.drawMinimap();
  }

  /** Get the combined bounding box of all shapes in world coordinates */
  private getAllShapesBounds(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    if (this.existingShapes.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const shape of this.existingShapes) {
      const b = this.getShapeBounds(shape);
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
    }
    return { minX, minY, maxX, maxY };
  }

  /** Render the minimap overview */
  private drawMinimap() {
    if (!this.minimapCanvas || !this.minimapCtx) return;

    const mw = this.minimapCanvas.width;
    const mh = this.minimapCanvas.height;
    const mc = this.minimapCtx;

    // Clear
    mc.clearRect(0, 0, mw, mh);
    mc.fillStyle = "rgba(15, 15, 20, 0.88)";
    mc.fillRect(0, 0, mw, mh);

    // Viewport bounds in world space
    const vpMinX = this.panX;
    const vpMinY = this.panY;
    const vpMaxX = this.panX + this.canvas.width / this.scale;
    const vpMaxY = this.panY + this.canvas.height / this.scale;

    // Combine shape bounds and viewport bounds so both fit in the minimap
    const shapeBounds = this.getAllShapesBounds();
    const worldMinX = Math.min(shapeBounds?.minX ?? vpMinX, vpMinX) - 40;
    const worldMinY = Math.min(shapeBounds?.minY ?? vpMinY, vpMinY) - 40;
    const worldMaxX = Math.max(shapeBounds?.maxX ?? vpMaxX, vpMaxX) + 40;
    const worldMaxY = Math.max(shapeBounds?.maxY ?? vpMaxY, vpMaxY) + 40;

    const worldW = worldMaxX - worldMinX;
    const worldH = worldMaxY - worldMinY;
    if (worldW === 0 || worldH === 0) return;

    // Scale to fit in minimap while preserving aspect ratio
    const padding = 8;
    const availW = mw - padding * 2;
    const availH = mh - padding * 2;
    const scaleX = availW / worldW;
    const scaleY = availH / worldH;
    const ms = Math.min(scaleX, scaleY);

    // Centering offsets
    const offsetX = padding + (availW - worldW * ms) / 2;
    const offsetY = padding + (availH - worldH * ms) / 2;

    // Helper: world -> minimap pixel
    const toMinimap = (wx: number, wy: number) => ({
      x: offsetX + (wx - worldMinX) * ms,
      y: offsetY + (wy - worldMinY) * ms,
    });

    // Draw shapes as filled blobs
    mc.save();
    for (const shape of this.existingShapes) {
      const color = shape.style?.strokeColor ?? "#ffffff";
      mc.strokeStyle = color;
      mc.fillStyle = color;
      mc.globalAlpha = 0.6;
      mc.lineWidth = Math.max(1, (shape.style?.strokeWidth ?? 2) * ms);

      if (shape.type === "rect") {
        const tl = toMinimap(shape.x, shape.y);
        const w = shape.width * ms;
        const h = shape.height * ms;
        if (shape.style?.fillColor && shape.style.fillColor !== "transparent") {
          mc.fillStyle = shape.style.fillColor;
          mc.fillRect(tl.x, tl.y, w, h);
        }
        mc.strokeRect(tl.x, tl.y, w, h);
      } else if (shape.type === "circle") {
        const c = toMinimap(shape.centerX, shape.centerY);
        mc.beginPath();
        mc.arc(c.x, c.y, Math.abs(shape.radius) * ms, 0, Math.PI * 2);
        mc.stroke();
      } else if (shape.type === "line" || shape.type === "arrow") {
        const p1 = toMinimap(shape.x1, shape.y1);
        const p2 = toMinimap(shape.x2, shape.y2);
        mc.beginPath();
        mc.moveTo(p1.x, p1.y);
        mc.lineTo(p2.x, p2.y);
        mc.stroke();
      } else if (shape.type === "pencil" && shape.points.length > 1) {
        mc.beginPath();
        const first = toMinimap(shape.points[0]!.x, shape.points[0]!.y);
        mc.moveTo(first.x, first.y);
        for (let i = 1; i < shape.points.length; i++) {
          const pt = toMinimap(shape.points[i]!.x, shape.points[i]!.y);
          mc.lineTo(pt.x, pt.y);
        }
        mc.stroke();
      } else if (shape.type === "text") {
        const pos = toMinimap(shape.x, shape.y);
        mc.fillStyle = color;
        mc.font = `${Math.max(6, 10 * ms)}px sans-serif`;
        mc.fillText(shape.text.substring(0, 12), pos.x, pos.y);
      }
    }
    mc.restore();

    // Draw viewport rectangle
    const vptl = toMinimap(vpMinX, vpMinY);
    const vpbr = toMinimap(vpMaxX, vpMaxY);
    mc.save();
    mc.strokeStyle = "rgba(99, 179, 237, 0.9)";
    mc.lineWidth = 1.5;
    mc.setLineDash([3, 2]);
    mc.fillStyle = "rgba(99, 179, 237, 0.08)";
    mc.fillRect(vptl.x, vptl.y, vpbr.x - vptl.x, vpbr.y - vptl.y);
    mc.strokeRect(vptl.x, vptl.y, vpbr.x - vptl.x, vpbr.y - vptl.y);
    mc.restore();

    // Store mapping data for click-to-pan
    this._minimapWorldMinX = worldMinX;
    this._minimapWorldMinY = worldMinY;
    this._minimapMs = ms;
    this._minimapOffsetX = offsetX;
    this._minimapOffsetY = offsetY;
  }

  // Stored minimap-to-world mapping (refreshed on every drawMinimap call)
  private _minimapWorldMinX = 0;
  private _minimapWorldMinY = 0;
  private _minimapMs = 1;
  private _minimapOffsetX = 0;
  private _minimapOffsetY = 0;

  /** Convert a minimap pixel position to world coordinates */
  private minimapToWorld(mx: number, my: number) {
    return {
      x: (mx - this._minimapOffsetX) / this._minimapMs + this._minimapWorldMinX,
      y: (my - this._minimapOffsetY) / this._minimapMs + this._minimapWorldMinY,
    };
  }

  /** Pan main canvas so that a world point is at the center of the viewport */
  private panToWorld(wx: number, wy: number) {
    this.panX = wx - this.canvas.width / this.scale / 2;
    this.panY = wy - this.canvas.height / this.scale / 2;
    this.clearCanvas();
  }

  // Minimap mouse handlers
  private minimapMouseDownHandler = (e: MouseEvent) => {
    e.preventDefault();
    this.isDraggingMinimap = true;
    const rect = this.minimapCanvas!.getBoundingClientRect();
    const world = this.minimapToWorld(e.clientX - rect.left, e.clientY - rect.top);
    this.panToWorld(world.x, world.y);
  };

  private minimapMouseMoveHandler = (e: MouseEvent) => {
    if (!this.isDraggingMinimap) return;
    const rect = this.minimapCanvas!.getBoundingClientRect();
    const world = this.minimapToWorld(e.clientX - rect.left, e.clientY - rect.top);
    this.panToWorld(world.x, world.y);
  };

  private minimapMouseUpHandler = () => {
    this.isDraggingMinimap = false;
  };

  // --- Keyboard handlers for space-to-pan ---

  keyDownHandler = (e: KeyboardEvent) => {
    if (e.code === "Space" && !this.spacePressed) {
      this.spacePressed = true;
      this.canvas.style.cursor = "grab";
      e.preventDefault();
    }

    // Undo: Ctrl+Z
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      this.undo();
      this.socket.send(
        JSON.stringify({
          type: "undo",
          shapes: this.existingShapes,
          roomId: this.roomId,
        }),
      );
    }

    // Redo: Ctrl+Y or Ctrl+Shift+Z
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key === "y" || (e.key === "z" && e.shiftKey))
    ) {
      e.preventDefault();
      this.redo();
      this.socket.send(
        JSON.stringify({
          type: "redo",
          shapes: this.existingShapes,
          roomId: this.roomId,
        }),
      );
    }

    // Delete selected shape
    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      this.selectedShapeIndex !== null
    ) {
      e.preventDefault();
      const index = this.selectedShapeIndex;
      this.existingShapes.splice(index, 1);
      this.socket.send(
        JSON.stringify({
          type: "delete_shape",
          shapeIndex: index,
          shapes: this.existingShapes,
          roomId: this.roomId,
        }),
      );
      this.selectedShapeIndex = null;
      this.pushHistory();
      this.clearCanvas();
    }
  };

  keyUpHandler = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      this.spacePressed = false;
      if (!this.isPanning) {
        this.canvas.style.cursor = "default";
      }
    }
  };

  // --- Wheel handler for zoom ---

  /** Apply a zoom factor anchored to the center of the viewport */
  private applyZoom(newScale: number) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const worldBefore = this.screenToWorld(centerX, centerY);
    this.scale = Math.min(Math.max(newScale, 0.05), 20);
    const worldAfter = this.screenToWorld(centerX, centerY);
    this.panX -= worldAfter.x - worldBefore.x;
    this.panY -= worldAfter.y - worldBefore.y;
    this.clearCanvas();
    if (this.onZoomChange) this.onZoomChange(this.scale);
  }

  public getScale(): number {
    return this.scale;
  }

  public zoomIn() {
    this.applyZoom(this.scale * 1.25);
  }

  public zoomOut() {
    this.applyZoom(this.scale / 1.25);
  }

  public resetZoom() {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.clearCanvas();
    if (this.onZoomChange) this.onZoomChange(this.scale);
  }

  public fitToScreen() {
    const bounds = this.getAllShapesBounds();
    if (!bounds) {
      this.resetZoom();
      return;
    }
    const padding = 60;
    const worldW = bounds.maxX - bounds.minX + padding * 2;
    const worldH = bounds.maxY - bounds.minY + padding * 2;
    const scaleX = this.canvas.width / worldW;
    const scaleY = this.canvas.height / worldH;
    this.scale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.05), 20);
    this.panX = bounds.minX - padding;
    this.panY = bounds.minY - padding;
    this.clearCanvas();
    if (this.onZoomChange) this.onZoomChange(this.scale);
  }

  wheelHandler = (e: WheelEvent) => {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // World position under the cursor before zoom
    const worldBefore = this.screenToWorld(mouseX, mouseY);

    // Apply zoom (clamp between 0.05x and 20x)
    const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.scale = Math.min(Math.max(this.scale * zoomFactor, 0.05), 20);

    // World position under the cursor after zoom (with old panX/panY)
    const worldAfter = this.screenToWorld(mouseX, mouseY);

    // Adjust pan so the world point under cursor stays fixed
    this.panX -= worldAfter.x - worldBefore.x;
    this.panY -= worldAfter.y - worldBefore.y;

    this.clearCanvas();
    if (this.onZoomChange) this.onZoomChange(this.scale);
  };

  // --- Mouse handlers ---

  mouseDownHandler = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Middle mouse button (button === 1) or space held: start panning
    if (e.button === 1 || this.spacePressed) {
      this.isPanning = true;
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      this.canvas.style.cursor = "grabbing";
      e.preventDefault();
      return;
    }

    const world = this.screenToWorld(screenX, screenY);

    // Select tool: hit-test for selection or start dragging
    if (this.selectedTool === "select") {
      const hitIndex = this.findShapeAt(world.x, world.y);
      if (hitIndex !== null) {
        this.selectedShapeIndex = hitIndex;
        this.triggerSelectionCallback();
        this.isDragging = true;
        // Store offset from click to shape origin for smooth dragging
        const shape = this.existingShapes[hitIndex]!;
        const bounds = this.getShapeBounds(shape);
        this.dragOffsetX = world.x - bounds.minX;
        this.dragOffsetY = world.y - bounds.minY;
        this.canvas.style.cursor = "move";
      } else {
        this.selectedShapeIndex = null;
        this.triggerSelectionCallback();
        this.isDragging = false;
      }
      this.clearCanvas();
      return;
    }

    // Eraser tool: click on a shape to delete it
    if (this.selectedTool === "eraser") {
      const hitIndex = this.findShapeAt(world.x, world.y);
      if (hitIndex !== null) {
        this.existingShapes.splice(hitIndex, 1);
        this.pushHistory();
        this.socket.send(
          JSON.stringify({
            type: "delete_shape",
            shapeIndex: hitIndex,
            shapes: this.existingShapes,
            roomId: this.roomId,
          }),
        );
        this.clearCanvas();
      }
      return;
    }

    // Text tool: single-click to place text input overlay
    if (this.selectedTool === "text") {
      this.createTextShapeAt(e.clientX, e.clientY);
      return;
    }

    // Normal drawing
    this.clicked = true;
    this.startX = world.x;
    this.startY = world.y;

    // Start collecting pencil points
    if (this.selectedTool === "pencil") {
      this.currentPencilPoints = [{ x: world.x, y: world.y }];
    }
  };

  mouseUpHandler = (e: MouseEvent) => {
    // End panning
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = this.spacePressed ? "grab" : "default";
      return;
    }

    // End dragging a selected shape
    if (this.isDragging) {
      this.isDragging = false;
      this.canvas.style.cursor = "default";
      this.pushHistory();
      // Broadcast the moved shape
      if (this.selectedShapeIndex !== null) {
        const shape = this.existingShapes[this.selectedShapeIndex]!;
        this.socket.send(
          JSON.stringify({
            type: "move_shape",
            shapeIndex: this.selectedShapeIndex,
            shape,
            shapes: this.existingShapes,
            roomId: this.roomId,
          }),
        );
      }
      return;
    }

    if (!this.clicked) return;
    this.clicked = false;

    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = this.screenToWorld(screenX, screenY);
    const endX = world.x;
    const endY = world.y;
    const width = endX - this.startX;
    const height = endY - this.startY;

    const selectedTool = this.selectedTool;
    let shape: Shape | null = null;

    if (selectedTool === "rect") {
      shape = {
        type: "rect",
        x: this.startX,
        y: this.startY,
        height,
        width,
        style: { ...this.activeStyle },
      };
    } else if (selectedTool === "circle") {
      const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
      shape = {
        type: "circle",
        radius,
        centerX: this.startX + (width > 0 ? radius : -radius),
        centerY: this.startY + (height > 0 ? radius : -radius),
        style: { ...this.activeStyle },
      };
    } else if (selectedTool === "pencil") {
      // Add the final point and use the accumulated points
      this.currentPencilPoints.push({ x: endX, y: endY });
      shape = {
        type: "pencil",
        points: [...this.currentPencilPoints],
        style: { ...this.activeStyle },
      };
      this.currentPencilPoints = [];
    } else if (selectedTool === "line") {
      shape = {
        type: "line",
        x1: this.startX,
        y1: this.startY,
        x2: endX,
        y2: endY,
        style: { ...this.activeStyle },
      };
    } else if (selectedTool === "arrow") {
      shape = {
        type: "arrow",
        x1: this.startX,
        y1: this.startY,
        x2: endX,
        y2: endY,
        style: { ...this.activeStyle },
      };
    }

    if (!shape) {
      return;
    }

    this.existingShapes.push(shape);
    this.pushHistory();

    this.socket.send(
      JSON.stringify({
        type: "chat",
        message: JSON.stringify({ shape }),
        roomId: this.roomId,
      }),
    );

    this.clearCanvas();
  };

  mouseMoveHandler = (e: MouseEvent) => {
    // Handle panning
    if (this.isPanning) {
      const dx = e.clientX - this.lastPanX;
      const dy = e.clientY - this.lastPanY;
      this.panX -= dx / this.scale;
      this.panY -= dy / this.scale;
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      this.clearCanvas();
      return;
    }

    // Handle dragging a selected shape (checked before `clicked` because
    // the select-tool mousedown sets isDragging but NOT clicked)
    if (this.isDragging && this.selectedShapeIndex !== null) {
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const world = this.screenToWorld(screenX, screenY);
      const shape = this.existingShapes[this.selectedShapeIndex]!;
      const bounds = this.getShapeBounds(shape);
      const newMinX = world.x - this.dragOffsetX;
      const newMinY = world.y - this.dragOffsetY;
      const dx = newMinX - bounds.minX;
      const dy = newMinY - bounds.minY;
      this.moveShape(shape, dx, dy);
      this.clearCanvas();
      return;
    }

    if (!this.clicked) return;

    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = this.screenToWorld(screenX, screenY);
    const currentX = world.x;
    const currentY = world.y;
    const width = currentX - this.startX;
    const height = currentY - this.startY;

    const selectedTool = this.selectedTool;

    // Accumulate pencil points while drawing
    if (selectedTool === "pencil") {
      this.currentPencilPoints.push({ x: currentX, y: currentY });
    }

    // Redraw existing shapes, then draw the in-progress preview
    this.clearCanvas();

    // Draw preview shape in world-space using the same transform
    this.ctx.save();
    this.ctx.setTransform(
      this.scale,
      0,
      0,
      this.scale,
      -this.panX * this.scale,
      -this.panY * this.scale,
    );
    this.ctx.strokeStyle = "rgba(255, 255, 255)";

    if (selectedTool === "rect") {
      this.ctx.strokeRect(this.startX, this.startY, width, height);
    } else if (selectedTool === "circle") {
      const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
      const centerX = this.startX + (width > 0 ? radius : -radius);
      const centerY = this.startY + (height > 0 ? radius : -radius);
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.closePath();
    } else if (selectedTool === "pencil") {
      this.drawPencilShape(this.currentPencilPoints);
    } else if (selectedTool === "line") {
      this.ctx.beginPath();
      this.ctx.moveTo(this.startX, this.startY);
      this.ctx.lineTo(currentX, currentY);
      this.ctx.stroke();
    } else if (selectedTool === "arrow") {
      this.ctx.beginPath();
      this.ctx.moveTo(this.startX, this.startY);
      this.ctx.lineTo(currentX, currentY);
      this.ctx.stroke();
      this.drawArrowhead(this.startX, this.startY, currentX, currentY);
    }

    this.ctx.restore();
  };

  createTextShapeAt = (clientX: number, clientY: number) => {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    const world = this.screenToWorld(screenX, screenY);

    const input = document.createElement("input");
    input.type = "text";
    input.style.position = "fixed";
    input.style.left = `${clientX}px`;
    input.style.top = `${clientY - 10}px`;
    input.style.font = `${20 * this.scale}px sans-serif`;
    input.style.background = "rgba(0, 0, 0, 0.8)";
    input.style.color = "white";
    input.style.border = "1px solid rgba(59, 130, 246, 0.8)";
    input.style.outline = "none";
    input.style.padding = "2px 4px";
    input.style.zIndex = "1000";

    document.body.appendChild(input);
    // Slight timeout to ensure keyboard focus
    setTimeout(() => input.focus(), 0);

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      const text = input.value.trim();
      document.body.removeChild(input);

      if (text) {
        const newShape: Shape = {
          type: "text",
          x: world.x,
          y: world.y,
          text,
          style: { ...this.activeStyle },
        };
        this.existingShapes.push(newShape);
        this.pushHistory();

        this.socket.send(
          JSON.stringify({
            type: "chat",
            message: JSON.stringify({ shape: newShape }),
            roomId: this.roomId,
          }),
        );

        this.clearCanvas();
      }
    };

    input.addEventListener("blur", finish);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        finish();
      } else if (event.key === "Escape") {
        finished = true;
        document.body.removeChild(input);
      }
    });
  };

  initMouseHandlers() {
    this.canvas.addEventListener("mousedown", this.mouseDownHandler);
    this.canvas.addEventListener("mouseup", this.mouseUpHandler);
    this.canvas.addEventListener("mousemove", this.mouseMoveHandler);
    // passive: false is required so wheelHandler can call preventDefault()
    this.canvas.addEventListener("wheel", this.wheelHandler, {
      passive: false,
    });
    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup", this.keyUpHandler);
  }
}

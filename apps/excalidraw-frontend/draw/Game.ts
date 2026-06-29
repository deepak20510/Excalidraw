import type { Tool } from "@/components/Canvas";
import { getExistingShapes } from "./http";

type Shape =
  | {
    type: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
  }
  | {
    type: "circle";
    centerX: number;
    centerY: number;
    radius: number;
  }
  | {
    type: "pencil";
    points: { x: number; y: number }[];
  };

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
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

  socket: WebSocket;

  constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
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
  }

  setTool(tool: Tool) {
    this.selectedTool = tool;
    // Deselect when switching away from select tool
    if (tool !== "select") {
      this.selectedShapeIndex = null;
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
    this.history.push(this.existingShapes.map((s) => {
      if (s.type === "pencil") {
        return { type: "pencil" as const, points: s.points.map((p) => ({ ...p })) };
      }
      return { ...s };
    }));
    this.historyPointer = this.history.length - 1;
  }

  undo() {
    if (this.historyPointer > 0) {
      this.historyPointer--;
      this.existingShapes = [...this.history[this.historyPointer]!];
      this.clearCanvas();
    }
  }

  redo() {
    if (this.historyPointer < this.history.length - 1) {
      this.historyPointer++;
      this.existingShapes = [...this.history[this.historyPointer]!];
      this.clearCanvas();
    }
  }

  initHandlers() {
    this.socket.onmessage = (event: MessageEvent<string>) => {
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
            this.pushHistory();
            this.clearCanvas();
          }
        } else if (message.type === "move_shape") {
          const index = message.shapeIndex as number;
          const movedShape = message.shape;
          if (
            index >= 0 &&
            index < this.existingShapes.length &&
            movedShape
          ) {
            this.existingShapes[index] = movedShape;
            this.pushHistory();
            this.clearCanvas();
          }
        }
      } catch (e) {
        console.error("Error parsing WS message:", e);
      }
    };
  }

  /** Convert screen (pixel) coordinates to world coordinates */
  private screenToWorld(screenX: number, screenY: number) {
    return {
      x: screenX / this.scale + this.panX,
      y: screenY / this.scale + this.panY,
    };
  }

  /** Get bounding box for any shape (in world coordinates) */
  private getShapeBounds(shape: Shape): { minX: number; minY: number; maxX: number; maxY: number } {
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
    } else {
      // pencil — bounding box of all points
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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
      return wx >= bounds.minX && wx <= bounds.maxX && wy >= bounds.minY && wy <= bounds.maxY;
    } else if (shape.type === "circle") {
      const dx = wx - shape.centerX;
      const dy = wy - shape.centerY;
      return dx * dx + dy * dy <= shape.radius * shape.radius;
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
  private pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
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

  clearCanvas() {
    // Reset transform to identity so clearRect covers the whole physical canvas
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "rgba(0, 0, 0)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

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
      // Highlight selected shape with a blue stroke
      if (index === this.selectedShapeIndex) {
        this.ctx.strokeStyle = "rgba(59, 130, 246)";
        this.ctx.lineWidth = 2 / this.scale;
      } else {
        this.ctx.strokeStyle = "rgba(255, 255, 255)";
        this.ctx.lineWidth = 1 / this.scale;
      }

      if (shape.type === "rect") {
        this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
      } else if (shape.type === "circle") {
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
      } else if (shape.type === "pencil") {
        this.drawPencilShape(shape.points);
      }

      // Draw selection bounding box
      if (index === this.selectedShapeIndex) {
        const bounds = this.getShapeBounds(shape);
        const padding = 4 / this.scale;
        this.ctx.setLineDash([6 / this.scale, 4 / this.scale]);
        this.ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
        this.ctx.strokeRect(
          bounds.minX - padding,
          bounds.minY - padding,
          bounds.maxX - bounds.minX + padding * 2,
          bounds.maxY - bounds.minY + padding * 2,
        );
        this.ctx.setLineDash([]);
      }
    });

    // Reset lineWidth
    this.ctx.lineWidth = 1;

    this.ctx.restore();
  }

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
        JSON.stringify({ type: "undo", roomId: this.roomId }),
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
        JSON.stringify({ type: "redo", roomId: this.roomId }),
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

  wheelHandler = (e: WheelEvent) => {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // World position under the cursor before zoom
    const worldBefore = this.screenToWorld(mouseX, mouseY);

    // Apply zoom (clamp between 0.1x and 10x)
    const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.scale = Math.min(Math.max(this.scale * zoomFactor, 0.1), 10);

    // World position under the cursor after zoom (with old panX/panY)
    const worldAfter = this.screenToWorld(mouseX, mouseY);

    // Adjust pan so the world point under cursor stays fixed
    this.panX -= worldAfter.x - worldBefore.x;
    this.panY -= worldAfter.y - worldBefore.y;

    this.clearCanvas();
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
        this.isDragging = true;
        // Store offset from click to shape origin for smooth dragging
        const shape = this.existingShapes[hitIndex]!;
        const bounds = this.getShapeBounds(shape);
        this.dragOffsetX = world.x - bounds.minX;
        this.dragOffsetY = world.y - bounds.minY;
        this.canvas.style.cursor = "move";
      } else {
        this.selectedShapeIndex = null;
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
            roomId: this.roomId,
          }),
        );
        this.clearCanvas();
      }
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
      };
    } else if (selectedTool === "circle") {
      const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
      shape = {
        type: "circle",
        radius,
        centerX: this.startX + (width > 0 ? radius : -radius),
        centerY: this.startY + (height > 0 ? radius : -radius),
      };
    } else if (selectedTool === "pencil") {
      // Add the final point and use the accumulated points
      this.currentPencilPoints.push({ x: endX, y: endY });
      shape = {
        type: "pencil",
        points: [...this.currentPencilPoints],
      };
      this.currentPencilPoints = [];
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
    }

    this.ctx.restore();
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

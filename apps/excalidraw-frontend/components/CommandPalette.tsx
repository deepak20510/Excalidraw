"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Search,
  Plus,
  Download,
  Sun,
  Moon,
  Link,
  Home,
  Undo2,
  Redo2,
  Lock,
  Unlock,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  group: string;
  shortcut?: string;
  adminOnly?: boolean;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  isLocked: boolean;
  roomId: string;
  onExportPNG: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleLock: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onCreateRoom: () => void;
}

function useTheme() {
  const [dark, setDark] = useState(true);
  const toggle = useCallback(() => {
    setDark((v) => {
      const next = !v;
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }, []);
  return { dark, toggle };
}

export function CommandPalette({
  isOpen,
  onClose,
  isAdmin,
  isLocked,
  roomId,
  onExportPNG,
  onUndo,
  onRedo,
  onToggleLock,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onCreateRoom,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { dark, toggle: toggleTheme } = useTheme();

  const commands: Command[] = [
    {
      id: "create-room",
      label: "Create New Room",
      description: "Start a new collaborative canvas",
      icon: <Plus size={14} />,
      group: "Actions",
      action: () => { onClose(); onCreateRoom(); },
    },
    {
      id: "export-png",
      label: "Export as PNG",
      description: "Download canvas as a PNG image",
      icon: <Download size={14} />,
      group: "Actions",
      shortcut: "⇧⌘E",
      action: () => { onClose(); onExportPNG(); },
    },
    {
      id: "invite-user",
      label: "Copy Invite Link",
      description: "Share this room with others",
      icon: <Link size={14} />,
      group: "Actions",
      action: () => {
        navigator.clipboard.writeText(window.location.href);
        onClose();
      },
    },
    {
      id: "toggle-theme",
      label: dark ? "Switch to Light Mode" : "Switch to Dark Mode",
      description: "Toggle the canvas theme",
      icon: dark ? <Sun size={14} /> : <Moon size={14} />,
      group: "View",
      action: () => { toggleTheme(); onClose(); },
    },
    {
      id: "zoom-in",
      label: "Zoom In",
      icon: <ZoomIn size={14} />,
      group: "View",
      shortcut: "Ctrl++",
      action: () => { onClose(); onZoomIn(); },
    },
    {
      id: "zoom-out",
      label: "Zoom Out",
      icon: <ZoomOut size={14} />,
      group: "View",
      shortcut: "Ctrl+-",
      action: () => { onClose(); onZoomOut(); },
    },
    {
      id: "fit-screen",
      label: "Fit to Screen",
      description: "Fit all shapes into view",
      icon: <Maximize2 size={14} />,
      group: "View",
      shortcut: "Ctrl+Shift+H",
      action: () => { onClose(); onFitToScreen(); },
    },
    {
      id: "undo",
      label: "Undo",
      icon: <Undo2 size={14} />,
      group: "History",
      shortcut: "Ctrl+Z",
      action: () => { onClose(); onUndo(); },
    },
    {
      id: "redo",
      label: "Redo",
      icon: <Redo2 size={14} />,
      group: "History",
      shortcut: "Ctrl+Y",
      action: () => { onClose(); onRedo(); },
    },
    {
      id: "lock-canvas",
      label: isLocked ? "Unlock Canvas" : "Lock Canvas",
      description: isLocked ? "Allow all users to draw" : "Make canvas read-only for non-admins",
      icon: isLocked ? <Unlock size={14} /> : <Lock size={14} />,
      group: "Admin",
      adminOnly: true,
      action: () => { onClose(); onToggleLock(); },
    },
    {
      id: "go-home",
      label: "Go to Home",
      description: "Return to the dashboard",
      icon: <Home size={14} />,
      group: "Navigation",
      action: () => { onClose(); router.push("/"); },
    },
  ];

  const filtered = commands.filter((cmd) => {
    if (cmd.adminOnly && !isAdmin) return false;
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      (cmd.description ?? "").toLowerCase().includes(q) ||
      cmd.group.toLowerCase().includes(q)
    );
  });

  // Group commands
  const groups = Array.from(new Set(filtered.map((c) => c.group)));

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        filtered[activeIndex]?.action();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, filtered, activeIndex, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-active="true"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!isOpen) return null;

  let globalIndex = 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
          <Search size={15} className="text-zinc-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
          />
          <kbd className="text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-white/10 px-1.5 py-0.5 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-96 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-zinc-600 text-sm">
              No commands found
            </div>
          ) : (
            groups.map((group) => {
              const groupCommands = filtered.filter((c) => c.group === group);
              return (
                <div key={group}>
                  <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                    {group}
                  </p>
                  {groupCommands.map((cmd) => {
                    const itemIndex = globalIndex++;
                    const isActive = itemIndex === activeIndex;
                    return (
                      <button
                        key={cmd.id}
                        data-active={isActive}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                        onClick={cmd.action}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isActive ? "bg-indigo-500/15" : "hover:bg-white/5"
                        }`}
                      >
                        <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                          isActive ? "bg-indigo-500/30 text-indigo-300" : "bg-zinc-800 text-zinc-400"
                        }`}>
                          {cmd.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isActive ? "text-white" : "text-zinc-300"}`}>
                            {cmd.label}
                          </p>
                          {cmd.description && (
                            <p className="text-[11px] text-zinc-600 truncate">{cmd.description}</p>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <kbd className="text-[10px] font-mono bg-zinc-800 text-zinc-500 border border-white/10 px-1.5 py-0.5 rounded flex-shrink-0">
                            {cmd.shortcut}
                          </kbd>
                        )}
                        {isActive && (
                          <kbd className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded flex-shrink-0">
                            ↵
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-white/10 px-4 py-2 flex items-center gap-4">
          <span className="text-[10px] text-zinc-600">
            <kbd className="font-mono bg-zinc-800 border border-white/10 px-1 py-0.5 rounded mr-1">↑↓</kbd>
            navigate
          </span>
          <span className="text-[10px] text-zinc-600">
            <kbd className="font-mono bg-zinc-800 border border-white/10 px-1 py-0.5 rounded mr-1">↵</kbd>
            select
          </span>
          <span className="text-[10px] text-zinc-600">
            <kbd className="font-mono bg-zinc-800 border border-white/10 px-1 py-0.5 rounded mr-1">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}

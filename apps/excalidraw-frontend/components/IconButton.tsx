import { ReactNode } from "react";

export function IconButton({
  icon,
  onClick,
  activated,
  label,
  shortcut,
  title,
  disabled,
}: {
  icon: ReactNode;
  onClick: () => void;
  activated?: boolean;
  label?: string;
  shortcut?: string;
  title?: string;
  disabled?: boolean;
}) {
  const tooltipText = title || (label ? `${label}${shortcut ? ` (${shortcut})` : ""}` : undefined);

  return (
    <div className="relative group/tool flex items-center justify-center">
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        aria-label={label || title || "Tool"}
        disabled={disabled}
        className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 select-none ${
          disabled
            ? "opacity-30 cursor-not-allowed border border-transparent text-zinc-600"
            : activated
            ? "cursor-pointer bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-105 font-medium border border-indigo-400/40 ring-2 ring-indigo-500/20"
            : "cursor-pointer text-zinc-400 hover:text-zinc-100 hover:bg-white/10 active:scale-95 border border-transparent"
        }`}
      >
        <div className="w-4 h-4 flex items-center justify-center pointer-events-none">
          {icon}
        </div>
        {shortcut && (
          <span
            className={`absolute bottom-0.5 right-1 text-[9px] font-bold leading-none select-none tracking-tight ${
              activated ? "text-indigo-200/90" : "text-zinc-500 group-hover/tool:text-zinc-300"
            }`}
          >
            {shortcut}
          </span>
        )}
      </button>

      {tooltipText && (
        <div className="absolute bottom-full mb-2 hidden group-hover/tool:flex flex-col items-center pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1 rounded-lg bg-zinc-900/95 border border-white/10 shadow-xl backdrop-blur-md text-[11px] font-medium text-zinc-200 whitespace-nowrap flex items-center gap-1.5">
            <span>{label || title}</span>
            {shortcut && (
              <kbd className="px-1 py-0.2 text-[9px] font-semibold bg-zinc-800 text-zinc-400 border border-white/10 rounded uppercase">
                {shortcut}
              </kbd>
            )}
          </div>
          <div className="w-2 h-2 -mt-1 bg-zinc-900 border-r border-b border-white/10 transform rotate-45" />
        </div>
      )}
    </div>
  );
}

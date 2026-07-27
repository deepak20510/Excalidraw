"use client";

import { useEffect, useRef, useState } from "react";
import {
  Users,
  Crown,
  Lock,
  Unlock,
  UserX,
  Eye,
  Pencil,
  ChevronDown,
  ChevronUp,
  Hand,
} from "lucide-react";

export interface PresenceMember {
  userId: string;
  name: string;
}

interface CollaborationPanelProps {
  roomId: string;
  roomName: string;
  currentUserId: string;
  isAdmin: boolean;
  isLocked: boolean;
  members: PresenceMember[];
  /** Last known cursor position per userId (screen coords) */
  cursorPositions: Map<string, { x: number; y: number }>;
  onFollowUser: (userId: string) => void;
  onKickUser: (userId: string) => void;
  onToggleLock: () => void;
  onSetRole: (userId: string, role: "editor" | "viewer") => void;
  memberRoles: Record<string, "editor" | "viewer">;
  pendingRequests?: Array<{ requesterId: string; requesterName: string }>;
  onGrantPermission?: (requesterId: string) => void;
  onDeclinePermission?: (requesterId: string) => void;
  onSendPermissionRequest?: () => void;
  hasRequestedPermission?: boolean;
}

const AVATAR_COLORS = [
  "from-indigo-500 to-purple-600",
  "from-pink-500 to-rose-600",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-blue-600",
  "from-violet-500 to-fuchsia-600",
];

function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function CollaborationPanel({
  roomId,
  roomName,
  currentUserId,
  isAdmin,
  isLocked,
  members,
  cursorPositions,
  onFollowUser,
  onKickUser,
  onToggleLock,
  onSetRole,
  memberRoles,
  pendingRequests = [],
  onGrantPermission,
  onDeclinePermission,
  onSendPermissionRequest,
  hasRequestedPermission = false,
}: CollaborationPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const myRole = memberRoles[currentUserId] ?? "editor";

  return (
    <div className="fixed top-4 right-4 z-50 w-72 animate-in fade-in slide-in-from-top-4 duration-300">
      {/* Header card */}
      <div className="bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors select-none"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-tr from-indigo-500 to-purple-600 p-1.5 rounded-lg">
              <Users size={13} className="text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-white leading-tight truncate max-w-[130px]">
                {roomName}
              </p>
              <p className="text-[10px] text-zinc-500">
                {members.length} {members.length === 1 ? "member" : "members"} online
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLocked && (
              <span className="bg-red-500/20 border border-red-500/30 text-red-400 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full tracking-wide">
                Locked
              </span>
            )}
            {expanded ? (
              <ChevronUp size={14} className="text-zinc-500" />
            ) : (
              <ChevronDown size={14} className="text-zinc-500" />
            )}
          </div>
        </div>

        {/* Pending Permission Requests Banner for Admin */}
        {isAdmin && expanded && pendingRequests.length > 0 && (
          <div className="border-t border-amber-500/20 bg-amber-500/10 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold text-[11px]">
              <Hand size={13} className="animate-bounce" />
              <span>Permission Request ({pendingRequests.length})</span>
            </div>
            {pendingRequests.map((req) => (
              <div
                key={req.requesterId}
                className="flex items-center justify-between text-xs bg-zinc-900/90 p-2 rounded-xl border border-white/10"
              >
                <span className="text-zinc-200 font-medium truncate max-w-[100px]">
                  {req.requesterName}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onGrantPermission?.(req.requesterId)}
                    className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-lg hover:bg-emerald-500/30 transition-colors"
                  >
                    Grant Editor
                  </button>
                  <button
                    onClick={() => onDeclinePermission?.(req.requesterId)}
                    className="text-zinc-500 hover:text-zinc-300 text-[10px] px-1 py-0.5"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Collapsed: show avatar strip */}
        {!expanded && (
          <div className="px-4 pb-3 flex items-center gap-1">
            {members.slice(0, 5).map((m) => (
              <button
                key={m.userId}
                title={`Follow ${m.name}`}
                onClick={() => onFollowUser(m.userId)}
                className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarColor(m.userId)} flex items-center justify-center text-[10px] font-bold text-white shadow-lg border-2 border-zinc-900 hover:scale-110 transition-transform -ml-1 first:ml-0`}
              >
                {getInitials(m.name)}
              </button>
            ))}
            {members.length > 5 && (
              <span className="text-[10px] text-zinc-500 ml-1">
                +{members.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Expanded member list */}
        {expanded && (
          <div className="border-t border-white/5 max-h-72 overflow-y-auto" ref={dropdownRef}>
            {members.length === 0 ? (
              <div className="py-6 text-center text-zinc-600 text-xs">
                No other members online
              </div>
            ) : (
              <div className="py-1.5 flex flex-col gap-0.5">
                {members.map((member) => {
                  const isSelf = member.userId === currentUserId;
                  const isAdminMember = member.userId === currentUserId && isAdmin;
                  const role = memberRoles[member.userId] ?? "editor";
                  const hasCursor = cursorPositions.has(member.userId);
                  const showDropdown = openDropdown === member.userId;

                  return (
                    <div
                      key={member.userId}
                      className="mx-2 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          <div
                            className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(member.userId)} flex items-center justify-center text-[11px] font-bold text-white shadow-md`}
                          >
                            {getInitials(member.name)}
                          </div>
                          {/* Online indicator */}
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-zinc-900 rounded-full" />
                        </div>

                        {/* Name + role */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-semibold text-white truncate">
                              {member.name}
                              {isSelf && (
                                <span className="text-zinc-500 font-normal ml-1">(you)</span>
                              )}
                            </span>
                            {isAdminMember && (
                              <Crown size={10} className="text-amber-400 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {role === "editor" ? (
                              <Pencil size={9} className="text-indigo-400" />
                            ) : (
                              <Eye size={9} className="text-zinc-500" />
                            )}
                            <span className={`text-[10px] capitalize ${role === "editor" ? "text-indigo-400" : "text-zinc-500"}`}>
                              {role}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        {!isSelf && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Follow button */}
                            {hasCursor && (
                              <button
                                title={`Follow ${member.name}`}
                                onClick={() => onFollowUser(member.userId)}
                                className="text-[9px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-1 rounded-lg hover:bg-indigo-500/30 transition-colors"
                              >
                                Follow
                              </button>
                            )}

                            {/* Admin actions */}
                            {isAdmin && (
                              <div className="relative">
                                <button
                                  title="Member options"
                                  onClick={() => setOpenDropdown(showDropdown ? null : member.userId)}
                                  className="w-6 h-6 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/5 text-zinc-400 hover:text-zinc-200 transition-colors"
                                >
                                  <ChevronDown size={10} />
                                </button>

                                {showDropdown && (
                                  <div className="absolute right-0 top-7 w-36 bg-zinc-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                                    <button
                                      onClick={() => {
                                        onSetRole(member.userId, role === "editor" ? "viewer" : "editor");
                                        setOpenDropdown(null);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-zinc-300 hover:bg-white/5 transition-colors"
                                    >
                                      {role === "editor" ? <Eye size={12} /> : <Pencil size={12} />}
                                      Make {role === "editor" ? "Viewer" : "Editor"}
                                    </button>
                                    <div className="border-t border-white/10 my-1" />
                                    <button
                                      onClick={() => {
                                        onKickUser(member.userId);
                                        setOpenDropdown(null);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-red-400 hover:bg-red-500/10 transition-colors"
                                    >
                                      <UserX size={12} />
                                      Kick from Room
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Viewer Permission Request Button */}
        {!isAdmin && expanded && (myRole === "viewer" || isLocked) && (
          <div className="border-t border-white/10 px-4 py-3">
            <button
              onClick={onSendPermissionRequest}
              disabled={hasRequestedPermission}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl border text-[11px] font-semibold transition-all ${
                hasRequestedPermission
                  ? "bg-zinc-800/40 border-white/5 text-zinc-500 cursor-not-allowed"
                  : "bg-indigo-500/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30"
              }`}
            >
              <Hand size={12} />
              {hasRequestedPermission ? "Permission Request Sent" : "Ask Admin for Draw Permission"}
            </button>
          </div>
        )}

        {/* Admin lock controls */}
        {isAdmin && expanded && (
          <div className="border-t border-white/10 px-4 py-3">
            <button
              onClick={onToggleLock}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl border text-[11px] font-semibold transition-all ${
                isLocked
                  ? "bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30"
                  : "bg-zinc-800/60 border-white/10 text-zinc-300 hover:bg-white/10"
              }`}
            >
              {isLocked ? (
                <>
                  <Unlock size={12} />
                  Unlock Canvas
                </>
              ) : (
                <>
                  <Lock size={12} />
                  Lock Canvas (Read-only)
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

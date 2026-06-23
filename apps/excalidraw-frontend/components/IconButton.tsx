import { ReactNode } from "react";

export function IconButton({
  icon,
  onClick,
  activated,
}: {
  icon: ReactNode;
  onClick: () => void;
  activated?: boolean;
}) {
  return (
    <button
      type="button"
      className={`rounded-full border p-2 bg-black transition-colors hover:bg-gray-600 ${
        activated ? "text-red-400" : "text-white"
      }`}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

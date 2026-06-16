import { Building2 } from "lucide-react";

interface DeptBadgeProps {
  department: string;
  size?: "sm" | "md";
}

const DEPT_COLOURS: Record<string, { bg: string; text: string }> = {
  HR: { bg: "bg-emerald-100", text: "text-emerald-800" },
  Finance: { bg: "bg-amber-100", text: "text-amber-800" },
};

const DEFAULT_COLOUR = { bg: "bg-indigo-100", text: "text-indigo-800" };

export default function DeptBadge({ department, size = "md" }: DeptBadgeProps) {
  const colour = DEPT_COLOURS[department] ?? DEFAULT_COLOUR;

  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  const iconSize = size === "sm" ? 11 : 13;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClass} ${colour.bg} ${colour.text}`}
    >
      <Building2 size={iconSize} aria-hidden="true" />
      {department}
    </span>
  );
}

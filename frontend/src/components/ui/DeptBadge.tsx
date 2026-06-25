import { Building2 } from "lucide-react";

interface DeptBadgeProps {
  department: string;
  size?: "sm" | "md";
}

const COLOUR_PALETTE = [
  { bg: "bg-emerald-100", text: "text-emerald-800" },
  { bg: "bg-amber-100", text: "text-amber-800" },
  { bg: "bg-blue-100", text: "text-blue-800" },
  { bg: "bg-purple-100", text: "text-purple-800" },
  { bg: "bg-rose-100", text: "text-rose-800" },
  { bg: "bg-cyan-100", text: "text-cyan-800" },
  { bg: "bg-orange-100", text: "text-orange-800" },
  { bg: "bg-teal-100", text: "text-teal-800" },
];

function getDeptColour(dept: string) {
  let hash = 0;
  for (let i = 0; i < dept.length; i++) {
    hash = (hash * 31 + dept.charCodeAt(i)) & 0xffffffff;
  }
  return COLOUR_PALETTE[Math.abs(hash) % COLOUR_PALETTE.length];
}

export default function DeptBadge({ department, size = "md" }: DeptBadgeProps) {
  const colour = getDeptColour(department);

  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  const iconSize = size === "sm" ? 11 : 13;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClass} ${colour.bg} ${colour.text}`}
    >
      <Building2 size={iconSize} aria-hidden="true" />
      {department.replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { FileTypeStat } from "../../types";

const COLORS = [
  "#4f46e5",
  "#a5b4fc",
  "#c7d2fe",
  "#e0e7ff",
  "#818cf8",
  "#6366f1",
];

interface FileTypeChartProps {
  fileTypes: FileTypeStat[];
}

export default function FileTypeChart({ fileTypes }: FileTypeChartProps) {
  if (fileTypes.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-8">
        No documents yet.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div style={{ width: 120, height: 120 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={fileTypes}
              dataKey="count"
              nameKey="extension"
              innerRadius={32}
              outerRadius={56}
              paddingAngle={2}
            >
              {fileTypes.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value} files`, String(name)]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1.5">
        {fileTypes.map((type, i) => (
          <div
            key={type.extension}
            className="flex items-center justify-between text-xs"
          >
            <span className="flex items-center gap-1.5 text-slate-600">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              {type.extension}
            </span>
            <span className="text-slate-400">
              {type.percent}% · {type.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

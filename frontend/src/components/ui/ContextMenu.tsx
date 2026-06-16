import { useState } from "react";
import { MoreVertical } from "lucide-react";

export interface ContextMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
}

export default function ContextMenu({ items }: ContextMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        aria-label="More options"
      >
        <MoreVertical size={15} aria-hidden="true" />
      </button>

      {open && (
        <>
          {/* Backdrop — sits BEHIND the menu */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Menu — separate from backdrop, NOT nested inside it */}
          <div
            className="absolute right-0 top-8 z-50 min-w-[144px] rounded-lg
                 border border-slate-200 bg-white shadow-lg overflow-hidden"
          >
            {items.map((item, index) => (
              <div key={index}>
                {item.danger && index > 0 && (
                  <div className="h-px bg-slate-100 my-1" />
                )}
                <button
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm
                       text-left transition-colors
                       ${
                         item.danger
                           ? "text-red-600 hover:bg-red-50"
                           : "text-slate-700 hover:bg-slate-50"
                       }`}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {item.label}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

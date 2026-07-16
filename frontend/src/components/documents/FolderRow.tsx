import type { Folder as FolderType } from "../../types";
import ContextMenu, {
  type ContextMenuItem,
  type ContextMenuHandle,
} from "../ui/ContextMenu";
import { Pencil, Trash2, Folder } from "lucide-react";
import { useRef } from "react";

interface FolderRowProps {
  folder: FolderType;
  onOpen: (folderId: string) => void;
  onRename: (folder: FolderType) => void;
  onDelete: (folder: FolderType) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function FolderRow({
  folder,
  onOpen,
  onRename,
  onDelete,
}: FolderRowProps) {
  const menuRef = useRef<ContextMenuHandle>(null);
  const menuItems: ContextMenuItem[] = [
    {
      label: "Open",
      icon: <Folder size={14} />,
      onClick: () => onOpen(folder.folder_id),
    },
    {
      label: "Rename",
      icon: <Pencil size={14} />,
      onClick: () => onRename(folder),
    },
    {
      label: "Delete",
      icon: <Trash2 size={14} />,
      onClick: () => onDelete(folder),
      danger: true,
    },
  ];

  return (
    <div
      className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
      onDoubleClick={() => onOpen(folder.folder_id)}
      onContextMenu={(e) => {
        e.preventDefault();
        menuRef.current?.openAt(e.clientX, e.clientY);
      }}
    >
      {/* Folder Icon */}
      <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
        <Folder size={18} className="text-amber-600" aria-hidden="true" />
      </div>

      {/* Folder Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">
          {folder.name}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Folder &middot; {formatDate(folder.created_at)}
        </p>
      </div>
      <ContextMenu items={menuItems} ref={menuRef} />
    </div>
  );
}

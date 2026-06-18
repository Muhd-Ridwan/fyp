/**
 * Rename modal for files and folders
 * Submit on Enter, dismiss on Esc
 */

import { useState } from "react";
import { Pencil } from "lucide-react";

interface RenameModalProps {
  title?: string;
  currentName: string;
  onConfirm: (newName: string) => void;
  onClose: () => void;
}

export default function RenameModal({
  title = "Rename",
  currentName,
  onConfirm,
  onClose,
}: RenameModalProps) {
  const [name, setName] = useState(currentName);
  const isValid = name.trim().length > 0 && name.trim() !== currentName;

  function handleConfirm() {
    if (!isValid) return;
    onConfirm(name.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Modal Panel */}
      <div
        className="relative z-10 w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-xl p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-modal-title"
      >
        {/* Icon */}
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
          <Pencil size={18} className="text-indigo-600" aria-hidden="true" />
        </div>
        <h2
          id="rename-modal-title"
          className="text-base font-semibold text-slate-900 mb-1"
        >
          {title}
        </h2>
        <p className="text-sm text-slate-500 mb-4">Enter a new name below</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirm();
            if (e.key === "Escape") onClose();
          }}
          autoFocus
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-900 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-colors"
        />

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Used for:
 *  - Delete file
 *  - Delete folder
 */

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  title: string;
  description: string;
  onConfirm: () => void;
  onClose: () => void;
}

const CONFIRM_WORD = "confirm";

export default function ConfirmModal({
  title,
  description,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const [input, setInput] = useState("");
  const isValid = input.toLowerCase() === CONFIRM_WORD;

  function handleConfirm() {
    if (!isValid) return;
    onConfirm();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop  */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel  */}
      <div
        className="relative z-10 w-full max-w-sm bg-white rounded-xl
                 border border-slate-200 shadow-xl p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div
          className="w-10 h-10 rounded-full bg-red-100 flex items-center
                      justify-center mb-4"
        >
          <AlertTriangle
            size={20}
            className="text-red-600"
            aria-hidden="true"
          />
        </div>

        <h2
          id="confirm-modal-title"
          className="text-base font-semibold text-slate-900 mb-1"
        >
          {title}
        </h2>

        <p className="text-sm text-slate-500 mb-4 leading-relaxed">
          {description}
        </p>

        <p className="text-sm text-slate-600 mb-2">
          Type{" "}
          <span className="font-mono font-medium text-slate-900">
            {CONFIRM_WORD}
          </span>{" "}
          to continue:
        </p>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirm();
            if (e.key === "Escape") onClose();
          }}
          placeholder="confirm"
          autoFocus
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
                   bg-slate-50 text-slate-900 placeholder-slate-400 mb-4
                   focus:outline-none focus:ring-2 focus:ring-red-300
                   focus:border-red-400 transition-colors"
        />

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600
                     border border-slate-200 rounded-lg hover:bg-slate-50
                     transition-colors focus:outline-none focus:ring-2
                     focus:ring-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg
                     bg-red-600 hover:bg-red-700 transition-colors
                     focus:outline-none focus:ring-2 focus:ring-red-300
                     disabled:opacity-40 disabled:cursor-not-allowed
                     disabled:hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

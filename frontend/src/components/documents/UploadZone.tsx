/**
 * Drag & Drop file upload zone
 * Accept click to browse
 */

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";

interface UploadZoneProps {
  onUpload: (files: File[]) => void;
  uploading: boolean;
}

const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
  ".txt",
];

export default function UploadZone({ onUpload, uploading }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: File[]) {
    if (!uploading) onUpload(files);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) handleFiles(files);
  }

  return (
    <div
      onClick={() => !uploading && inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors cursor-pointer select-none ${uploading ? "border-slate-200 bg-slate-50 cursor-not-allowed" : isDragging ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"}`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) handleFiles(files);
          e.target.value = "";
        }}
      />

      <div className="flex flex-col items-center gap-2 pointer-events-none">
        {uploading ? (
          <>
            <Loader2
              size={28}
              className="text-indigo-500 animate-spin"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-slate-600">Uploading...</p>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
              <Upload
                size={18}
                className="text-indigo-500"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">
                <span className="text-indigo-600">Click to upload</span> or drag
                and drop
              </p>
              <p className="text-xs text-slate-400 mt-1">
                PDF, DOCX, TXT, XLSX, CSV, PPTX, PNG, JPEG
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

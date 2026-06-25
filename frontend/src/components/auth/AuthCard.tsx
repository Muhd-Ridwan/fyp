import type { ReactNode } from "react";
import { FolderLock } from "lucide-react";

export default function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50/60 via-white to-violet-50/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md">
            <FolderLock size={22} className="text-white" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">DocuVault AI</h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Document Management System
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white/90 p-8 shadow-sm backdrop-blur-sm">
          {children}
        </div>
      </div>
    </div>
  );
}

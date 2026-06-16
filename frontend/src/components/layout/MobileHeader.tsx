/**
 * Top nav bar shown only on mobile (hidden on others)
 */

import { Menu, CloudSnow } from "lucide-react";
import type { EmployeeProfile } from "../../types";
import DeptBadge from "../ui/DeptBadge";

interface MobileHeaderProps {
  profile: EmployeeProfile;
  onMenuOpen: () => void;
}

export default function MobileHeader({
  profile,
  onMenuOpen,
}: MobileHeaderProps) {
  return (
    <header className="md:hidden flex items-center justify-between px-4 h-14 bg-white border-b border-slate-200 flex-shrink-0">
      <button
        onClick={onMenuOpen}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        aria-label="Open menu"
      >
        <Menu size={20} aria-hidden="true" />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
          <CloudSnow size={13} className="text-white" aria-hidden="true" />
        </div>
        <span className="text-sm font-semibold text-slate-900">
          DocuVault AI
        </span>
      </div>
      <DeptBadge department={profile.department} size="sm" />
    </header>
  );
}

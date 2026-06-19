/**
 * Main layout wrapper for authenticated app.
 * Owns sidebar collapsed & mobile open/close state.
 * Renders sidebar + MobileHeader + main content area
 */

import { useState } from "react";
import Sidebar, { type AppView } from "./Sidebar";
import MobileHeader from "./MobileHeader";
import type { EmployeeProfile } from "../../types";

interface AppShellProps {
  profile: EmployeeProfile;
  onSignOut: () => void;
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  children: React.ReactNode;
}

export default function AppShell({
  profile,
  onSignOut,
  currentView,
  onViewChange,
  children,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        currentView={currentView}
        onViewChange={onViewChange}
        profile={profile}
        onSignOut={onSignOut}
      />

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <MobileHeader
          profile={profile}
          onMenuOpen={() => setMobileSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

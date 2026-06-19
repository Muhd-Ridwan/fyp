/**
 * Application sidebar
 * Mobile (<md)
 * Desktop (>=md)
 */

import {
  CloudSnow,
  Folder,
  MessageSquare,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  ShieldCheck,
} from "lucide-react";
import type { EmployeeProfile } from "../../types";
import DeptBadge from "../ui/DeptBadge";

export type AppView = "documents" | "ai" | "profile" | "admin";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  profile: EmployeeProfile;
  onSignOut: () => void;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, active, collapsed, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={`w-full flex items-center gap-2.5 rounded-lg text-sm transition-colors text-left ${collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2"} ${active ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
    >
      <span className="flex-shrink-0">{icon}</span>
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

function getUserInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
  currentView,
  onViewChange,
  profile,
  onSignOut,
}: SidebarProps) {
  const isAdmin = profile.role === "System Administrator";

  function handleViewChange(view: AppView) {
    onViewChange(view);
    onMobileClose();
  }
  const showCollapsed = collapsed && !mobileOpen;

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 w-48 flex flex-col",
          "bg-white border-r border-slate-200",
          "transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:static md:translate-x-0 md:flex-shrink-0",
          showCollapsed ? "md:w-14" : "md:w-48",
        ].join(" ")}
      >
        {/* Brand + toggle */}
        <div
          className={`flex items-center h-14 border-b border-slate-100 flex-shrink-0 ${showCollapsed ? "justify-center px-3" : "justify-between px-4"}`}
        >
          {!showCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                <CloudSnow
                  size={14}
                  className="text-white"
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 loading-tight truncate">
                  DocuVault AI
                </p>
                <p className="text-xs text-slate-400">Document Management</p>
              </div>
            </div>
          )}

          {/* Desktop Collapse Toggle */}
          <button
            onClick={onToggleCollapse}
            title={showCollapsed ? "Expand sidebar" : "Collapse sidbar"}
            aria-label={showCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden md:flex w-8 h-8 items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            {showCollapsed ? (
              <ChevronRight size={15} aria-hidden="true" />
            ) : (
              <ChevronLeft size={15} aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Dept Badge */}
        <div
          className={`border-b border-slate-100 ${showCollapsed ? "px-2 py-3 flex justify-center" : "px-4 py-3"}`}
        >
          {!showCollapsed && (
            <div>
              <DeptBadge department={profile.department} size="md" />
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                You can only access your department's documents.
              </p>
            </div>
          )}
        </div>

        {/* Nav Items */}
        <nav
          className={`flex-1 py-3 space-y-0.5 ${showCollapsed ? "px-2" : "px-3"}`}
        >
          <NavItem
            icon={<Folder size={16} />}
            label="Documents"
            active={currentView === "documents"}
            collapsed={showCollapsed}
            onClick={() => handleViewChange("documents")}
          />
          <NavItem
            icon={<MessageSquare size={16} />}
            label="AI Assistant"
            active={currentView === "ai"}
            collapsed={showCollapsed}
            onClick={() => handleViewChange("ai")}
          />
          <NavItem
            icon={<User size={16} />}
            label="My Profile"
            active={currentView === "profile"}
            collapsed={showCollapsed}
            onClick={() => handleViewChange("profile")}
          />
          {isAdmin && (
            <NavItem
              icon={<ShieldCheck size={16} />}
              label="Admin"
              active={currentView === "admin"}
              collapsed={showCollapsed}
              onClick={() => handleViewChange("admin")}
            />
          )}
        </nav>

        {/* User info + Sign out */}
        <div
          className={`border-t border-slate-100 py-3 flex-shrink-0 ${showCollapsed ? "px-2" : "px-4"}`}
        >
          {!showCollapsed && (
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-indigo-700">
                  {getUserInitials(profile.name)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {profile.name}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {profile.email}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={onSignOut}
            title={showCollapsed ? "Sign Out" : undefined}
            aria-label="Sign out"
            className={`flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 transition-colors rounded-lg py-1.5 ${showCollapsed ? "justify-center w-full px-2" : "px-1"}`}
          >
            <LogOut size={15} aria-hidden="true" />
            {!showCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

/**
 * Post-login dashboard. Shows a different title based on the
 * employee's department (from the backend's /me response).
 */

import { useAuth } from "../auth/AuthContext";

const DASHBOARD_TITLES: Record<string, string> = {
  HR: "HR Dashboard",
  Finance: "Finance Dashboard",
};

export default function Dashboard() {
  const { profile, logout } = useAuth();

  if (!profile) {
    return null;
  }

  const title =
    DASHBOARD_TITLES[profile.department] ?? `${profile.department} Dashboard`;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <button
            onClick={logout}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Sign out
          </button>
        </div>

        <p className="text-sm text-slate-600">
          Logged in as <span className="font-medium">{profile.name}</span> (
          {profile.email}) — role: {profile.role}
        </p>
      </div>
    </div>
  );
}

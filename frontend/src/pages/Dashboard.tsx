/**
 * Post-login dashboard. Shows a different title based on the
 * employee's department (from the backend's /me response).
 */

import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import AppShell from "../components/layout/AppShell";
import DocumentsPage from "./DocumentsPage";
import AIAssistantPage from "./AIAssistantPage";

export default function Dashboard() {
  const { profile, tokens, logout } = useAuth();
  const [currentView, setCurrentView] = useState<"documents" | "ai">(
    "documents",
  );

  if (!profile || !tokens) {
    return null;
  }

  return (
    <AppShell
      profile={profile}
      onSignOut={logout}
      currentView={currentView}
      onViewChange={setCurrentView}
    >
      {currentView === "documents" ? (
        <DocumentsPage profile={profile} idToken={tokens.idToken} />
      ) : (
        <AIAssistantPage profile={profile} idToken={tokens.idToken} />
      )}
    </AppShell>
  );
}

/**
 * Post-login dashboard. Shows a different title based on the
 * employee's department (from the backend's /me response).
 */

import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import AppShell from "../components/layout/AppShell";
import { type AppView } from "../components/layout/Sidebar";
import DocumentsPage from "./DocumentsPage";
import AIAssistantPage from "./AIAssistantPage";
import ProfilePage from "./ProfilePage";
import AdminDashboard from "./AdminDashboard";
import type { Message } from "../types";

export default function Dashboard() {
  const { profile, tokens, logout } = useAuth();
  const [currentView, setCurrentView] = useState<AppView>("documents");
  const [messages, setMessages] = useState<Message[]>([]);
  const [initialPrompt, setInitialPrompt] = useState("");

  function handleAskAI(prompt: string) {
    setInitialPrompt(prompt);
    setCurrentView("ai");
  }

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
      {currentView === "documents" && (
        <DocumentsPage
          profile={profile}
          idToken={tokens.idToken}
          onAskAI={handleAskAI}
        />
      )}
      {currentView === "ai" && (
        <AIAssistantPage
          profile={profile}
          idToken={tokens.idToken}
          messages={messages}
          setMessages={setMessages}
          onClearChat={() => setMessages([])}
          initialPrompt={initialPrompt}
          onConsumePrompt={() => setInitialPrompt("")}
        />
      )}
      {currentView === "profile" && (
        <ProfilePage idToken={tokens.idToken} profile={profile} />
      )}
      {currentView === "admin" && profile.role === "System Administrator" && (
        <AdminDashboard idToken={tokens.idToken} />
      )}
    </AppShell>
  );
}

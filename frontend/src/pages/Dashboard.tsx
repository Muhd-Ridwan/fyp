/**
 * Post-login dashboard. Shows a different title based on the
 * employee's department (from the backend's /me response).
 */

import { useState, useEffect } from "react";
import { useAuth } from "../auth/useAuth";
import AppShell from "../components/layout/AppShell";
import { type AppView } from "../components/layout/Sidebar";
import DocumentsPage from "./DocumentsPage";
import AIAssistantPage from "./AIAssistantPage";
import ProfilePage from "./ProfilePage";
import AdminDashboard from "./AdminDashboard";
import type {
  Message,
  Document,
  ActiveFileContext,
  PendingSummarize,
} from "../types";

const CHAT_STORAGE_KEY = "docuvault_chat_messages";
const ACTIVE_FILE_STORAGE_KEY = "docuvault_chat_active_file";

export default function Dashboard() {
  const { profile, tokens, logout } = useAuth();
  const [currentView, setCurrentView] = useState<AppView>("documents");
  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  const [initialPrompt, setInitialPrompt] = useState("");
  const [activeFile, setActiveFile] = useState<ActiveFileContext | null>(() => {
    const stored = localStorage.getItem(ACTIVE_FILE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [pendingSummarize, setPendingSummarize] =
    useState<PendingSummarize | null>(null);

  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (activeFile) {
      localStorage.setItem(ACTIVE_FILE_STORAGE_KEY, JSON.stringify(activeFile));
    } else {
      localStorage.removeItem(ACTIVE_FILE_STORAGE_KEY);
    }
  }, [activeFile]);

  function handleAskAI(prompt: string) {
    setInitialPrompt(prompt);
    setCurrentView("ai");
  }

  function handleSummarize(document: Document) {
    setPendingSummarize({
      fileId: document.file_id,
      fileName: document.display_name,
      requestId: crypto.randomUUID(),
    });
    setCurrentView("ai");
  }

  function handleSignOut() {
    setMessages([]);
    setActiveFile(null);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_FILE_STORAGE_KEY);
    logout();
  }

  if (!profile || !tokens) {
    return null;
  }

  return (
    <AppShell
      profile={profile}
      onSignOut={handleSignOut}
      currentView={currentView}
      onViewChange={setCurrentView}
    >
      {currentView === "documents" && (
        <DocumentsPage
          profile={profile}
          idToken={tokens.idToken}
          onAskAI={handleAskAI}
          onSummarize={handleSummarize}
        />
      )}
      {currentView === "ai" && (
        <AIAssistantPage
          profile={profile}
          idToken={tokens.idToken}
          messages={messages}
          setMessages={setMessages}
          onClearChat={() => {
            setMessages([]);
            setActiveFile(null);
            localStorage.removeItem(CHAT_STORAGE_KEY);
            localStorage.removeItem(ACTIVE_FILE_STORAGE_KEY);
          }}
          activeFile={activeFile}
          setActiveFile={setActiveFile}
          pendingSummarize={pendingSummarize}
          onConsumeSummarize={() => setPendingSummarize(null)}
          initialPrompt={initialPrompt}
          onConsumePrompt={() => setInitialPrompt("")}
        />
      )}
      {currentView === "profile" && (
        <ProfilePage idToken={tokens.idToken} profile={profile} />
      )}
      {currentView === "admin" && profile.role === "system_admin" && (
        <AdminDashboard idToken={tokens.idToken} />
      )}
    </AppShell>
  );
}

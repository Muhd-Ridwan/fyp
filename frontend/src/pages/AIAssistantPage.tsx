/**
 * AI Assistant page
 */

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import type { EmployeeProfile } from "../types";
import DeptBadge from "../components/ui/DeptBadge";

interface AIAssistantPageProps {
  profile: EmployeeProfile;
  idToken: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESSTIONS = [
  "Summarise any documents",
  "List key points from the reports",
];

export default function AIAssistantPage({ profile }: AIAssistantPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    // PLACEHOLDER - Later will replace with real RAG call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const aiMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "The RAG pipeline is not yet connected." +
        "I will search your department's doc and respond with grounded, " +
        "cited answers based on the actual content of your uploaded files.",
    };
    setMessages((prev) => [...prev, aiMessage]);
    setLoading(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header*/}
      <div className="px-4 py-4 md:px-6 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              AI Assistant
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-slate-400">Asking about</span>
              <DeptBadge department={profile.department} size="sm" />
              <span className="text-xs text-slate-400">documents only</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-xs text-amber-700 font-medium">
              Step 4 - RAG Pipeline
            </span>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
              <Sparkles
                size={24}
                className="text-indigo-500"
                aria-hidden="true"
              />
            </div>
            <h2 className="text-base font-semibold text-slate-800 mb-1">
              Ask about your documents
            </h2>
            <p className="text-sm text-slate-400 max-w-xs leading-relaxed mb-6">
              Once RAG pipeline is connected, can answer the questions
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {SUGGESSTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-left text-sm px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-indigo-300 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "bg-indigo-600 text-white rounded-br-sm" : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm"}`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3">
                  <Loader2
                    size={16}
                    className="text-indigo-500 animate-spin"
                    aria-hidden="true"
                  />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 md:px-6 border-t border-slate-200 bg-white flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "40px";
              e.target.style.height =
                Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Ask about your ${profile.department} documents...`}
            rows={1}
            style={{ height: "40px", maxHeight: "120px", overflowY: "auto" }}
            className="flex-1 resize-none text-sm px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            aria-label="Send message"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-300 flex-shrink-0"
          >
            <Send size={16} className="text-white" aria-hidden="true" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5">
          Shift + Enter for new line &middot; Enter to send
        </p>
      </div>
    </div>
  );
}

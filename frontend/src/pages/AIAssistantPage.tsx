/**
 * AI Assistant page
 */

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import type { EmployeeProfile, Message } from "../types";
import DeptBadge from "../components/ui/DeptBadge";
import { askQuestion } from "../api/chatApi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AIAssistantPageProps {
  profile: EmployeeProfile;
  idToken: string;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onClearChat: () => void;
  initialPrompt?: string;
  onConsumePrompt?: () => void;
}

const SUGGESTIONS = [
  "Summarise any documents",
  "List key points from the reports",
];

export default function AIAssistantPage({
  profile,
  idToken,
  messages,
  setMessages,
  onClearChat,
  initialPrompt,
  onConsumePrompt,
}: AIAssistantPageProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const handledPromptRef = useRef("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (initialPrompt && initialPrompt !== handledPromptRef.current) {
      handledPromptRef.current = initialPrompt;
      void handleSend(initialPrompt);
      onConsumePrompt?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  async function handleSend(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    // RAG PIPELINE
    try {
      const data = await askQuestion(idToken, text);
      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error(err);
      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
      };
      setMessages((prev) => [...prev, aiMessage]);
    } finally {
      setLoading(false);
    }
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
              <DeptBadge
                department={profile.department.toUpperCase()}
                size="sm"
              />
              <span className="text-xs text-slate-400">documents only</span>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={onClearChat}
              className="text-xs text-slate-400 border border-slate-200 rounded-md px-2.5 py-1 hover:border-red-300 hover:text-red-500 transition-colors"
            >
              Clear chat
            </button>
          )}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-xs text-amber-700 font-medium">
              RAG Powered
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
              Ask anything about your {profile.department} documents and get
              instant answers.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {SUGGESTIONS.map((suggestion) => (
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
                  {msg.role === "user" ? (
                    msg.content
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => (
                          <h1 className="text-base font-bold mt-2 mb-1">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-sm font-semibold mt-2 mb-1">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-sm font-medium mt-1 mb-1">
                            {children}
                          </h3>
                        ),
                        p: ({ children }) => (
                          <p className="mb-2 last:mb-0">{children}</p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc pl-4 mb-2 space-y-0.5">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal pl-4 mb-2 space-y-0.5">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => <li>{children}</li>,
                        strong: ({ children }) => (
                          <strong className="font-semibold">{children}</strong>
                        ),
                        pre: ({ children }) => (
                          <pre className="bg-slate-100 rounded p-2 text-xs font-mono mb-2 overflow-x-auto">
                            {children}
                          </pre>
                        ),
                        code: ({ children }) => (
                          <code className="bg-slate-100 rounded px-1 text-xs font-mono">
                            {children}
                          </code>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-2 border-slate-300 pl-3 italic text-slate-500 mb-2">
                            {children}
                          </blockquote>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
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
            onClick={() => handleSend()}
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

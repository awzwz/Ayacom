"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import {
  MessageCircle, X, Send, Loader2, ChevronDown, HelpCircle, Sparkles,
} from "lucide-react";
import type { BusinessCaseResponse } from "@/lib/types";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const FAQ: { q: string }[] = [
  { q: "Откуда берутся цифры экономии?" },
  { q: "Как рассчитывается baseline?" },
  { q: "Какие алгоритмы используются?" },
  { q: "Как считается экономия топлива?" },
  { q: "Что означает годовая экономия?" },
  { q: "Как рассчитывается снижение CO₂?" },
];

export default function AnalyticsChat({ bc }: { bc: BusinessCaseResponse | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const faqRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!faqOpen) return;
    const handler = (e: MouseEvent) => {
      if (faqRef.current && !faqRef.current.contains(e.target as Node)) {
        setFaqOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [faqOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setIsLoading(true);

    try {
      const { reply } = await api.analyticsChat({
        messages: updated.map((m) => ({ role: m.role, content: m.content })),
        context: bc ?? undefined,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Ошибка: ${err.message ?? "не удалось получить ответ"}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* FAB */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
          style={{ background: "#d4a017" }}
        >
          <MessageCircle size={24} style={{ color: "#0d1117" }} />
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div
          className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
          style={{
            width: 400,
            background: "#0d1117",
            borderLeft: "1px solid #21262d",
            boxShadow: "-4px 0 24px rgba(0,0,0,0.4)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 shrink-0"
            style={{ borderBottom: "1px solid #21262d" }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={18} style={{ color: "#d4a017" }} />
              <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>
                AI-ассистент
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "#d4a01722", color: "#d4a017" }}
              >
                GPT-4o
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-[#21262d] transition-colors"
            >
              <X size={18} style={{ color: "#8b949e" }} />
            </button>
          </div>

          {/* FAQ dropdown */}
          <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid #161b22" }}>
            <div className="relative" ref={faqRef}>
              <button
                onClick={() => setFaqOpen((v) => !v)}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-[#161b22]"
                style={{ color: "#8b949e", border: "1px solid #21262d" }}
              >
                <HelpCircle size={14} />
                Частые вопросы
                <ChevronDown
                  size={12}
                  style={{
                    marginLeft: "auto",
                    transform: faqOpen ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s",
                  }}
                />
              </button>
              {faqOpen && (
                <div
                  className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-10"
                  style={{ background: "#161b22", border: "1px solid #30363d" }}
                >
                  {FAQ.map(({ q }) => (
                    <button
                      key={q}
                      onClick={() => {
                        setFaqOpen(false);
                        sendMessage(q);
                      }}
                      className="block w-full text-left px-4 py-2.5 text-xs hover:bg-[#21262d] transition-colors"
                      style={{ color: "#c9d1d9", borderBottom: "1px solid #21262d" }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <Sparkles size={32} style={{ color: "#30363d" }} />
                <p className="text-sm" style={{ color: "#484f58" }}>
                  Задайте вопрос о метриках бизнес-кейса
                </p>
                <p className="text-xs" style={{ color: "#30363d" }}>
                  Или выберите из частых вопросов выше
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="rounded-2xl px-4 py-3 max-w-[85%] text-sm leading-relaxed"
                  style={
                    msg.role === "user"
                      ? { background: "#1f6feb", color: "#fff" }
                      : { background: "#161b22", color: "#c9d1d9", border: "1px solid #21262d" }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl px-4 py-3 flex items-center gap-2 text-sm"
                  style={{ background: "#161b22", color: "#8b949e", border: "1px solid #21262d" }}
                >
                  <Loader2 size={14} className="animate-spin" />
                  Думаю...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div
            className="px-4 py-3 shrink-0"
            style={{ borderTop: "1px solid #21262d" }}
          >
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: "#161b22", border: "1px solid #30363d" }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Спросите о метриках..."
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "#e6edf3" }}
                disabled={isLoading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={isLoading || !input.trim()}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                style={{ color: "#d4a017" }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";
import { Account } from "./Account";
import { Agent } from "./Agent";
import { useAuth } from "./AuthProvider";
import { Chat } from "./Chat";
import { Library } from "./Library";
import { QuizView } from "./QuizView";
import { Talk } from "./Talk";

const TABS = [
  { id: "library", label: "Library" },
  { id: "chat", label: "Ask" },
  { id: "talk", label: "Talk" },
  { id: "quiz", label: "Quiz" },
  { id: "agent", label: "Agent" },
  { id: "account", label: "Account" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function AppShell() {
  const { user, logOut } = useAuth();
  const [tab, setTab] = useState<Tab>("library");
  const [me, setMe] = useState<Me | null>(null);
  const [visits, setVisits] = useState(0); // bumps on every tab switch, so pickers reload new uploads
  // "Ask about this" / "Quiz me" from the Library: remount that screen with the document chosen.
  // Each screen has its own counter, so opening one doesn't reset the other.
  const [focus, setFocus] = useState({ chat: null as string | null, chatN: 0, quiz: null as string | null, quizN: 0 });

  const refreshMe = useCallback(async () => {
    try {
      setMe(await api<Me>("/me"));
    } catch {
      // The header just shows no plan badge; each screen reports its own errors.
    }
  }, []);

  useEffect(() => {
    let live = true; // ignore the answer if the shell unmounted meanwhile (e.g. sign-out)
    api<Me>("/me").then((m) => live && setMe(m)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  function go(next: Tab) {
    setTab(next);
    setVisits((v) => v + 1);
  }

  function openWith(next: "chat" | "quiz", fileId: string) {
    setFocus((f) => (next === "chat" ? { ...f, chat: fileId, chatN: f.chatN + 1 } : { ...f, quiz: fileId, quizN: f.quizN + 1 }));
    go(next);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-10 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-5">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">Recall</span>
          {me && (
            <span className={`pill ${me.plan === "pro" ? "bg-accent text-accent-fg" : "bg-accent-soft text-accent"}`}>
              {me.plan === "pro" ? "Pro" : "Free"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-muted sm:inline">{user?.email}</span>
          <button onClick={() => void logOut()} className="btn">Sign out</button>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-border" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => go(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t.id ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="pt-6">
        {/* Screens stay mounted so a running answer, quiz or agent run isn't lost when switching tabs. */}
        <div hidden={tab !== "library"}><Library onOpen={openWith} /></div>
        <div hidden={tab !== "chat"}>
          <Chat key={`chat-${focus.chatN}`} initialFileId={focus.chat} refreshKey={visits} />
        </div>
        <div hidden={tab !== "quiz"}>
          <QuizView key={`quiz-${focus.quizN}`} initialFileId={focus.quiz} refreshKey={visits} />
        </div>
        <div hidden={tab !== "talk"}><Talk refreshKey={visits} /></div>
        <div hidden={tab !== "agent"}><Agent /></div>
        <div hidden={tab !== "account"}><Account me={me} onPlanChange={refreshMe} /></div>
      </main>
    </div>
  );
}

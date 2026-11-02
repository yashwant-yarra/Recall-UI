"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";
import { Account } from "./Account";
import { Agent } from "./Agent";
import { useAuth } from "./AuthProvider";
import { Chat } from "./Chat";
import { Library } from "./Library";
import { ProLock } from "./ProLock";
import { QuizView } from "./QuizView";
import { Talk } from "./Talk";
import { Tasks } from "./Tasks";

// Ask leads: it's where a study session happens; the rest feed it.
const TABS = [
  { id: "chat", label: "Ask" },
  { id: "library", label: "Library" },
  { id: "talk", label: "Talk" },
  { id: "quiz", label: "Quiz" },
  { id: "agent", label: "Agent" },
  { id: "tasks", label: "Tasks" },
  { id: "account", label: "Account" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function AppShell() {
  const { user, logOut } = useAuth();
  const [tab, setTab] = useState<Tab>("chat");
  const [me, setMe] = useState<Me | null>(null);
  const [visits, setVisits] = useState(0); // bumps on every tab switch, so pickers reload new uploads
  // Remount Ask when opening a document from the Library.
  const [focus, setFocus] = useState({ chat: null as string | null, chatN: 0 });

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
    void refreshMe(); // so a trial that just ended locks Pro screens on the next tab switch
  }

  // Starts the account's one free trial; the error (already used, offline) is shown by whoever asked.
  async function startTrial() {
    await api("/api/v1/billing/trial", { method: "POST", body: {} });
    await refreshMe();
  }

  function openWith(fileId: string) {
    setFocus((f) => ({ chat: fileId, chatN: f.chatN + 1 }));
    go("chat");
  }

  const trialing = me?.plan === "free" && !!me.trial?.active; // Pro access from the free trial
  const plan = me && (
    <span className={`pill border ${me.plan !== "free" || trialing ? "border-fg text-fg" : "border-border text-muted"}`}>
      {me.plan === "pro" ? "Pro" : me.plan === "ultra" ? "Ultra" : trialing ? "Trial" : "Free"}
    </span>
  );
  const current = TABS.find((t) => t.id === tab)!;
  // False while the plan is still loading, so Pro users never see a lock flash. A running trial is Pro access.
  const isFree = me?.plan === "free" && !trialing;
  const onTrial = me?.trial?.available ? startTrial : undefined;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[13rem_1fr]">
      {/* Desktop: the book's index down the left edge. */}
      <aside className="hidden border-r border-border lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:px-5 lg:py-6">
        <div className="flex items-center gap-2">
          <span className="chapter !text-3xl">Recall</span>
          {plan}
        </div>
        <nav className="mt-10 flex flex-col items-start gap-1" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => go(t.id)} aria-current={tab === t.id ? "page" : undefined}
                    className={`py-1 text-[0.95rem] font-semibold transition ${
                      tab === t.id ? "current" : "text-muted hover:text-fg"}`}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-3 text-sm">
          <p className="truncate text-muted" title={user?.email ?? undefined}>{user?.email}</p>
          <button onClick={() => void logOut()} className="btn w-full">Sign out</button>
        </div>
      </aside>

      {/* Phones: a slim header; sections move to the bottom bar. */}
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <span className="chapter !text-2xl">Recall</span>
          {plan}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => go("account")} aria-current={tab === "account" ? "page" : undefined}
                  className={`text-sm font-semibold ${tab === "account" ? "current" : "text-muted"}`}>
            Account
          </button>
          <button onClick={() => void logOut()} className="btn px-2.5 py-1.5">Sign out</button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 sm:px-8 lg:pt-10 lg:pb-12">
        {tab !== "chat" && <h1 className="chapter mb-6 lg:mb-8">{tab === "tasks" ? "My tasks" : current.label}</h1>}
        {/* Screens stay mounted so a running answer or agent run isn't lost when switching tabs. */}
        <div hidden={tab !== "chat"}>
          <Chat key={`chat-${focus.chatN}`} initialFileId={focus.chat} refreshKey={visits} canWeb={!isFree} />
        </div>
        <div hidden={tab !== "library"}><Library onOpen={openWith} free={isFree} /></div>
        <div hidden={tab !== "talk"}>
          {isFree
            ? <ProLock title="Talk it through" text="Speak with a voice tutor that answers from your documents, with captions and sources. Live voice is part of Pro." onUpgrade={() => go("account")} onTrial={onTrial} />
            : <Talk refreshKey={visits} />}
        </div>
        <div hidden={tab !== "quiz"}><QuizView initialFileId={null} refreshKey={visits} /></div>
        <div hidden={tab !== "agent"}>
          {isFree
            ? <ProLock title="Hand it a goal" text="The Agent searches your material, works out the steps and asks before it saves anything for you. It is part of Pro." onUpgrade={() => go("account")} onTrial={onTrial} />
            : <Agent />}
        </div>
        <div hidden={tab !== "tasks"}><Tasks refreshKey={visits} onAgent={() => go("agent")} /></div>
        <div hidden={tab !== "account"}><Account me={me} onPlanChange={refreshMe} onTrial={startTrial} /></div>
      </main>

      <nav aria-label="Sections"
           className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {TABS.filter((t) => t.id !== "account").map((t) => (
          <button key={t.id} onClick={() => go(t.id)} aria-current={tab === t.id ? "page" : undefined}
                  className="flex justify-center py-3">
            <span className={`text-sm font-semibold ${tab === t.id ? "current" : "text-muted"}`}>
              {t.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

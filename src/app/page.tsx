"use client";

import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { Login } from "@/components/Login";
import { LoadingMark } from "@/components/Spinner";

export default function Home() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center" role="status">
        <LoadingMark />
        <div>
          <p className="text-lg font-semibold">Opening Recall</p>
          <p className="mt-1 text-sm text-muted">Getting your workspace ready…</p>
        </div>
      </div>
    );
  return user ? <AppShell /> : <Login />;
}

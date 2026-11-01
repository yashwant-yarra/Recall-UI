"use client";

import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { Login } from "@/components/Login";

export default function Home() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-sm text-muted">Loading…</p>;
  return user ? <AppShell /> : <Login />;
}

"use client";

import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { Login } from "@/components/Login";
import { Loading } from "@/components/Spinner";

export default function Home() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading />
      </div>
    );
  return user ? <AppShell /> : <Login />;
}

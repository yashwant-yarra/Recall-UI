"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { Login } from "./Login";
import { Opening } from "./Spinner";

// /login and /signup: signed-in visitors go straight to the workspace at /.
export function AuthPage({ mode }: { mode: "in" | "up" }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);
  if (loading || user) return <Opening />;
  return <Login initialMode={mode} />;
}

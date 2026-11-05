"use client";

import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { Home as Landing } from "@/components/Home";
import { Opening } from "@/components/Spinner";

// Signed in: the workspace. Signed out: the home page, with sign-in at /login and /signup.
// ponytail: the home page renders after Firebase restores the session, so crawlers see the loading state;
// move the app to its own route if search traffic starts to matter.
export default function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Opening />;
  return user ? <AppShell /> : <Landing />;
}

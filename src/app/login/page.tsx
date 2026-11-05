import type { Metadata } from "next";
import { AuthPage } from "@/components/AuthPage";

export const metadata: Metadata = { title: "Sign in · Recall" };

export default function LoginPage() {
  return <AuthPage mode="in" />;
}

"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithProvider: (provider: "google" | "github" | "microsoft") => Promise<void>;
  logOut: () => Promise<void>;
  sendVerification: () => Promise<void>;
  /** Reload the user and force a fresh token, so email_verified is current on the next API call. */
  refreshVerification: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Firebase keeps the session in the browser and reports the signed-in user (or null) here.
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      }),
    [],
  );

  const value: AuthState = {
    user,
    loading,
    signIn: async (email, password) => void (await signInWithEmailAndPassword(auth, email, password)),
    signUp: async (email, password) => {
      const created = await createUserWithEmailAndPassword(auth, email, password);
      // The free trial needs a verified email, so send the link right away. A failure here must not block sign-up.
      await sendEmailVerification(created.user).catch(() => {});
    },
    signInWithProvider: async (provider) => void (await signInWithPopup(auth,
      provider === "google" ? new GoogleAuthProvider() : provider === "github" ? new GithubAuthProvider() : new OAuthProvider("microsoft.com"))),
    logOut: () => signOut(auth),
    sendVerification: async () => {
      if (auth.currentUser) await sendEmailVerification(auth.currentUser);
    },
    refreshVerification: async () => {
      await auth.currentUser?.reload();
      await auth.currentUser?.getIdToken(true);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

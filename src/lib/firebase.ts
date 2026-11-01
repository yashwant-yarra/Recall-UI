import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Public web config: it identifies the Firebase project, it doesn't grant access.
// The API verifies every ID token itself.
const app =
  getApps()[0] ??
  initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });

export const auth = getAuth(app);

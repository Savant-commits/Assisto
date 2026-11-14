"use client";

import { useAuthGate } from "@/components/auth/auth-sheet";
import { signOutUser } from "@/components/session-menu";

export function SettingsSignInButton() {
  const { requireAuth } = useAuthGate();

  return (
    <button
      type="button"
      onClick={() => requireAuth(() => {}, "to view your account settings")}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      Sign in
    </button>
  );
}

export function SettingsLogOutButton() {
  return (
    <button
      type="button"
      onClick={() => void signOutUser()}
      className="inline-flex min-h-11 items-center justify-center rounded-full border border-destructive/40 px-5 text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
    Sign out
    </button>
  );
}

"use client";

import ThemeToggle from "@/components/theme-toggle";
import { signOutUser } from "@/components/session-menu";

export default function ProfileSettingsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Settings</h1>

      <section aria-labelledby="appearance-heading" className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <h2 id="appearance-heading" className="mb-2 text-lg font-semibold">Appearance</h2>
        <p className="mb-5 text-sm text-muted-foreground">Choose a light or dark theme, or follow your device setting.</p>
        <ThemeToggle />
      </section>

      <section aria-label="Account actions" className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <button
          type="button"
          onClick={() => void signOutUser()}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-destructive/40 px-4 text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Log out
        </button>
      </section>
    </main>
  );
}
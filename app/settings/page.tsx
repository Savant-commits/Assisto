import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/avatar";
import ThemeToggle from "@/components/theme-toggle";
import { SettingsLogOutButton, SettingsSignInButton } from "@/components/settings-account-actions";
import { createClient } from "@/lib/supabase/server";

type SettingsAccount = {
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
};

async function getSettingsAccount(): Promise<SettingsAccount | null> {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return null;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, email, avatar_url")
      .eq("id", userData.user.id)
      .single();
    if (profileError || !profile) return null;

    return {
      fullName: profile.full_name,
      email: profile.email ?? "",
      avatarUrl: profile.avatar_url,
    };
  } catch {
    return null;
  }
}

export default async function SettingsPage() {
  const account = await getSettingsAccount();
  const displayName = account?.fullName?.trim() || account?.email || "Your account";

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/"
        className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back
      </Link>

      <h1 className="mb-6 text-3xl font-semibold tracking-tight text-foreground">Settings</h1>

      <section aria-labelledby="appearance-heading" className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <h2 id="appearance-heading" className="mb-2 text-lg font-semibold text-foreground">Appearance</h2>
        <p className="mb-5 text-sm text-muted-foreground">Choose a light or dark theme, or follow your device setting.</p>
        <ThemeToggle />
      </section>

      <section aria-labelledby="account-heading" className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <h2 id="account-heading" className="mb-4 text-lg font-semibold text-foreground">Account</h2>
        {account ? (
          <>
            <div className="mb-5 flex min-w-0 items-center gap-4 rounded-xl border border-border bg-background p-4">
              <Avatar
                src={account.avatarUrl}
                name={displayName}
                size={56}
                className="size-14 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{displayName}</p>
                <p className="truncate text-sm text-muted-foreground">{account.email || "Email unavailable"}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/profile"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Go to profile
              </Link>
              <SettingsLogOutButton />
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">You&apos;re browsing as a guest</p>
            <div className="flex flex-wrap items-center gap-3">
              <SettingsSignInButton />
              <Link
                href="/signup?redirect=/settings"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Create account
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import { safeRedirectPath } from "@/lib/safe-redirect";
import LoginForm from "@/components/auth/login-form";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectPath(searchParams.get("redirect"));

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-1 text-2xl font-semibold">Log in</h1>
      <p className="mb-6 text-muted-foreground">Welcome back to Assisto.</p>
      {searchParams.get("error") === "link_expired" && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          This confirmation link is invalid or has expired. Enter your email below and sign in to request another link.
        </p>
      )}
      {searchParams.get("error") === "profile_setup" && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          Your email was confirmed, but we couldn’t finish setting up your profile. Please contact support.
        </p>
      )}

      <LoginForm
        redirectTo={redirectTo}
        onSuccess={() => window.location.assign(redirectTo)}
        showCreateAccount
      />
    </div>
  );
}

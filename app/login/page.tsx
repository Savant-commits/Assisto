"use client";

import { useSearchParams } from "next/navigation";
import { safeRedirectPath } from "@/lib/safe-redirect";
import LoginForm from "@/components/auth/login-form";
import { PageHeading } from "@/components/page-heading";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectPath(searchParams.get("redirect"));

  return (
    <div className="mx-auto max-w-sm px-4 pt-0 pb-16">
      <PageHeading title="Log in" description="Welcome back to Assisto." />
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

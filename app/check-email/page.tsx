"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ResendConfirmation from "@/components/resend-confirmation";

export default function CheckEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  return (
    <div className="mx-auto max-w-sm px-4 py-20 text-center">
      <h1 className="mb-2 text-2xl font-semibold">Check your email</h1>
      <p className="text-muted-foreground">
        We sent a link to <span className="font-medium text-foreground">{email || "your email address"}</span>. Open it to confirm your email and finish creating your account.
      </p>
      {email && <ResendConfirmation email={email} />}
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/signup" className="underline">Use a different email</Link>
      </p>
    </div>
  );
}

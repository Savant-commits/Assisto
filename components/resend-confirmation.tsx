"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type Props = { email: string };

export default function ResendConfirmation({ email }: Props) {
  const [cooldown, setCooldown] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((remaining) => Math.max(remaining - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function resend() {
    setMessage(null);
    setIsSending(true);
    try {
      const { error } = await createClient().auth.resend({ type: "signup", email });
      if (error) {
        const detail = error.message.toLowerCase();
        if (error.status === 429 || detail.includes("rate limit") || detail.includes("too many")) {
          setMessage("Please wait before requesting another confirmation email.");
          setCooldown(60);
        } else {
          setMessage("We couldn’t send the email. Please try again shortly.");
        }
        return;
      }
      setMessage("Confirmation email sent. Check your inbox and spam folder.");
      setCooldown(60);
    } catch {
      setMessage("We couldn’t send the email. Please try again shortly.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <Button type="button" variant="outline" onClick={resend} disabled={isSending || cooldown > 0}>
        {isSending ? "Sending…" : cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend email"}
      </Button>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

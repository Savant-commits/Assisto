"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function CompletionActions({
  enquiryId,
  role,
  customerCompletedAt,
  providerCompletedAt,
  onUpdated,
  onReviewNeeded,
}: {
  enquiryId: number;
  role: "customer" | "provider";
  customerCompletedAt: string | null;
  providerCompletedAt: string | null;
  onUpdated: (patch: { status?: string; customer_completed_at?: string | null; provider_completed_at?: string | null }) => void;
  onReviewNeeded?: (enquiryId: number) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myCompletedAt = role === "customer" ? customerCompletedAt : providerCompletedAt;
  const theirCompletedAt = role === "customer" ? providerCompletedAt : customerCompletedAt;

  async function markComplete() {
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const column = role === "customer" ? "customer_completed_at" : "provider_completed_at";

      const { data: updateData, error: updateError } = await supabase
        .from("enquiries")
        .update({ [column]: new Date().toISOString() })
        .eq("id", enquiryId)
        .select("status, customer_completed_at, provider_completed_at")
        .single();

      if (updateError) throw updateError;
      onUpdated(updateData);

      const { data: refreshed, error: refreshError } = await supabase
        .from("enquiries")
        .select("status, customer_completed_at, provider_completed_at")
        .eq("id", enquiryId)
        .single();

      if (refreshError) throw refreshError;
      onUpdated(refreshed);

      if (refreshed.status === "completed" && role === "customer" && onReviewNeeded) {
        onReviewNeeded(enquiryId);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to mark complete";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  if (myCompletedAt) {
    return <p className="mt-2 text-sm text-muted-foreground">Waiting for the other party to confirm completion…</p>;
  }

  return (
    <div className="mt-2">
      <button
        onClick={markComplete}
        disabled={pending}
        className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-60"
      >
        {pending ? "Marking…" : "Mark work complete"}
      </button>
      {theirCompletedAt && <p className="mt-1 text-xs text-muted-foreground">The other party has already marked this complete.</p>}
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}

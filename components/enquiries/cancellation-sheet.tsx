"use client";

import { useState } from "react";
import { X } from "lucide-react";

export type CancellationReasonCode =
  | "sent_by_mistake"
  | "work_arranged"
  | "timing_not_suitable"
  | "unable_to_take_work"
  | "scheduling_conflict"
  | "scope_not_suitable"
  | "other";

type Props = {
  open: boolean;
  role: "customer" | "provider";
  isWithdraw: boolean;
  isConfirmed: boolean;
  saving: boolean;
  onClose: () => void;
  onConfirm: (reasonCode: CancellationReasonCode, reasonNote: string | null) => Promise<string | null>;
};

const OPTIONS: Record<"customer" | "provider", Array<{ code: CancellationReasonCode; label: string }>> = {
  customer: [
    { code: "sent_by_mistake", label: "The enquiry was sent by mistake" },
    { code: "work_arranged", label: "The work has already been arranged" },
    { code: "timing_not_suitable", label: "The timing is no longer suitable" },
    { code: "other", label: "Other" },
  ],
  provider: [
    { code: "unable_to_take_work", label: "I am unable to take on this work at this time" },
    { code: "scheduling_conflict", label: "I have a scheduling conflict" },
    { code: "scope_not_suitable", label: "The scope of work is not suitable for me" },
    { code: "other", label: "Other" },
  ],
};

export function CancellationSheet({ open, role, isWithdraw, isConfirmed, saving, onClose, onConfirm }: Props) {
  const [reasonCode, setReasonCode] = useState<CancellationReasonCode | null>(null);
  const [reasonNote, setReasonNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;
  const isValid = reasonCode !== null && (reasonCode !== "other" || reasonNote.trim().length > 0);

  async function submit() {
    if (!reasonCode || !isValid || saving) return;
    setError(null);
    const saveError = await onConfirm(reasonCode, reasonCode === "other" ? reasonNote.trim() : null);
    if (saveError) setError(saveError);
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-foreground/40 sm:items-center sm:justify-center sm:p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="cancel-enquiry-title" className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-card-foreground shadow-lifted sm:max-w-lg sm:rounded-2xl sm:p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="cancel-enquiry-title" className="font-display text-xl">{isWithdraw ? "Withdraw this enquiry" : "Cancel this enquiry"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Please tell us why. This will be shared with the other party.</p>
          </div>
          <button type="button" aria-label="Close cancellation sheet" disabled={saving} onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        {isConfirmed && <p className="mb-3 rounded-xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground">Contact details and the job location will no longer be shared.</p>}
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-foreground">Choose a reason</legend>
          {OPTIONS[role].map((option) => (
            <label key={option.code} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted/50">
              <input type="radio" name="enquiry-cancel-reason" value={option.code} checked={reasonCode === option.code} disabled={saving} onChange={() => { setReasonCode(option.code); setError(null); }} className="size-4 accent-primary" />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
        {reasonCode === "other" && (
          <div className="mt-3">
            <label htmlFor="enquiry-cancel-note" className="mb-1 block text-sm font-medium text-foreground">Tell us more</label>
            <textarea id="enquiry-cancel-note" value={reasonNote} onChange={(event) => setReasonNote(event.target.value.slice(0, 500))} maxLength={500} required rows={4} disabled={saving} className="min-h-24 w-full rounded-xl border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <p className="mt-1 text-right text-xs text-muted-foreground">{reasonNote.length}/500</p>
          </div>
        )}
        {error && <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">Keep enquiry</button>
          <button type="button" onClick={() => void submit()} disabled={!isValid || saving} className="inline-flex min-h-11 items-center justify-center rounded-full bg-destructive px-5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Cancelling…" : "Confirm cancellation"}</button>
        </div>
      </section>
    </div>
  );
}

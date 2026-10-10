"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/confirm-dialog";
import { createClient } from "@/lib/supabase/client";

type CallOutcome = "verified" | "not_verified" | "unreachable";

type Props = {
  applicationId: string;
  applicantName: string;
  professionalType: string;
  city: string;
};

const outcomeOptions: { value: CallOutcome; label: string }[] = [
  { value: "verified", label: "Confirmed" },
  { value: "not_verified", label: "Could not confirm (details don't match or something is wrong)" },
  { value: "unreachable", label: "Could not reach" },
];

export function ApplicationCallDialog({ applicationId, applicantName, professionalType, city }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome>("verified");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openDialog() {
    setOutcome("verified");
    setNotes("");
    setError(null);
    setIsOpen(true);
  }

  async function recordCall() {
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("admin_record_application_call", {
        p_application_id: applicationId,
        p_outcome: outcome,
        p_notes: notes.trim(),
      });

      if (rpcError) {
        console.error("admin_record_application_call failed", {
          message: rpcError.message,
          details: rpcError.details,
          hint: rpcError.hint,
          code: rpcError.code,
        });
        const knownErrors: Record<string, string> = {
          NOTES_REQUIRED: "Please write what went wrong.",
          APPLICATION_NOT_PENDING: "This application has already been decided.",
          PHONE_NOT_VERIFIED: "This applicant never verified their number. Ask them to verify it first.",
        };
        setError(knownErrors[rpcError.message] || "Something went wrong. Please try again.");
        return;
      }

      setIsOpen(false);
      router.refresh();
    } catch (caughtError) {
      const err = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
      console.error("admin_record_application_call failed", {
        message: err.message,
        details: "details" in err ? err.details : undefined,
        hint: "hint" in err ? err.hint : undefined,
        code: "code" in err ? err.code : undefined,
      });
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="mt-3 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
      >
        Record call
      </button>
      <ConfirmDialog
        isOpen={isOpen}
        title="Record phone call"
        message="Record the result of your verification call with this applicant."
        confirmLabel="Save call result"
        busy={busy}
        confirmDisabled={outcome === "not_verified" && !notes.trim()}
        onConfirm={recordCall}
        onCancel={() => setIsOpen(false)}
      >
        <div className="mb-5 max-h-40 overflow-y-auto rounded-md bg-muted/50 p-3 text-sm">
          <p className="mb-1 font-medium">Ask:</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Are you {applicantName}?</li>
            <li>Did you apply to join Assisto as {professionalType} in {city}?</li>
            <li>Do the details in the application (business name, years of experience, services) match what you tell me?</li>
            <li>Do you understand that Assisto lists you but does not guarantee your work?</li>
          </ul>
        </div>
        <fieldset className="mb-4 space-y-2">
          <legend className="mb-2 text-sm font-medium">Call result</legend>
          {outcomeOptions.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name={`call-outcome-${applicationId}`}
                value={option.value}
                checked={outcome === option.value}
                onChange={() => setOutcome(option.value)}
                className="mt-0.5"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
        <label className="mb-1 block text-sm font-medium" htmlFor={`call-notes-${applicationId}`}>
          Notes{outcome === "not_verified" ? " (required)" : " (optional)"}
        </label>
        <textarea
          id={`call-notes-${applicationId}`}
          value={notes}
          onChange={(event) => setNotes(event.target.value.slice(0, 500))}
          maxLength={500}
          rows={3}
          placeholder="Add a note about the call"
          className="mb-1 w-full rounded border p-2 text-sm"
        />
        <p className="mb-4 text-right text-xs text-muted-foreground">{notes.length}/500</p>
        {error && <p className="-mt-2 mb-4 text-sm text-destructive" role="alert">{error}</p>}
      </ConfirmDialog>
    </>
  );
}

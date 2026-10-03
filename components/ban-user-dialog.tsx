"use client";

import { useState } from "react";
import { banUser } from "@/app/actions/bans";
import { useEscapeKey } from "@/lib/use-escape-key";

export type BanDuration = "1_week" | "1_year" | "permanent";

interface BanUserDialogProps {
  isOpen: boolean;
  userId: string | null | undefined;
  userLabel: string;
  reportId?: string;
  defaultReason?: string;
  defaultDuration?: BanDuration;
  onClose: () => void;
  onSuccess: (emailSent: boolean, bannedUntil?: string | null) => void;
}

const LABELS: Record<BanDuration, string> = {
  "1_week": "1 week",
  "1_year": "1 year",
  permanent: "Permanent",
};

export default function BanUserDialog({
  isOpen,
  userId,
  userLabel,
  reportId,
  defaultReason,
  defaultDuration = "1_week",
  onClose,
  onSuccess,
}: BanUserDialogProps) {
  const [duration, setDuration] = useState<BanDuration>(defaultDuration);
  const [reason, setReason] = useState(defaultReason ?? "");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(isOpen, onClose);

  async function handleBan() {
    if (!userId) {
      setError("No user selected for a ban.");
      return;
    }

    if (reason.trim().length < 3) {
      setError("Please enter a reason with at least 3 characters.");
      return;
    }

    if (duration === "permanent" && confirmation.trim() !== "BAN") {
      setError("Type BAN to confirm a permanent ban.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await banUser({
        userId,
        reportId,
        duration,
        reason: reason.trim(),
      });
      onSuccess(result.emailSent, result.bannedUntil ?? null);
      setReason(defaultReason ?? "");
      setConfirmation("");
      setDuration(defaultDuration);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ban this user.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-2 text-lg font-semibold">Ban user</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {userLabel}
        </p>

        <div className="mb-4 space-y-3">
          <label className="block text-sm font-medium">Duration</label>
          <div className="flex flex-wrap gap-2">
            {(["1_week", "1_year", "permanent"] as BanDuration[]).map((value) => (
              <button
                key={value}
                type="button"
                className={`rounded border px-3 py-2 text-sm ${duration === value ? "border-red-600 bg-red-50 text-red-700" : "bg-white text-gray-700"}`}
                onClick={() => setDuration(value)}
              >
                {LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="w-full rounded border bg-background p-2 text-sm"
            placeholder="Explain the violation or policy issue"
            disabled={submitting}
          />
        </div>

        {duration === "permanent" && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Confirmation</label>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="w-full rounded border bg-background px-3 py-2 text-sm"
              placeholder="Type BAN"
              disabled={submitting}
            />
          </div>
        )}

        <p className="mb-4 text-sm text-muted-foreground">
          This user will be signed out and unable to log in until the ban ends. A provider&apos;s public listing is hidden while banned.
        </p>

        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void handleBan()}
            disabled={submitting || !userId}
          >
            {submitting ? "Banning..." : "Ban user"}
          </button>
          <button type="button" className="rounded border px-4 py-2 text-sm" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/confirm-dialog";

type Props = { applicationId: string };

export function ApplicationActions({ applicationId }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function approve() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/approve`, { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "approve failed");
      // refresh the page to reflect changes; server action revalidates paths too
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/reject`, { method: "POST", body: JSON.stringify({ reason }), headers: { "Content-Type": "application/json" } });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "reject failed");
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={approve} disabled={busy} className="rounded-md bg-green-600 px-3 py-1 text-sm text-white">
        {busy ? "Working…" : "Approve"}
      </button>
      <button onClick={() => { setError(null); setReason(""); setRejectDialogOpen(true); }} disabled={busy} className="rounded-md bg-red-600 px-3 py-1 text-sm text-white">
        Reject
      </button>
      {error && !rejectDialogOpen && <div className="text-sm text-destructive">{error}</div>}
      <ConfirmDialog
        isOpen={rejectDialogOpen}
        title="Reject this application?"
        message="Optionally provide a reason for rejecting this application."
        confirmLabel="Reject"
        destructive
        busy={busy}
        onConfirm={reject}
        onCancel={() => setRejectDialogOpen(false)}
      >
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason (optional)"
          className="mb-5 w-full rounded border p-2 text-sm"
          rows={3}
        />
        {error && <p className="-mt-3 mb-4 text-sm text-destructive">{error}</p>}
      </ConfirmDialog>
    </div>
  );
}

export default ApplicationActions;

"use client";

import { useState } from "react";

type Props = { applicationId: string };

export function ApplicationActions({ applicationId }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const reason = prompt("Reason for rejection (optional)");
    if (reason === null) return; // cancelled
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
      <button onClick={reject} disabled={busy} className="rounded-md bg-red-600 px-3 py-1 text-sm text-white">
        Reject
      </button>
      {error && <div className="text-sm text-destructive">{error}</div>}
    </div>
  );
}

export default ApplicationActions;

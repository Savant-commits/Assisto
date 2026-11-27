"use client";

import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/confirm-dialog";
import { AppToast } from "@/components/app-toast";

type Props = { applicationId: string; callVerified: boolean };
type ApprovalNotice = {
  servicesLinked: number;
  categoriesLinked: number;
  unmatchedLabels: string[];
  failedWrites: number;
};

const approvalNoticeStorageKey = "admin-application-approval-notice";

export function ApplicationApprovalToast() {
  const [notice, setNotice] = useState<ApprovalNotice | null>(null);

  useEffect(() => {
    let cancelled = false;
    const storedNotice = sessionStorage.getItem(approvalNoticeStorageKey);
    if (!storedNotice) return;
    sessionStorage.removeItem(approvalNoticeStorageKey);

    try {
      const parsed = JSON.parse(storedNotice) as ApprovalNotice;
      if (
        typeof parsed.servicesLinked === "number" &&
        typeof parsed.categoriesLinked === "number" &&
        Array.isArray(parsed.unmatchedLabels) &&
        typeof parsed.failedWrites === "number"
      ) {
        queueMicrotask(() => {
          if (!cancelled) setNotice(parsed);
        });
      }
    } catch {
      // Ignore malformed, stale session storage values.
    }
    return () => {
      cancelled = true;
    };
  }, []);

  if (!notice) return null;
  const hasWarnings = notice.unmatchedLabels.length > 0 || notice.failedWrites > 0;

  return (
    <AppToast
      role={hasWarnings ? "alert" : "status"}
      duration={8000}
      position="bottom"
      className={`max-w-[min(90vw,36rem)] rounded-md text-sm shadow-lg ${hasWarnings ? "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100" : "border-transparent bg-green-600 text-white"}`}
      onDismiss={() => setNotice(null)}
    >
      <p className="font-medium">Application approved. Linked {notice.servicesLinked} services and {notice.categoriesLinked} categories.</p>
      {hasWarnings && (
        <div className="mt-1">
          <p className="font-medium">Some service mappings need attention; approval was not blocked.</p>
          {notice.unmatchedLabels.length > 0 && <p className="mt-1 break-words [overflow-wrap:anywhere]">Could not map: {notice.unmatchedLabels.join(", ")}.</p>}
          {notice.failedWrites > 0 && <p>{notice.failedWrites} service or category write{notice.failedWrites === 1 ? "" : "s"} failed.</p>}
        </div>
      )}
    </AppToast>
  );
}

export function ApplicationActions({ applicationId, callVerified }: Props) {
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
      try {
        sessionStorage.setItem(approvalNoticeStorageKey, JSON.stringify({
          servicesLinked: json.servicesLinked,
          categoriesLinked: json.categoriesLinked,
          unmatchedLabels: json.unmatchedLabels,
          failedWrites: json.failedWrites,
        } satisfies ApprovalNotice));
      } catch (storageError) {
        console.warn("Could not preserve approval summary for the page refresh", storageError);
      }
      // refresh the page to reflect changes; server action revalidates paths too
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button onClick={approve} disabled={busy || !callVerified} className="rounded-md bg-green-600 px-3 py-1 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? "Working…" : "Approve"}
        </button>
        <button onClick={() => { setError(null); setReason(""); setRejectDialogOpen(true); }} disabled={busy} className="rounded-md bg-red-600 px-3 py-1 text-sm text-white">
          Reject
        </button>
      </div>
      {!callVerified && <p className="max-w-56 text-right text-xs text-muted-foreground">Call the applicant and record the result before approving.</p>}
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

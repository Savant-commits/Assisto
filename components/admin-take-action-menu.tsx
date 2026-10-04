"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ReportStatus } from "@/lib/types";
import { useEscapeKey } from "@/lib/use-escape-key";
import BanUserDialog, { type BanDuration } from "@/components/ban-user-dialog";
import SendWarningDialog from "@/components/send-warning-dialog";

type ReportRow = {
  id: string;
  status: ReportStatus | string;
  reason?: string | null;
  admin_notes?: string | null;
  reporter_name?: string | null;
  updated_at?: string | null;
  target?: { sender_id?: string | null; full_name?: string | null; user_code?: string | null; role?: string | null } | null;
};

type MessageLike = {
  id: string;
  sender_id: string;
  deleted_at?: string | null;
  admin_removed_at?: string | null;
  reports?: ReportRow[];
};

function appendNote(current: string | null | undefined, addition: string) {
  const trimmed = (current ?? "").trim();
  const note = addition.trim();
  if (!note) return trimmed || null;
  if (!trimmed) return note;
  return trimmed.includes(note) ? trimmed : `${trimmed}\n${note}`;
}

function getStatusLabel(status: string) {
  if (status === "open") return "Open";
  if (status === "reviewed") return "Reviewed";
  if (status === "actioned") return "Actioned";
  if (status === "dismissed") return "Dismissed";
  return status;
}

function getStatusClasses(status: string) {
  if (status === "open") return "bg-red-100 text-red-700";
  if (status === "reviewed") return "bg-amber-100 text-amber-800";
  if (status === "actioned") return "bg-green-100 text-green-700";
  if (status === "dismissed") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function getReportBadgeClasses(status: string) {
  if (status === "actioned") return "bg-green-100 text-green-700";
  if (status === "dismissed") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "Unknown";
  return new Date(dateStr).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function getUnresolvedReports(reports: ReportRow[]) {
  return reports.filter((report) => report.status === "open" || report.status === "reviewed");
}

function isFullyResolved(reports: ReportRow[]) {
  return reports.length > 0 && reports.every((report) => report.status === "actioned" || report.status === "dismissed");
}

export default function AdminTakeActionMenu({
  message,
  authorName,
  authorUserCode,
  isAuthorAdmin,
  onRemoveToggle,
  onToast,
}: {
  message: MessageLike;
  authorName: string;
  authorUserCode?: string | null;
  isAuthorAdmin?: boolean;
  onRemoveToggle: (messageId: string) => void;
  onToast: (message: string) => void;
}) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeResolvedButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resolvedPopupOpen, setResolvedPopupOpen] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [banState, setBanState] = useState<{ isOpen: boolean; duration: BanDuration; userId: string | null; userLabel: string }>({
    isOpen: false,
    duration: "1_week",
    userId: message.sender_id,
    userLabel: `${authorName}${authorUserCode ? ` (#${authorUserCode})` : ""}`,
  });
  const [resolveDialog, setResolveDialog] = useState<{ open: boolean; type: "reviewed" | "dismissed"; notes: string; error: string | null; busy: boolean }>({
    open: false,
    type: "reviewed",
    notes: "",
    error: null,
    busy: false,
  });

  useEscapeKey(menuOpen, () => setMenuOpen(false));
  useEscapeKey(resolvedPopupOpen, () => setResolvedPopupOpen(false));
  useEscapeKey(resolveDialog.open, () => setResolveDialog((current) => ({ ...current, open: false, error: null })));

  useEffect(() => {
    if (resolvedPopupOpen) {
      closeResolvedButtonRef.current?.focus();
    }
  }, [resolvedPopupOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  const reports = useMemo(() => message.reports ?? [], [message.reports]);
  const unresolvedReports = useMemo(() => getUnresolvedReports(reports), [reports]);
  const fullyResolved = useMemo(() => isFullyResolved(reports), [reports]);
  const oldestUnresolved = unresolvedReports[0] ?? null;

  const statusSummary = useMemo(() => {
    if (!reports.length) return null;

    const unresolved = getUnresolvedReports(reports);
    const nextStatus = unresolved.some((report) => report.status === "open")
      ? "open"
      : unresolved.some((report) => report.status === "reviewed")
        ? "reviewed"
        : reports.some((report) => report.status === "actioned")
          ? "actioned"
          : "dismissed";

    const countText = reports.length > 1 ? `${reports.length} reports` : "1 report";
    return {
      status: nextStatus,
      label: reports.length > 1 ? `${getStatusLabel(nextStatus)} · ${countText}` : getStatusLabel(nextStatus),
    };
  }, [reports]);

  async function markActionedForRemaining(text: string) {
    if (!unresolvedReports.length) return;

    const supabase = createClient();
    await Promise.all(
      unresolvedReports.map((report) =>
        supabase.rpc("admin_update_report", {
          p_report_id: report.id,
          p_status: "actioned",
          p_admin_notes: appendNote(report.admin_notes, text) ?? null,
        })
      )
    );
    router.refresh();
  }

  async function handleWarningSuccess() {
    if (!oldestUnresolved) return;

    try {
      await markActionedForRemaining("Warning sent.");
      onToast("Warning sent.");
      setWarningOpen(false);
      setMenuOpen(false);
    } catch (error) {
      console.error("Failed to mark message reports actioned after warning:", error);
      setWarningOpen(true);
    }
  }

  async function handleBanSuccess(duration: BanDuration) {
    if (!unresolvedReports.length) return;

    try {
      await markActionedForRemaining(`User banned (${duration === "1_week" ? "1 week" : duration === "1_year" ? "1 year" : "permanent"}).`);
      onToast(`User banned (${duration === "1_week" ? "1 week" : duration === "1_year" ? "1 year" : "permanent"}).`);
      setBanState((prev) => ({ ...prev, isOpen: false }));
      setMenuOpen(false);
    } catch (error) {
      console.error("Failed to mark message reports actioned after ban:", error);
      setBanState((prev) => ({ ...prev, isOpen: true }));
    }
  }

  async function handleStatusSave() {
    if (!unresolvedReports.length) return;

    const notes = resolveDialog.notes.trim();
    setResolveDialog((current) => ({ ...current, busy: true, error: null }));

    try {
      const supabase = createClient();
      await Promise.all(
        unresolvedReports.map((report) => {
          const mergedNotes = notes ? appendNote(report.admin_notes, notes) : report.admin_notes ?? null;
          return supabase.rpc("admin_update_report", {
            p_report_id: report.id,
            p_status: resolveDialog.type,
            p_admin_notes: mergedNotes,
          });
        })
      );
      setResolveDialog({ open: false, type: "reviewed", notes: "", error: null, busy: false });
      setMenuOpen(false);
      router.refresh();
    } catch (error) {
      setResolveDialog((current) => ({
        ...current,
        busy: false,
        error: error instanceof Error ? error.message : "Failed to update report status.",
      }));
    }
  }

  const authorGroupLabel = `Author: ${authorName}${authorUserCode ? ` (#${authorUserCode})` : ""}`;
  const canManageMessage = !(message.deleted_at && !message.admin_removed_at);

  return (
    <div className="relative" ref={menuRef}>
      <div className="flex items-center gap-2">
        {statusSummary && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getStatusClasses(statusSummary.status)}`}>
            {statusSummary.label}
          </span>
        )}

        <button
          type="button"
          className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
          onClick={() => {
            if (fullyResolved) {
              setResolvedPopupOpen(true);
              setMenuOpen(false);
              return;
            }
            setMenuOpen((current) => !current);
          }}
        >
          Take action ▾
        </button>
      </div>

      {resolvedPopupOpen && fullyResolved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setResolvedPopupOpen(false)}>
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {reports.length > 1 ? "These reports have already been handled" : "This report has already been handled"}
            </h3>

            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${getReportBadgeClasses(report.status)}`}>
                      {report.status === "actioned" ? "Actioned" : "Dismissed"}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex gap-2"><span className="font-semibold text-slate-800">Reason:</span><span>{report.reason || "Not provided"}</span></div>
                    <div className="flex gap-2"><span className="font-semibold text-slate-800">Reporter:</span><span>{report.reporter_name || "Unknown"}</span></div>
                    <div className="flex gap-2"><span className="font-semibold text-slate-800">Updated:</span><span>{formatDateTime(report.updated_at)}</span></div>
                    <div className="flex gap-2"><span className="font-semibold text-slate-800">Notes:</span><span>{report.admin_notes?.trim() ? report.admin_notes.trim() : "No notes"}</span></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                ref={closeResolvedButtonRef}
                type="button"
                className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white"
                onClick={() => setResolvedPopupOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                onClick={() => {
                  setResolvedPopupOpen(false);
                  setMenuOpen(true);
                }}
              >
                Take further action
              </button>
            </div>
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded border bg-white shadow-xl">
          <div className="max-h-[min(75vh,28rem)] overflow-y-auto p-2">
            {!isAuthorAdmin && (
              <div className="mb-2">
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{authorGroupLabel}</div>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setWarningOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  Send warning
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setBanState({
                      isOpen: true,
                      duration: "1_week",
                      userId: message.sender_id,
                      userLabel: `${authorName}${authorUserCode ? ` (#${authorUserCode})` : ""}`,
                    });
                    setMenuOpen(false);
                  }}
                >
                  Ban for 1 week
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setBanState({
                      isOpen: true,
                      duration: "1_year",
                      userId: message.sender_id,
                      userLabel: `${authorName}${authorUserCode ? ` (#${authorUserCode})` : ""}`,
                    });
                    setMenuOpen(false);
                  }}
                >
                  Ban for 1 year
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setBanState({
                      isOpen: true,
                      duration: "permanent",
                      userId: message.sender_id,
                      userLabel: `${authorName}${authorUserCode ? ` (#${authorUserCode})` : ""}`,
                    });
                    setMenuOpen(false);
                  }}
                >
                  Ban forever
                </button>
              </div>
            )}

            {canManageMessage && (
              <div className="mb-2 border-t pt-2">
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Message</div>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setMenuOpen(false);
                    onRemoveToggle(message.id);
                  }}
                >
                  {message.admin_removed_at ? "Restore message" : "Remove message"}
                </button>
              </div>
            )}

            {unresolvedReports.length > 0 && (
              <div className="border-t pt-2">
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Report</div>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setResolveDialog({ open: true, type: "reviewed", notes: "", error: null, busy: false });
                    setMenuOpen(false);
                  }}
                >
                  Mark as reviewed
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setResolveDialog({ open: true, type: "dismissed", notes: "", error: null, busy: false });
                    setMenuOpen(false);
                  }}
                >
                  Dismiss (no violation)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {warningOpen && oldestUnresolved && (
        <SendWarningDialog
          isOpen={warningOpen}
          recipientId={message.sender_id}
          reportId={oldestUnresolved.id}
          onClose={() => setWarningOpen(false)}
          recipientName={authorName}
          recipientUserCode={authorUserCode ?? undefined}
          onSuccess={() => {
            void handleWarningSuccess();
          }}
        />
      )}

      {banState.isOpen && (
        <BanUserDialog
          isOpen={banState.isOpen}
          userId={banState.userId}
          userLabel={banState.userLabel}
          reportId={oldestUnresolved?.id}
          defaultReason={oldestUnresolved?.admin_notes || "The account was suspended for violating platform rules."}
          defaultDuration={banState.duration}
          onClose={() => setBanState((current) => ({ ...current, isOpen: false }))}
          onSuccess={() => {
            void handleBanSuccess(banState.duration);
          }}
        />
      )}

      {resolveDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setResolveDialog((current) => ({ ...current, open: false }))}>
          <div
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              {resolveDialog.type === "reviewed" ? "Mark as reviewed?" : "Dismiss this report?"}
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              {resolveDialog.type === "reviewed"
                ? "This will update every unresolved report for this message."
                : "This will dismiss every unresolved report for this message."}
            </p>

            <label className="mb-2 block text-sm font-medium">Notes (optional)</label>
            <textarea
              value={resolveDialog.notes}
              onChange={(event) => setResolveDialog((current) => ({ ...current, notes: event.target.value }))}
              rows={4}
              className="mb-3 w-full rounded border bg-background p-2 text-sm"
              placeholder="Optional admin notes..."
              disabled={resolveDialog.busy}
            />

            {resolveDialog.error && <p className="mb-3 text-sm text-red-600">{resolveDialog.error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm"
                onClick={() => setResolveDialog((current) => ({ ...current, open: false, error: null }))}
                disabled={resolveDialog.busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                onClick={() => void handleStatusSave()}
                disabled={resolveDialog.busy}
              >
                {resolveDialog.busy ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

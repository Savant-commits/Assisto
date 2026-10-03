"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BanUserDialog, { type BanDuration } from "./ban-user-dialog";
import SendWarningDialog from "./send-warning-dialog";

type ReportTarget = {
  customer_id?: string | null;
  sender_id?: string | null;
  admin_removed_at?: string | null;
  full_name?: string | null;
  user_code?: string | null;
  role?: string | null;
};

type ReportLike = {
  id: string;
  reportable_type?: string | null;
  reportable_id?: string | null;
  status?: string | null;
  admin_notes?: string | null;
  target?: ReportTarget | null;
};

const statusClasses: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  reviewed: "bg-amber-100 text-amber-800",
  actioned: "bg-green-100 text-green-700",
  dismissed: "bg-gray-200 text-gray-700",
};

export default function AdminReportDetail({ report }: { report: ReportLike }) {
  const router = useRouter();
  const [status, setStatus] = useState(report?.status ?? "open");
  const [notes, setNotes] = useState(report?.admin_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [banDuration, setBanDuration] = useState<BanDuration>("1_week");
  const [banToast, setBanToast] = useState<string | null>(null);

  const resolvedStatus = ["actioned", "dismissed"].includes(status);

  const recipientId = getRecipientId();
  const recipientIsAdmin = report.target?.role === "admin";

  function getRecipientId(): string | null {
    if (report.reportable_type === "provider") return report.reportable_id ?? null;
    if (report.reportable_type === "review") return report.target?.customer_id ?? null;
    if (report.reportable_type === "project_message") return report.target?.sender_id ?? null;
    return null;
  }

  async function saveChanges(nextStatus: string, nextNotes: string = notes) {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("admin_update_report", {
        p_report_id: report.id,
        p_status: nextStatus,
        p_admin_notes: nextNotes || null,
      });
      if (rpcError) throw rpcError;
      setStatus(nextStatus);
      setNotes(nextNotes);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  const appendWarningNote = (current: string, sentence: string) => {
    const trimmed = current.trim();
    if (!trimmed) return sentence;
    return trimmed.includes(sentence) ? trimmed : `${trimmed}\n${sentence}`;
  };

  const recipientName = report.target?.full_name ?? report.target?.user_code ?? report.target?.sender_id ?? "Recipient";
  const recipientLabel = `${recipientName}${report.target?.user_code ? ` (#${report.target.user_code})` : ""}`;
  const isProjectMessage = report.reportable_type === "project_message";

  async function handleMessageToggle() {
    if (!isProjectMessage || !report.reportable_id) return;
    const supabase = createClient();
    try {
      if (report.target?.admin_removed_at) {
        await supabase.rpc("admin_restore_project_message", { p_message_id: report.reportable_id });
      } else {
        await supabase.rpc("admin_remove_project_message", { p_message_id: report.reportable_id });
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update the message");
    }
  }

  if (!editing) {
    return (
      <>
        <div className="space-y-3 rounded border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Resolve this report</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[status] ?? "bg-gray-100 text-gray-700"}`}>
              {status === "open" ? "Open" : status === "reviewed" ? "Reviewed" : status === "actioned" ? "Actioned" : status === "dismissed" ? "Dismissed" : status}
            </span>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded border bg-background p-2 text-sm"
            rows={4}
            placeholder="Optional notes about this report..."
          />

          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white" onClick={() => void saveChanges("dismissed")} disabled={saving}>Dismiss (no violation)</button>
            <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => void saveChanges("reviewed")} disabled={saving}>Mark as reviewed</button>
            {recipientId && (
              <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => setShowWarningDialog(true)}>Send warning</button>
            )}
            {!recipientIsAdmin && recipientId && (
              <>
                <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => { setBanDuration("1_week"); setShowBanDialog(true); }}>Ban 1 week</button>
                <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => { setBanDuration("1_year"); setShowBanDialog(true); }}>Ban 1 year</button>
                <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => { setBanDuration("permanent"); setShowBanDialog(true); }}>Ban forever</button>
              </>
            )}
            {isProjectMessage && (
              <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => void handleMessageToggle()}>
                {report.target?.admin_removed_at ? "Restore message" : "Remove message"}
              </button>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {resolvedStatus && notes && (
            <div className="rounded bg-background p-2 text-sm text-muted-foreground">{notes}</div>
          )}

          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setEditing(true)}>Edit report</button>
        </div>

        {recipientId && (
          <SendWarningDialog
            isOpen={showWarningDialog}
            recipientId={recipientId}
            reportId={report.id}
            onClose={() => setShowWarningDialog(false)}
            recipientName={recipientName}
            recipientUserCode={report.target?.user_code ?? undefined}
            onSuccess={() => {
              const nextNotes = appendWarningNote(notes, "Warning sent.");
              void saveChanges("actioned", nextNotes);
              setShowWarningDialog(false);
            }}
          />
        )}

        <BanUserDialog
          isOpen={showBanDialog}
          userId={recipientId}
          userLabel={recipientLabel}
          reportId={report.id}
          defaultReason={notes || "The account was suspended for violating platform rules."}
          defaultDuration={banDuration}
          onClose={() => setShowBanDialog(false)}
          onSuccess={(emailSent, bannedUntil) => {
            const dateText = bannedUntil ? new Date(bannedUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "permanently";
            setBanToast(`User banned until ${dateText}`);
            setShowBanDialog(false);
            setTimeout(() => setBanToast(null), 5000);
            router.refresh();
            if (emailSent) {
              setNotes((current) => appendWarningNote(current, `User banned until ${dateText}. Email sent.`));
            }
          }}
        />

        {banToast && (
          <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
            {banToast}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-3 rounded border bg-muted/30 p-3">
      <div>
        <label className="block text-sm font-medium">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded border bg-background px-2 py-1">
          <option value="open">Open</option>
          <option value="reviewed">Reviewed</option>
          <option value="actioned">Actioned</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Admin notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded border bg-background p-2" rows={4} placeholder="Optional notes about this report..." />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button type="button" className="rounded bg-blue-600 px-3 py-1 text-sm text-white" onClick={() => void saveChanges(status)} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => { setEditing(false); setStatus(report?.status ?? "open"); setNotes(report?.admin_notes ?? ""); setError(null); }} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}

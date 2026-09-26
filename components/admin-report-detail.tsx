"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SendWarningDialog from "./send-warning-dialog";

export default function AdminReportDetail({ report }: { report: any }) {
  const [status, setStatus] = useState(report?.status ?? "open");
  const [notes, setNotes] = useState(report?.admin_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  async function saveChanges() {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("admin_update_report", {
        p_report_id: report.id,
        p_status: status,
        p_admin_notes: notes || null,
      });
      if (rpcError) throw rpcError;
      setEditing(false);
      // simple feedback: reload to pick up server-side changes
      window.location.reload();
    } catch (err) {
      setError((err as any)?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  function getRecipientId(): string | null {
    if (report.reportable_type === "provider") {
      return report.reportable_id;
    } else if (report.reportable_type === "review") {
      return report.target?.customer_id || null;
    }
    return null;
  }

  const recipientId = getRecipientId();

  if (!editing) {
    return (
      <>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Status</label>
            <p className="mt-1 text-sm text-muted-foreground capitalize">{status}</p>
          </div>

          {notes && (
            <div>
              <label className="block text-sm font-medium">Admin notes</label>
              <p className="mt-1 text-sm text-muted-foreground">{notes}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button className="rounded border px-3 py-1 text-sm" onClick={() => setEditing(true)}>
              {notes ? "Edit report" : "Add notes"}
            </button>
            {recipientId && (
              <button
                className="rounded border px-3 py-1 text-sm"
                onClick={() => setShowWarningDialog(true)}
              >
                Send warning
              </button>
            )}
          </div>

          {toastMessage && (
            <div className="mt-2 rounded bg-green-50 p-2 text-sm text-green-700">
              {toastMessage}
            </div>
          )}
        </div>

        {recipientId && (
          <SendWarningDialog
            isOpen={showWarningDialog}
            recipientId={recipientId}
            reportId={report.id}
            onClose={() => setShowWarningDialog(false)}
            onSuccess={(emailSent) => {
              setToastMessage(
                emailSent
                  ? "Warning sent"
                  : "Warning sent (email delivery failed, notified in-app only)"
              );
              setTimeout(() => setToastMessage(null), 5000);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="mt-1 w-full rounded border bg-background px-2 py-1"
        >
          <option value="open">Open</option>
          <option value="reviewed">Reviewed</option>
          <option value="actioned">Actioned</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Admin notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded border bg-background p-2"
          rows={4}
          placeholder="Optional notes about this report..."
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
          onClick={saveChanges}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          className="rounded border px-3 py-1 text-sm"
          onClick={() => {
            setEditing(false);
            setStatus(report?.status ?? "open");
            setNotes(report?.admin_notes ?? "");
            setError(null);
          }}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

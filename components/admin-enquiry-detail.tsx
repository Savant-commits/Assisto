"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminEnquiryDetail({ enquiry }: { enquiry: any }) {
  const [note, setNote] = useState(enquiry?.admin_note ?? "");
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);

  async function saveNote() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("admin_add_note", { p_enquiry_id: enquiry.id, p_note: note });
      if (error) throw error;
      // simple feedback: collapse editor and reload to pick up server-side changes
      setEditing(false);
      window.location.reload();
    } catch (err) {
      alert((err as any)?.message || "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  async function forceCancel() {
    if (!reason.trim()) return alert("Please provide a reason");
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("admin_force_cancel", { p_enquiry_id: enquiry.id, p_reason: reason });
      if (error) throw error;
      window.location.reload();
    } catch (err) {
      alert((err as any)?.message || "Failed to cancel enquiry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Admin note</label>
        {!editing ? (
          <div className="mt-2 flex items-center justify-between gap-4">
            <div className="flex-1">
              {note ? (
                <p className="text-sm text-muted-foreground">{note}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No note</p>
              )}
            </div>
            <div className="flex-shrink-0">
              <button className="rounded border px-3 py-1" onClick={() => setEditing(true)}>
                {note ? "Edit note" : "Add note"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded border p-2" rows={4} />
            <div className="mt-2 flex items-center gap-2">
              <button className="rounded bg-blue-600 px-3 py-1 text-white" onClick={saveNote} disabled={saving}>
                Save note
              </button>
              <button className="rounded border px-3 py-1" onClick={() => { setEditing(false); setNote(enquiry?.admin_note ?? ""); }} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Force-cancel enquiry</label>
        {confirming ? (
          <div className="mt-2 space-y-2">
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="w-full rounded border p-2" />
            <div className="flex gap-2">
              <button className="rounded bg-red-600 px-3 py-1 text-white" onClick={forceCancel} disabled={saving}>
                Confirm cancel
              </button>
              <button className="rounded border px-3 py-1" onClick={() => setConfirming(false)} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <button className="rounded border px-3 py-1" onClick={() => setConfirming(true)}>
              Force-cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

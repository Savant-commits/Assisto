"use client";

import { useState } from "react";
import { sendWarning } from "@/app/actions/warnings";

interface SendWarningDialogProps {
  isOpen: boolean;
  recipientId: string;
  reportId?: string;
  onClose: () => void;
  onSuccess: (emailSent: boolean) => void;
}

export default function SendWarningDialog({
  isOpen,
  recipientId,
  reportId,
  onClose,
  onSuccess,
}: SendWarningDialogProps) {
  const [title, setTitle] = useState("Warning regarding your recent activity on Assisto");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!body.trim()) {
      setError("Please enter a message");
      return;
    }

    setSending(true);
    setError(null);
    try {
      const result = await sendWarning({
        recipientId,
        title,
        body,
        reportId,
      });
      onSuccess(result.emailSent);
      setTitle("Warning regarding your recent activity on Assisto");
      setBody("");
      onClose();
    } catch (err) {
      setError((err as any)?.message || "Failed to send warning");
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Send Warning</h2>

        <div className="mb-4 space-y-4">
          <div>
            <label className="block text-sm font-medium">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded border bg-background px-3 py-2"
              disabled={sending}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 w-full rounded border bg-background p-2"
              rows={5}
              placeholder="Enter the warning message..."
              disabled={sending}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex gap-2">
          <button
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? "Sending…" : "Send warning"}
          </button>
          <button
            className="rounded border px-4 py-2 text-sm disabled:opacity-50"
            onClick={onClose}
            disabled={sending}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

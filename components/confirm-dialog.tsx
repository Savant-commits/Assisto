"use client";

import { useEscapeKey } from "@/lib/use-escape-key";
import type { ReactNode } from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  children?: ReactNode;
  confirmDisabled?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  children,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEscapeKey(isOpen, onCancel);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-2 text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mb-5 text-sm text-muted-foreground">{message}</p>
        {children}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded border px-4 py-2 text-sm"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`rounded px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${destructive ? "bg-red-600" : "bg-gray-900"}`}
            onClick={() => void onConfirm()}
            disabled={busy || confirmDisabled}
          >
            {busy ? `${confirmLabel}...` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

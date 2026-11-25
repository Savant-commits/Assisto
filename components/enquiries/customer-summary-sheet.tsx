"use client";

import { X } from "lucide-react";
import { Avatar } from "@/components/avatar";

export type CustomerSummary = {
  fullName: string | null;
  avatarUrl: string | null;
  city: string | null;
  createdAt: string | null;
};

export function CustomerSummarySheet({ open, customer, onClose }: { open: boolean; customer: CustomerSummary | null; onClose: () => void }) {
  if (!open || !customer) return null;
  const name = customer.fullName?.trim() || "Customer";

  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-foreground/40 sm:items-center sm:justify-center sm:p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="customer-summary-title" className="w-full rounded-t-3xl border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-card-foreground shadow-lifted sm:max-w-md sm:rounded-2xl sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="customer-summary-title" className="font-display text-xl">Customer details</h2>
          <button type="button" aria-label="Close customer details" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="flex items-center gap-4">
          <Avatar src={customer.avatarUrl} name={name} size={64} className="size-16 rounded-full border border-border bg-muted text-lg text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-foreground">{name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{customer.city?.trim() || "Town not provided"}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AdminChatsList({ chats }: { chats: any[] }) {
  const [value, setValue] = useState("unresolved");
  const [search, setSearch] = useState("");

  const tabs = [
    { key: "unresolved", label: "Unresolved" },
    { key: "resolved", label: "Resolved" },
    { key: "all", label: "All reported" },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (chats || []).filter((c) => {
      if (value === "unresolved" && c.unresolvedReports === 0) return false;
      if (value === "resolved" && c.unresolvedReports > 0) return false;
      if (!q) return true;
      return [c.project_code, c.enquiry_code, c.customer?.full_name, c.customer?.user_code, c.provider?.business_name, c.provider?.profiles?.user_code]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [chats, search, value]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <input className="h-8 w-full rounded-lg border border-input px-2" placeholder="Search by project/enquiry/customer/provider" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="mb-4 flex items-center gap-2">
        {tabs.map((t) => (
          <button key={t.key} className={`rounded-lg border px-3 py-1 ${value === t.key ? 'bg-muted' : ''}`} onClick={() => setValue(t.key)}>
            {t.label} <Badge variant="secondary">{filtered.filter((c) => (t.key === 'unresolved' ? c.unresolvedReports > 0 : t.key === 'resolved' ? c.unresolvedReports === 0 : true)).length}</Badge>
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <div className="rounded-lg border p-4 text-muted-foreground">No {value === 'unresolved' ? 'unresolved reported chats' : value === 'resolved' ? 'resolved reported chats' : 'reported chats'}</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((c) => (
            <div key={c.id} className="rounded-lg border p-4">
              <div className="mb-2 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{c.project_code} · {c.enquiry_code}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Chat opened: {formatDateTime(c.openedAt)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{c.enquiry_status === 'confirmed' ? `Open for ${c.duration}` : `Was open for ${c.duration}`}</p>
                </div>
                <div className="flex flex-col items-end gap-2 text-sm text-muted-foreground">
                  {c.unresolvedReports > 0 ? (
                    <div className="inline-flex items-center gap-2">
                      <span title="Unresolved reports" className="h-3.5 w-3.5 rounded-full bg-red-600 block" />
                      <Badge variant="destructive">Reported ({c.unresolvedReports})</Badge>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2">
                      <span title="Resolved reports" className="h-3.5 w-3.5 rounded-full bg-gray-400 block" />
                      <Badge variant="secondary">Reported, resolved ({c.totalReports})</Badge>
                    </div>
                  )}
                  <Link href={`/admin/reports/chat/${c.id}?message=${c.jumpMessageId}`} className="mt-2 inline-block rounded border px-3 py-1 text-sm">View full chat</Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{c.customer?.full_name ?? c.customer?.id ?? 'Unknown'}</p>
                  {c.customer?.user_code && <p className="text-sm text-muted-foreground">#{c.customer.user_code}</p>}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Provider</p>
                  <p className="font-medium">{c.provider?.business_name ?? 'Unknown'}</p>
                  {c.provider?.profiles?.user_code && <p className="text-sm text-muted-foreground">#{c.provider.profiles.user_code}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

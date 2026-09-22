"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminEnquiryDetail from "./admin-enquiry-detail";

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AdminEnquiriesTabs({ enquiries }: { enquiries: any[] }) {
  const tabs = [
    { key: "active_services", label: "Active services", statuses: ["confirmed"] },
    { key: "active_enquiries", label: "Active enquiries", statuses: ["sent"] },
    { key: "completed", label: "Completed", statuses: ["completed"] },
    { key: "cancelled", label: "Cancelled", statuses: ["declined"] },
    { key: "withdrawn", label: "Withdrawn", statuses: ["cancelled"] },
  ];

  const [value, setValue] = useState(tabs[0].key);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filteredEnquiries = useMemo(() => {
    return (enquiries || []).filter((e: any) => {
      if (from) {
        const fromTime = new Date(from).getTime();
        if (!e.created_at || new Date(e.created_at).getTime() < fromTime) return false;
      }
      if (to) {
        const toTime = new Date(to).getTime();
        if (!e.created_at || new Date(e.created_at).getTime() > toTime) return false;
      }
      if (!search) return true;

      const q = search.toLowerCase();
      const matches = [
        e.enquiry_code,
        e.profiles?.full_name,
        e.providers?.business_name,
        e.profiles?.user_code,
        e.providers?.profiles?.user_code,
      ].filter(Boolean);

      return matches.some((item: any) => String(item).toLowerCase().includes(q));
    });
  }, [enquiries, from, search, to]);

  return (
    <Tabs value={value} onValueChange={(nextValue) => setValue(String(nextValue))} className="space-y-4">
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <input
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none"
            placeholder="Search by code, name, or user code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input type="date" className="h-8 rounded-lg border border-input bg-transparent px-2" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="h-8 rounded-lg border border-input bg-transparent px-2" value={to} onChange={(e) => setTo(e.target.value)} />
          <button
            className="rounded-lg border px-3 py-1 text-sm"
            onClick={() => {
              setSearch("");
              setFrom("");
              setTo("");
            }}
          >
            Clear filters
          </button>
        </div>

        <TabsList>
          {tabs.map((t) => {
            const count = filteredEnquiries.filter((e: any) => t.statuses.includes(e.status)).length;
            return (
              <TabsTrigger key={t.key} value={t.key} className="flex items-center gap-2">
                {t.label}
                <Badge variant="secondary">{count}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {tabs.map((t) => {
        const rows = filteredEnquiries.filter((e: any) => t.statuses.includes(e.status));

        return (
          <TabsContent key={t.key} value={t.key}>
            {!rows.length ? (
              <div className="rounded-lg border p-4 text-muted-foreground">No items</div>
            ) : (
              <div className="space-y-4">
                {rows.map((enq: any) => {
                  const staleAgeMs = enq.status === "sent" && enq.created_at ? Date.now() - new Date(enq.created_at).getTime() : 0;
                  const isStale = enq.status === "sent" && staleAgeMs > 48 * 60 * 60 * 1000;
                  const ageDays = enq.created_at ? Math.max(0, Math.floor(staleAgeMs / (1000 * 60 * 60 * 24))) : 0;

                  return (
                    <div key={enq.id} className="rounded-lg border p-4">
                      <div className="mb-2 flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium">{enq.profiles?.full_name || enq.customer_id}</p>
                          {enq.enquiry_code && (
                            <p className="mt-0.5 text-sm text-muted-foreground">{enq.enquiry_code}</p>
                          )}
                          {enq.created_at && (
                            <p className="mt-0.5 text-sm text-muted-foreground">Sent: {formatDateTime(enq.created_at)}</p>
                          )}
                          {enq.accepted_at && (
                            <p className="mt-0.5 text-sm text-muted-foreground">Approved: {formatDateTime(enq.accepted_at)}</p>
                          )}
                          {enq.declined_at && (
                            <p className="mt-0.5 text-sm text-muted-foreground">Rejected: {formatDateTime(enq.declined_at)}</p>
                          )}
                          {enq.status === "declined" && enq.decline_reason && (
                            <p className="mt-0.5 text-sm text-muted-foreground">Reason: {enq.decline_reason}</p>
                          )}
                          {enq.is_asap ? (
                            <p className="mt-0.5 text-sm text-muted-foreground">Scheduled: Now (ASAP)</p>
                          ) : enq.scheduled_start_at ? (
                            <p className="mt-0.5 text-sm text-muted-foreground">Scheduled: {formatDateTime(enq.scheduled_start_at)}</p>
                          ) : null}
                          {enq.contact_unlocked_at && (
                            <p className="mt-0.5 text-sm text-muted-foreground">Confirmed: {formatDateTime(enq.contact_unlocked_at)}</p>
                          )}
                          {enq.completed_at && (
                            <p className="mt-0.5 text-sm text-muted-foreground">Completed: {formatDateTime(enq.completed_at)}</p>
                          )}
                          {enq.providers?.business_name && (
                            <p className="mt-1 text-sm">
                              <a href={`/providers/${enq.providers?.id ?? ""}`} className="font-medium text-blue-600 underline">
                                {enq.providers.business_name}
                              </a>
                            </p>
                          )}
                          {enq.customer_requirements?.description && (
                            <p className="mt-1 text-sm text-muted-foreground">Regarding: {enq.customer_requirements.description}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 text-sm text-muted-foreground">
                          <span>{enq.status}</span>
                          {isStale && (
                            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                              No response — {ageDays}d
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="mb-3 text-sm text-muted-foreground">{enq.message}</p>
                      <AdminEnquiryDetail enquiry={enq} />
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}


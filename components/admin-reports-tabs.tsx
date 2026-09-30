"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminReportDetail from "./admin-report-detail";

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

type ReportProfile = {
  full_name?: string | null;
  user_code?: string | null;
};

type ReportTarget = {
  id?: string;
  rating?: number;
  comment?: string | null;
  business_name?: string | null;
  body?: string;
  project_id?: string;
  project_code?: string | null;
  enquiry_code?: string | null;
  profiles?: ReportProfile | null;
};

type ReportRow = {
  id: string;
  reportable_type: string;
  reportable_id: string;
  profiles?: ReportProfile | null;
  target?: ReportTarget | null;
  created_at?: string | null;
  reason?: string | null;
  status?: string;
};

export default function AdminReportsTabs({ reports }: { reports: ReportRow[] }) {
  const tabs = [
    { key: "open", label: "Open", statuses: ["open"] },
    { key: "reviewed", label: "Reviewed", statuses: ["reviewed"] },
    { key: "actioned", label: "Actioned", statuses: ["actioned"] },
    { key: "dismissed", label: "Dismissed", statuses: ["dismissed"] },
  ];

  const [value, setValue] = useState(tabs[0].key);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filteredReports = useMemo(() => {
    return (reports || []).filter((report: ReportRow) => {
      if (from) {
        const fromTime = new Date(from).getTime();
        if (!report.created_at || new Date(report.created_at).getTime() < fromTime) return false;
      }
      if (to) {
        const toTime = new Date(to).getTime();
        if (!report.created_at || new Date(report.created_at).getTime() > toTime) return false;
      }
      if (!search) return true;

      const q = search.toLowerCase();
      const matches: Array<string | null | undefined> = [
        report.reportable_type,
        report.reportable_id,
        report.profiles?.full_name,
        report.profiles?.user_code,
        report.target?.profiles?.full_name,
        report.target?.profiles?.user_code,
        report.target?.body,
        report.target?.project_code,
        report.target?.enquiry_code,
        report.reason,
      ];

      return matches.some((item) => item && String(item).toLowerCase().includes(q));
    });
  }, [reports, from, search, to]);

  return (
    <Tabs value={value} onValueChange={(nextValue) => setValue(String(nextValue))} className="space-y-4">
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <input
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none"
            placeholder="Search by type, ID, name, user code, or reason"
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
            const count = filteredReports.filter((r: ReportRow) => t.statuses.includes(r.status)).length;
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
        const rows = filteredReports.filter((r: ReportRow) => t.statuses.includes(r.status));

        return (
          <TabsContent key={t.key} value={t.key}>
            {!rows.length ? (
              <div className="rounded-lg border p-4 text-muted-foreground">No items</div>
            ) : (
              <div className="space-y-4">
                {rows.map((report: ReportRow) => (
                  <div key={report.id} className="rounded-lg border p-4">
                    <div className="mb-2 flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium">
                          {report.reportable_type === "provider"
                            ? "Provider"
                            : report.reportable_type === "project_message"
                              ? "Project message"
                              : "Review"} report
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">ID: {report.reportable_id}</p>
                        {report.created_at && (
                          <p className="mt-0.5 text-sm text-muted-foreground">Reported: {formatDateTime(report.created_at)}</p>
                        )}
                        <p className="mt-1 text-sm">
                          Reporter: <span className="font-medium">{report.profiles?.full_name || "Unknown"}</span>{' '}
                          {report.profiles?.user_code && (
                            <span className="ml-1 text-xs text-muted-foreground">#{report.profiles.user_code}</span>
                          )}
                        </p>
                        {report.reportable_type === "review" && report.target && (
                          <div className="mt-2 rounded-md border p-3">
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <span key={i} className={i < report.target.rating ? "text-yellow-500" : "text-gray-300"}>
                                  ★
                                </span>
                              ))}
                            </div>
                            {report.target.comment && <p className="mt-1 text-sm">{report.target.comment}</p>}
                            <p className="mt-1 text-xs text-muted-foreground">
                              by {report.target.profiles?.full_name ?? "Unknown"}
                              {report.target?.profiles?.user_code && (
                                <span className="ml-1 text-xs text-muted-foreground">#{report.target.profiles.user_code}</span>
                              )}
                            </p>
                          </div>
                        )}
                        {report.reportable_type === "review" && !report.target && (
                          <p className="mt-2 text-sm italic text-muted-foreground">Original review no longer exists</p>
                        )}

                        {report.reportable_type === "project_message" && report.target && (
                          <div className="mt-2 rounded-md border p-3">
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Message</p>
                            <blockquote className="border-l-2 border-muted pl-3 text-sm italic text-muted-foreground">
                              “{report.target.body}”
                            </blockquote>
                            <p className="mt-2 text-xs text-muted-foreground">
                              by {report.target.profiles?.full_name ?? "Unknown"}
                              {report.target?.profiles?.user_code && (
                                <span className="ml-1 text-xs text-muted-foreground">#{report.target.profiles.user_code}</span>
                              )}
                            </p>
                            {(report.target.project_code || report.target.enquiry_code) && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {report.target.project_code ? `Project ${report.target.project_code}` : "Project unknown"}
                                {report.target.enquiry_code ? ` · Enquiry ${report.target.enquiry_code}` : ""}
                              </p>
                            )}
                            {report.target.project_id && (
                              <Link href={`/enquiries?chat=${report.target.project_id}`} className="mt-2 inline-block text-sm text-blue-600 underline">
                                Open chat
                              </Link>
                            )}
                          </div>
                        )}
                        {report.reportable_type === "project_message" && !report.target && (
                          <p className="mt-2 text-sm italic text-muted-foreground">Original message no longer exists</p>
                        )}

                        {report.reportable_type === "provider" && report.target && (
                          <Link href={`/providers/${report.target.id}`} className="mt-2 inline-block text-sm underline">
                            {report.target.business_name}
                          </Link>
                        )}
                        {report.reportable_type === "provider" && !report.target && (
                          <p className="mt-2 text-sm italic text-muted-foreground">Original provider no longer exists</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 text-sm text-muted-foreground">
                        <span>{report.status}</span>
                      </div>
                    </div>

                    <div className="mb-3 rounded bg-muted p-2">
                      <p className="text-sm">
                        <span className="font-medium">Reason: </span>
                        {report.reason}
                      </p>
                    </div>

                    <AdminReportDetail report={report} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

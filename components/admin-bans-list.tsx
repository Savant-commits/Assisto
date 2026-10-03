"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { liftBan } from "@/app/actions/bans";

export type UserBanListItem = {
  id: string;
  user_id: string;
  report_id?: string | null;
  reason: string;
  duration: "1_week" | "1_year" | "permanent";
  banned_until?: string | null;
  provider_was_active?: boolean | null;
  created_by?: string | null;
  created_at: string;
  lifted_at?: string | null;
  lifted_by?: string | null;
  user?: { full_name?: string | null; user_code?: string | null } | null;
  provider?: { business_name?: string | null; is_active?: boolean | null } | null;
  admin?: { full_name?: string | null; user_code?: string | null } | null;
};

const tabKeys = ["active", "expired", "lifted", "all"] as const;
type TabKey = (typeof tabKeys)[number];

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function getDurationLabel(duration: UserBanListItem["duration"]) {
  if (duration === "1_week") return "1 week";
  if (duration === "1_year") return "1 year";
  return "Permanent";
}

function isActiveBan(ban: UserBanListItem) {
  return !ban.lifted_at && !!ban.banned_until && new Date(ban.banned_until).getTime() > Date.now();
}

function isExpiredBan(ban: UserBanListItem) {
  return !ban.lifted_at && !!ban.banned_until && new Date(ban.banned_until).getTime() <= Date.now();
}

export default function AdminBansList({ bans }: { bans: UserBanListItem[] }) {
  const [tab, setTab] = useState<TabKey>("active");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (bans || []).filter((ban) => {
      const matchesTab =
        tab === "active" ? isActiveBan(ban) :
        tab === "expired" ? isExpiredBan(ban) :
        tab === "lifted" ? !!ban.lifted_at : true;

      if (!matchesTab) return false;
      if (!q) return true;

      const haystack = [
        ban.user?.full_name,
        ban.user?.user_code,
        ban.provider?.business_name,
        ban.reason,
        ban.admin?.full_name,
        ban.admin?.user_code,
      ].filter(Boolean).join(" ").toLowerCase();

      return haystack.includes(q);
    });
  }, [bans, query, tab]);

  async function handleLift(ban: UserBanListItem) {
    const confirmText = ban.provider_was_active && ban.provider && !ban.provider.is_active
      ? "Lift this ban and reactivate the provider listing?"
      : "Lift this ban?";
    if (!window.confirm(confirmText)) return;

    setBusyId(ban.id);
    try {
      await liftBan(ban.id);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 w-full rounded border bg-background px-3 text-sm"
          placeholder="Search by name or user code"
        />
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {tabKeys.map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded border px-3 py-1.5 text-sm ${tab === item ? "bg-muted" : "bg-white"}`}
            onClick={() => setTab(item)}
          >
            {item === "active" ? "Active" : item === "expired" ? "Expired" : item === "lifted" ? "Lifted" : "All"}
            <span className="ml-2 text-xs text-muted-foreground">
              {item === "active" ? bans.filter(isActiveBan).length : item === "expired" ? bans.filter(isExpiredBan).length : item === "lifted" ? bans.filter((ban) => !!ban.lifted_at).length : bans.length}
            </span>
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <div className="rounded border bg-muted/30 p-4 text-sm text-muted-foreground">No matching bans.</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((ban) => {
            const userName = ban.user?.full_name || "Unknown user";
            const userCode = ban.user?.user_code ? `#${ban.user.user_code}` : "";
            const isActive = isActiveBan(ban);
            const isExpired = isExpiredBan(ban);
            const showReactivate = isExpired && !!ban.provider_was_active && ban.provider && ban.provider.is_active === false;

            return (
              <div key={ban.id} className="rounded border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-medium">{userName} {userCode && <span className="text-muted-foreground">{userCode}</span>}</p>
                    {ban.provider?.business_name && <p className="text-sm text-muted-foreground">{ban.provider.business_name}</p>}
                    <p className="mt-2 text-sm text-muted-foreground">
                      {getDurationLabel(ban.duration)} · {ban.banned_until ? `Until ${formatDate(ban.banned_until)}` : "Permanent"}
                    </p>
                  </div>

                  <div className="flex flex-col items-start gap-2 md:items-end">
                    {isActive && (
                      <button
                        type="button"
                        className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => void handleLift(ban)}
                        disabled={busyId === ban.id}
                      >
                        {busyId === ban.id ? "Updating..." : showReactivate ? "Lift ban and reactivate listing" : "Lift ban"}
                      </button>
                    )}
                    {isExpired && showReactivate && (
                      <button
                        type="button"
                        className="rounded border px-3 py-1.5 text-sm"
                        onClick={() => void handleLift(ban)}
                        disabled={busyId === ban.id}
                      >
                        {busyId === ban.id ? "Updating..." : "Lift ban and reactivate listing"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p><span className="font-medium text-foreground">Reason:</span> {ban.reason}</p>
                  <p><span className="font-medium text-foreground">Issued by:</span> {ban.admin?.full_name ?? "Admin"}{ban.admin?.user_code ? ` (#${ban.admin.user_code})` : ""} · {formatDate(ban.created_at)}</p>
                  {ban.report_id && (
                    <p>
                      <span className="font-medium text-foreground">Linked report:</span>{" "}
                      <Link href="/admin/reports" className="text-blue-600 underline">View report</Link>
                    </p>
                  )}
                  {ban.lifted_at && (
                    <p><span className="font-medium text-foreground">Lifted:</span> {formatDate(ban.lifted_at)}</p>
                  )}
                  {ban.provider_was_active !== null && ban.provider_was_active !== undefined && (
                    <p><span className="font-medium text-foreground">Provider listing was:</span> {ban.provider_was_active ? "active before" : "inactive before"}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

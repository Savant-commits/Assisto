"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { PageHeading } from "@/components/page-heading";

type Conversation = {
  enquiryId: number;
  projectId: string;
  status: string;
  name: string;
  avatarUrl: string | null;
  preview: string;
  updatedAt: string | null;
  unreadCount: number;
};

function formatRelativeTime(value: string | null) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function MessagesPage() {
  const [tab, setTab] = useState<"active" | "history">("active");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) {
      setLoading(false);
      setError("Please sign in to view conversations.");
      return;
    }

    const userId = userData.user.id;
    const { data: sentRows, error: sentError } = await supabase
      .from("enquiries")
      .select("id,status,updated_at,providers(id,business_name,profiles!providers_id_fkey(full_name,avatar_url)),projects(id,project_code)")
      .eq("customer_id", userId)
      .order("updated_at", { ascending: false });

    const { data: providerRow } = await supabase.from("providers").select("id").eq("id", userId).maybeSingle();
    let receivedRows: unknown[] = [];
    let receivedError: { message: string } | null = null;
    if (providerRow) {
      const result = await supabase
        .from("enquiries")
        .select("id,status,updated_at,profiles!enquiries_customer_id_fkey(full_name,avatar_url),projects(id,project_code)")
        .eq("provider_id", userId)
        .order("updated_at", { ascending: false });
      receivedRows = result.data ?? [];
      receivedError = result.error;
    }

    if (sentError || receivedError) {
      setError("Unable to load conversations right now.");
      setLoading(false);
      return;
    }

    const projectIds = new Set<string>();
    const rows: Conversation[] = [];

    for (const raw of (sentRows ?? []) as Array<Record<string, unknown>>) {
      const projects = Array.isArray(raw.projects) ? raw.projects[0] : raw.projects;
      const providers = Array.isArray(raw.providers) ? raw.providers[0] : raw.providers;
      const providerProfile = providers && typeof providers === "object" && "profiles" in providers
        ? (Array.isArray((providers as Record<string, unknown>).profiles) ? ((providers as Record<string, unknown>).profiles as Array<Record<string, unknown>>)[0] : (providers as Record<string, unknown>).profiles as Record<string, unknown>)
        : null;
      const projectId = projects && typeof projects === "object" ? String((projects as Record<string, unknown>).id ?? "") : "";
      if (!projectId) continue;
      projectIds.add(projectId);
      const providerRecord = providers as Record<string, unknown> | null;
      rows.push({
        enquiryId: Number(raw.id),
        projectId,
        status: String(raw.status),
        name: typeof providerRecord?.business_name === "string" && providerRecord.business_name.trim() ? providerRecord.business_name : typeof providerProfile?.full_name === "string" ? providerProfile.full_name : "Provider",
        avatarUrl: typeof providerProfile?.avatar_url === "string" ? providerProfile.avatar_url : null,
        preview: "",
        updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : null,
        unreadCount: 0,
      });
    }

    for (const raw of receivedRows as Array<Record<string, unknown>>) {
      const projects = Array.isArray(raw.projects) ? raw.projects[0] : raw.projects;
      const profile = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles;
      const projectId = projects && typeof projects === "object" ? String((projects as Record<string, unknown>).id ?? "") : "";
      if (!projectId) continue;
      projectIds.add(projectId);
      const profileRecord = profile as Record<string, unknown> | null;
      rows.push({
        enquiryId: Number(raw.id),
        projectId,
        status: String(raw.status),
        name: typeof profileRecord?.full_name === "string" && profileRecord.full_name.trim() ? profileRecord.full_name : "Customer",
        avatarUrl: typeof profileRecord?.avatar_url === "string" ? profileRecord.avatar_url : null,
        preview: "",
        updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : null,
        unreadCount: 0,
      });
    }

    const unreadCounts: Record<string, number> = {};
    if (projectIds.size > 0) {
      const { data: unreadRows } = await supabase
        .from("project_messages")
        .select("project_id")
        .in("project_id", [...projectIds])
        .is("read_at", null)
        .is("deleted_at", null)
        .neq("sender_id", userId);
      for (const row of unreadRows ?? []) {
        unreadCounts[row.project_id] = (unreadCounts[row.project_id] || 0) + 1;
      }
    }

    const ids = [...projectIds];
    if (ids.length > 0) {
      const { data: messageRows } = await supabase
        .from("project_messages")
        .select("project_id,body,created_at")
        .in("project_id", ids)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      const latest = new Map<string, { body: string; created_at: string }>();
      for (const row of messageRows ?? []) {
        if (!latest.has(row.project_id)) latest.set(row.project_id, row);
      }
      for (const row of rows) {
        const message = latest.get(row.projectId);
        if (message) {
          row.preview = message.body;
          if (!row.updatedAt || new Date(message.created_at).getTime() > new Date(row.updatedAt).getTime()) row.updatedAt = message.created_at;
        }
        row.unreadCount = unreadCounts[row.projectId] || 0;
      }
    }

    rows.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    setConversations(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const supabase = createClient();
    const channel = supabase.channel("messages-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "project_messages" }, () => { void load(); })
      .subscribe();
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    const onPullRefresh = () => { void load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("app:pull-refresh", onPullRefresh);
    return () => {
      clearTimeout(initialLoad);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("app:pull-refresh", onPullRefresh);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const active = conversations.filter((conversation) => conversation.status === "accepted" || conversation.status === "confirmed");
  const history = conversations.filter((conversation) => conversation.status === "completed" || conversation.status === "cancelled" || conversation.status === "declined");
  const shown = tab === "active" ? active : history;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-0 pb-12 sm:pb-10">
      <PageHeading title="Messages" description="Conversations with your customers and providers." />

      <div className="sticky top-[env(safe-area-inset-top)] z-20 mt-6 rounded-full border border-border bg-card p-1 shadow-sm">
        <div className="grid grid-cols-2 gap-1">
          {(["active", "history"] as const).map((value) => (
            <button key={value} type="button" onClick={() => setTab(value)} aria-pressed={tab === value} className={`min-h-11 rounded-full px-4 text-sm font-semibold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              {value} <span className={`ml-1 inline-flex min-w-5 justify-center rounded-full px-1 text-xs ${tab === value ? "bg-primary-foreground/15 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{value === "active" ? active.length : history.length}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-5 space-y-3" aria-label="Loading conversations" aria-busy="true">
          {[0, 1, 2].map((item) => <div key={item} className="skeleton h-24 rounded-2xl border border-border" />)}
        </div>
      ) : error ? (
        <div role="alert" className="mt-5 rounded-2xl border border-border bg-card p-6 text-sm text-destructive">{error}</div>
      ) : shown.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">No conversations yet.</p>
          <Link href="/enquiries" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View enquiries</Link>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {shown.map((conversation) => (
            <Link key={conversation.projectId} href={`/messages/${encodeURIComponent(conversation.projectId)}`} className="flex min-h-24 items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar src={conversation.avatarUrl} name={conversation.name} size={48} className="size-12 rounded-full border border-border bg-muted text-sm text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate font-semibold text-foreground">{conversation.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(conversation.updatedAt)}</span>
                </span>
                <span className="mt-1 line-clamp-1 block text-sm text-muted-foreground">{conversation.preview || "No messages yet"}</span>
              </span>
              {conversation.unreadCount > 0 && <span aria-label={`${conversation.unreadCount} unread`} className="flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground">{conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}</span>}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

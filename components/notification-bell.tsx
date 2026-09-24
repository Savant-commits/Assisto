"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  title: string;
  body?: string | null;
  is_read: boolean;
  type?: string | null;
  related_id?: string | null;
  created_at?: string | null;
};

function relativeTime(iso?: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function load() {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (mounted) {
          setCount(0);
          setNotifications([]);
          setLoading(false);
        }
        return;
      }

      const uid = userData.user.id;

      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", uid)
        .eq("is_read", false);

      if (mounted) setCount(count || 0);

      const { data } = await supabase
        .from("notifications")
        .select("id,title,body,is_read,type,related_id,created_at")
        .eq("recipient_id", uid)
        .order("created_at", { ascending: false })
        .limit(50);

      if (mounted) setNotifications((data as Notification[] | null) || []);
      if (mounted) setLoading(false);
    }

    load();

    const iv = setInterval(() => load(), 30000);

    function onVisible() {
      if (document.visibilityState === "visible") load();
    }

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  async function markAsRead(id: string) {
    const supabase = createClient();
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((s) => s.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setCount((c) => Math.max(0, c - 1));
  }

  async function del(id: string) {
    const supabase = createClient();
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((s) => s.filter((n) => n.id !== id));
  }

  async function markAll() {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("recipient_id", userData.user.id).eq("is_read", false);
    setNotifications((s) => s.map((n) => ({ ...n, is_read: true })));
    setCount(0);
  }

  return (
    <>
      <button
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 inline-flex items-center justify-center rounded-full bg-primary px-3 py-3 shadow-lg hover:brightness-95"
      >
        <Bell className="h-5 w-5 text-white" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

          <aside className="absolute right-6 top-6 bottom-6 w-full max-w-md overflow-auto rounded-lg border bg-background p-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Notifications</h3>
              <div className="flex items-center gap-2">
                <button className="text-sm text-muted-foreground" onClick={markAll} disabled={count === 0}>
                  Mark all as read
                </button>
                <button className="text-sm text-muted-foreground" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
            </div>

            {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

            {!loading && notifications.length === 0 && <div className="text-sm text-muted-foreground">No notifications yet</div>}

            <ul className="flex flex-col gap-3">
              {notifications.map((n) => (
                <li key={n.id} className="flex items-start gap-3 rounded-md border p-3">
                  <div className="flex w-full items-start justify-between">
                    <div className="flex w-full items-start gap-3">
                      <div className="mt-1">
                        {!n.is_read && <span className="block h-2 w-2 rounded-full bg-primary" />}
                      </div>
                      <div className="w-full">
                        <button
                          onClick={async () => {
                            if (!n.is_read) await markAsRead(n.id);
                            // navigate to notification page
                            window.location.href = `/notifications/${n.id}`;
                          }}
                          className="text-left"
                        >
                          <div className="font-medium">{n.title}</div>
                          <div className="text-sm text-muted-foreground line-clamp-2">{n.body}</div>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="text-xs text-muted-foreground">{relativeTime(n.created_at)}</div>
                      <details className="relative">
                        <summary className="cursor-pointer text-muted-foreground">⋯</summary>
                        <div className="absolute right-0 mt-2 w-36 rounded-md border bg-background p-2 shadow">
                          {!n.is_read && (
                            <button
                              onClick={async () => {
                                await markAsRead(n.id);
                              }}
                              className="block w-full text-left text-sm"
                            >
                              Mark as read
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              window.location.href = `/notifications/${n.id}`;
                            }}
                            className="block w-full text-left text-sm"
                          >
                            Open
                          </button>
                          <button
                            onClick={async () => {
                              await del(n.id);
                            }}
                            className="block w-full text-left text-sm text-destructive"
                          >
                            Delete
                          </button>
                        </div>
                      </details>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </>
  );
}

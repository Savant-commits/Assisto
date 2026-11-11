"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, MoreHorizontal, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEscapeKey } from "@/lib/use-escape-key";

type Notification = {
  id: string;
  title: string;
  body?: string | null;
  is_read: boolean;
  type?: string | null;
  related_id?: string | null;
  created_at?: string | null;
};

export type NotificationTab = "all" | "messages";

type NotificationsContextValue = {
  unreadCount: number;
  unreadMessageCount: number;
  isOpen: boolean;
  activeTab: NotificationTab;
  openPanel: (tab: NotificationTab) => void;
  closePanel: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications() {
  return useContext(NotificationsContext);
}

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

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationTab>("all");
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const openPanel = useCallback((tab: NotificationTab) => {
    setActiveTab(tab);
    setIsOpen(true);
  }, []);
  const closePanel = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function load() {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          if (mounted) {
            setUnreadCount(0);
            setUnreadMessageCount(0);
            setNotifications([]);
          }
          return;
        }

        const uid = userData.user.id;
        const [unreadResult, messageUnreadResult, notificationResult] = await Promise.all([
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("recipient_id", uid)
            .eq("is_read", false),
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("recipient_id", uid)
            .eq("is_read", false)
            .eq("type", "project_message"),
          supabase
            .from("notifications")
            .select("id,title,body,is_read,type,related_id,created_at")
            .eq("recipient_id", uid)
            .order("created_at", { ascending: false })
            .limit(50),
        ]);

        if (mounted) {
          setUnreadCount(unreadResult.count || 0);
          setUnreadMessageCount(messageUnreadResult.count || 0);
          setNotifications((notificationResult.data as Notification[] | null) || []);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        window.setTimeout(() => void load(), 0);
      }
    });
    const interval = setInterval(() => void load(), 30000);

    function onVisible() {
      if (document.visibilityState === "visible") void load();
    }

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    const notification = notifications.find((item) => item.id === id);
    if (!notification || notification.is_read) return;
    const supabase = createClient();
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, is_read: true } : item));
    setUnreadCount((count) => Math.max(0, count - 1));
    if (notification.type === "project_message") {
      setUnreadMessageCount((count) => Math.max(0, count - 1));
    }
  }, [notifications]);

  const deleteNotification = useCallback(async (id: string) => {
    const notification = notifications.find((item) => item.id === id);
    const supabase = createClient();
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((current) => current.filter((item) => item.id !== id));
    if (notification && !notification.is_read) {
      setUnreadCount((count) => Math.max(0, count - 1));
      if (notification.type === "project_message") {
        setUnreadMessageCount((count) => Math.max(0, count - 1));
      }
    }
  }, [notifications]);

  const markAll = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("recipient_id", userData.user.id).eq("is_read", false);
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
    setUnreadMessageCount(0);
  }, []);

  const contextValue: NotificationsContextValue = {
    unreadCount,
    unreadMessageCount,
    isOpen,
    activeTab,
    openPanel,
    closePanel,
  };

  return (
    <NotificationsContext.Provider value={contextValue}>
      {children}
      <NotificationsPanel
        isOpen={isOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        notifications={notifications}
        loading={loading}
        unreadCount={unreadCount}
        onClose={closePanel}
        onMarkAsRead={markAsRead}
        onMarkAll={markAll}
        onDelete={deleteNotification}
      />
    </NotificationsContext.Provider>
  );
}

function NotificationsPanel({
  isOpen,
  activeTab,
  setActiveTab,
  notifications,
  loading,
  unreadCount,
  onClose,
  onMarkAsRead,
  onMarkAll,
  onDelete,
}: {
  isOpen: boolean;
  activeTab: NotificationTab;
  setActiveTab: (tab: NotificationTab) => void;
  notifications: Notification[];
  loading: boolean;
  unreadCount: number;
  onClose: () => void;
  onMarkAsRead: (id: string) => Promise<void>;
  onMarkAll: () => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEscapeKey(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, [isOpen]);

  const visibleNotifications = activeTab === "messages"
    ? notifications.filter((notification) => notification.type === "project_message")
    : notifications;

  async function openNotification(notification: Notification) {
    if (!notification.is_read) await onMarkAsRead(notification.id);
    onClose();
    router.push(`/notifications/${notification.id}`);
  }

  function trapFocus(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" aria-label="Close notifications panel" className="absolute inset-0 cursor-default bg-black/40" onClick={onClose} />
      <section
        ref={panelRef}
        aria-labelledby="notifications-panel-title"
        aria-modal="true"
        className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-2xl border border-border bg-background text-foreground shadow-lifted md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-full md:max-w-md md:rounded-none md:border-y-0 md:border-r-0 md:border-l"
        onKeyDown={trapFocus}
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id="notifications-panel-title" className="text-lg font-semibold">
            {activeTab === "messages" ? "Messages" : "Notifications"}
          </h2>
          <div className="flex items-center gap-2">
            {activeTab === "all" && (
              <button
                type="button"
                onClick={() => void onMarkAll()}
                disabled={unreadCount === 0}
                className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <Check aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Mark all as read</span>
              </button>
            )}
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close panel"
              onClick={onClose}
              className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        </header>

        <div role="tablist" aria-label="Notification categories" className="flex gap-2 border-b border-border px-5 py-3">
          {([
            ["all", "All"],
            ["messages", "Messages"],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              id={`notifications-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls="notifications-panel-content"
              tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => setActiveTab(tab)}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  const nextTab = tab === "all" ? "messages" : "all";
                  setActiveTab(nextTab);
                  document.getElementById(`notifications-tab-${nextTab}`)?.focus();
                }
              }}
              className={`min-h-11 rounded-full px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div id="notifications-panel-content" role="tabpanel" aria-labelledby={`notifications-tab-${activeTab}`} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading && <p role="status" className="mb-3 text-sm text-muted-foreground">Loading…</p>}
          {!loading && visibleNotifications.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {activeTab === "messages" ? "No messages yet" : "No notifications yet"}
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {visibleNotifications.map((notification) => (
              <li key={notification.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
                <div className="mt-2 w-2 shrink-0">
                  {!notification.is_read && <span aria-label="Unread" className="block size-2 rounded-full bg-primary" />}
                </div>
                <button
                  type="button"
                  onClick={() => void openNotification(notification)}
                  className="min-h-11 min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block font-medium">{notification.title}</span>
                  {notification.body && <span className="line-clamp-2 block text-sm text-muted-foreground">{notification.body}</span>}
                  <span className="mt-1 block text-xs text-muted-foreground">{relativeTime(notification.created_at)}</span>
                </button>
                <details className="relative shrink-0">
                  <summary aria-label={`Actions for ${notification.title}`} className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <MoreHorizontal aria-hidden="true" className="size-5" />
                  </summary>
                  <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-border bg-popover p-1 shadow-soft">
                    {!notification.is_read && (
                      <button type="button" onClick={() => void onMarkAsRead(notification.id)} className="min-h-11 w-full rounded-md px-3 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        Mark as read
                      </button>
                    )}
                    <button type="button" onClick={() => void openNotification(notification)} className="min-h-11 w-full rounded-md px-3 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      Open
                    </button>
                    <button type="button" onClick={() => void onDelete(notification.id)} className="min-h-11 w-full rounded-md px-3 text-left text-sm text-destructive hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      Delete
                    </button>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

export default function NotificationBell() {
  const notifications = useNotifications();
  if (!notifications) return null;

  return (
    <button
      type="button"
      aria-label={`Notifications${notifications.unreadCount ? `, ${notifications.unreadCount} unread` : ""}`}
      onClick={() => notifications.openPanel("all")}
      className="fixed bottom-6 right-6 z-50 inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lifted hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Bell aria-hidden="true" className="size-5" />
      {!!notifications.unreadCount && (
        <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
          {notifications.unreadCount > 9 ? "9+" : notifications.unreadCount}
        </span>
      )}
    </button>
  );
}

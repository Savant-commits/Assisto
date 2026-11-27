"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppToast } from "@/components/app-toast";
import { useNotifications } from "@/components/notification-bell";
import type { NotificationItem } from "@/components/use-notification-feed";

type ToastNotice = {
  id: string;
  userId: string;
  title: string;
  body: string;
};

type Baseline = { id: string | null; created_at: string | null };
const BASELINE_PREFIX = "assisto:notification-toast-baseline:";
const TOASTED_PREFIX = "assisto:notification-toasted:";

function newestFirst(items: NotificationItem[]) {
  return [...items].sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeB - timeA || b.id.localeCompare(a.id);
  });
}

function isNewer(notification: NotificationItem, baseline: Baseline): boolean {
  if (!baseline.created_at) return true;
  const time = notification.created_at ? new Date(notification.created_at).getTime() : 0;
  const baselineTime = new Date(baseline.created_at).getTime();
  return time > baselineTime || (time === baselineTime && notification.id.localeCompare(baseline.id ?? "") > 0);
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = sessionStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export function NotificationToaster() {
  const notificationContext = useNotifications();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [banStatuses, setBanStatuses] = useState<Record<string, boolean>>({});
  const [activeToast, setActiveToast] = useState<ToastNotice | null>(null);
  const [toastQueue, setToastQueue] = useState<ToastNotice[]>([]);
  const initializedUser = useRef<string | null>(null);
  const baselineRef = useRef<Baseline | null>(null);
  const toastedIds = useRef<Set<string>>(new Set());
  const currentUserId = notificationContext?.userId ?? null;
  const banStatusKnown = !currentUserId || Object.hasOwn(banStatuses, currentUserId);
  const isBanned = currentUserId ? banStatuses[currentUserId] === true : false;

  const dismiss = useCallback(() => {
    const userId = notificationContext?.userId;
    const [next, ...rest] = toastQueue.filter((notice) => notice.userId === userId);
    setActiveToast(next ?? null);
    setToastQueue(rest);
  }, [notificationContext?.userId, toastQueue]);

  useEffect(() => {
    const onBanStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ banned?: boolean; userId?: string }>).detail;
      const userId = detail?.userId ?? notificationContext?.userId ?? null;
      if (!userId || (notificationContext?.userId && detail?.userId && detail.userId !== notificationContext.userId)) return;
      setBanStatuses((statuses) => ({ ...statuses, [userId]: detail?.banned === true }));
    };
    window.addEventListener("app:ban-status", onBanStatus);
    return () => window.removeEventListener("app:ban-status", onBanStatus);
  }, [notificationContext?.userId]);

  useEffect(() => {
    const userId = notificationContext?.userId ?? null;
    if (!userId) {
      initializedUser.current = null;
      baselineRef.current = null;
      toastedIds.current = new Set();
      return;
    }
    if (!notificationContext?.loaded) return;

    const baselineKey = `${BASELINE_PREFIX}${userId}`;
    const toastedKey = `${TOASTED_PREFIX}${userId}`;
    const ordered = newestFirst(notificationContext.notifications);
    const newest = ordered[0];

    if (initializedUser.current !== userId) {
      initializedUser.current = userId;
      toastedIds.current = new Set(readJson<string[]>(toastedKey, []));
      const storedBaseline = readJson<Baseline | null>(baselineKey, null);
      if (!storedBaseline) {
        const initialBaseline = { id: newest?.id ?? null, created_at: newest?.created_at ?? null };
        baselineRef.current = initialBaseline;
        try { sessionStorage.setItem(baselineKey, JSON.stringify(initialBaseline)); } catch { /* session storage is optional */ }
        toastedIds.current = new Set(ordered.map((item) => item.id));
        if (toastedIds.current.size > 200) toastedIds.current = new Set([...toastedIds.current].slice(-200));
        try { sessionStorage.setItem(toastedKey, JSON.stringify([...toastedIds.current])); } catch { /* session storage is optional */ }
        return;
      }
      baselineRef.current = storedBaseline;
    }

    const baseline = baselineRef.current;
    if (!baseline) return;
    const newlyArrived = ordered.filter((notification) => !notification.is_read && isNewer(notification, baseline) && !toastedIds.current.has(notification.id));
    if (!banStatusKnown) return;
    const currentlyViewingMessage = (notification: NotificationItem) => {
      if (notification.type !== "project_message" || !pathname.startsWith("/messages/")) return false;
      let projectId = pathname.slice("/messages/".length);
      try { projectId = decodeURIComponent(projectId); } catch { /* keep raw route segment */ }
      return projectId === notification.related_id;
    };
    const eligible = newlyArrived.filter((notification) => !currentlyViewingMessage(notification));

    for (const notification of newlyArrived) toastedIds.current.add(notification.id);
    try { sessionStorage.setItem(toastedKey, JSON.stringify([...toastedIds.current])); } catch { /* session storage is optional */ }

    if (newest && (!baseline.created_at || isNewer(newest, baseline))) {
      baselineRef.current = { id: newest.id, created_at: newest.created_at ?? null };
      try { sessionStorage.setItem(baselineKey, JSON.stringify(baselineRef.current)); } catch { /* session storage is optional */ }
    }

    if (!eligible.length || pathname === "/" || !notificationContext.userId || !banStatusKnown || isBanned) return;

    const notices: ToastNotice[] = eligible.length > 3
      ? [{ id: eligible.map((item) => item.id).join(","), userId, title: `${eligible.length} new notifications`, body: "Tap to view your notifications." }]
      : eligible.map((item) => ({ id: item.id, userId, title: item.title, body: item.body?.trim() || "Tap to view your notifications." }));
    setActiveToast((current) => current?.userId === userId ? current : notices[0]);
    setToastQueue((queue) => {
      const current = activeToast?.userId === userId ? activeToast : null;
      const start = current ? 0 : 1;
      const additions = notices.slice(start);
      const knownIds = new Set([...(current ? [current.id] : []), ...queue.filter((item) => item.userId === userId).map((item) => item.id)]);
      return [...queue, ...additions.filter((notice) => !knownIds.has(notice.id))];
    });
  }, [activeToast, banStatusKnown, isBanned, notificationContext?.loaded, notificationContext?.notifications, notificationContext?.userId, pathname]);

  if (!currentUserId || !activeToast || activeToast.userId !== currentUserId || pathname === "/" || !banStatusKnown || isBanned) return null;

  function openNotifications() {
    setActiveToast(null);
    setToastQueue([]);
    router.push("/?notifications=open");
  }

  return (
    <AppToast position="top" duration={6000} onDismiss={dismiss} closeButton>
      <button type="button" onClick={openNotifications} className="block min-h-11 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="block font-semibold">{activeToast.title}</span>
        <span className="mt-0.5 line-clamp-1 block text-sm text-muted-foreground">{activeToast.body}</span>
      </button>
    </AppToast>
  );
}

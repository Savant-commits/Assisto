"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type NotificationItem = {
  id: string;
  title: string;
  body?: string | null;
  is_read: boolean;
  type?: string | null;
  related_id?: string | null;
  created_at?: string | null;
};

const POLL_INTERVAL_MS = 30_000;

export function useNotificationFeed() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedOnce = useRef(false);
  const requestId = useRef(0);
  const mounted = useRef(false);

  const load = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    if (!loadedOnce.current) setLoading(true);
    const supabase = createClient();
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError && isAuthSessionMissingError(userError)) {
        if (mounted.current && currentRequestId === requestId.current) {
          setUserId(null);
          setUnreadCount(0);
          setUnreadMessageCount(0);
          setNotifications([]);
        }
        return;
      }
      if (userError) throw userError;
      const uid = userData.user?.id ?? null;
      if (!uid) {
        if (mounted.current && currentRequestId === requestId.current) {
          setUserId(null);
          setUnreadCount(0);
          setUnreadMessageCount(0);
          setNotifications([]);
          loadedOnce.current = true;
          setLoading(false);
        }
        return;
      }

      const [unreadResult, messageUnreadResult, notificationResult] = await Promise.all([
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", uid).eq("is_read", false),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", uid).eq("is_read", false).eq("type", "project_message"),
        supabase.from("notifications").select("id,title,body,is_read,type,related_id,created_at").eq("recipient_id", uid).order("created_at", { ascending: false }).limit(50),
      ]);
      if (unreadResult.error || messageUnreadResult.error || notificationResult.error) {
        console.error("notification feed query failed", unreadResult.error ?? messageUnreadResult.error ?? notificationResult.error);
      }

      if (!mounted.current || currentRequestId !== requestId.current) return;
      setUserId(uid);
      setUnreadCount(unreadResult.count || 0);
      setUnreadMessageCount(messageUnreadResult.count || 0);
      setNotifications((notificationResult.data as NotificationItem[] | null) || []);
    } catch (error) {
      if (mounted.current && currentRequestId === requestId.current) console.error("notification feed load failed", error);
    } finally {
      if (mounted.current && currentRequestId === requestId.current) {
        loadedOnce.current = true;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const supabase = createClient();
    const initialLoad = window.setTimeout(() => void load(), 0);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") window.setTimeout(() => void load(), 0);
    });
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted.current = false;
      window.clearTimeout(initialLoad);
      subscription.unsubscribe();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, pathname]);

  return { unreadCount, setUnreadCount, unreadMessageCount, setUnreadMessageCount, notifications, setNotifications, userId, loading, refresh: load };
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SentDecision = {
  id: number;
  status: string;
  updated_at?: string | null;
};

export function EnquiriesNavBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (mounted) setCount(0);
        return;
      }

      const { data: providerRow } = await supabase.from("providers").select("id").eq("id", userData.user.id).maybeSingle();
      const isProvider = !!providerRow;

      let pendingReceived = 0;
      if (isProvider) {
        const { count: c } = await supabase
          .from("enquiries")
          .select("id", { count: "exact", head: true })
          .eq("provider_id", userData.user.id)
          .eq("status", "sent");
        pendingReceived = c || 0;
      }

      const now = new Date().toISOString();
      const stored = localStorage.getItem("enquiries:lastSeenSentActivity");
      if (!stored) localStorage.setItem("enquiries:lastSeenSentActivity", now);
      const lastSeen = stored || now;

      const { data: sentDecisions } = await supabase
        .from("enquiries")
        .select("id,status,updated_at")
        .eq("customer_id", userData.user.id)
        .in("status", ["accepted", "declined"]);

      const unseenDecisions = (sentDecisions as SentDecision[] | null | undefined || []).filter(
        (e) => e.updated_at && e.updated_at > lastSeen
      ).length;

      if (mounted) setCount(pendingReceived + unseenDecisions);
    }

    load();

    function onVisible() {
      if (document.visibilityState === "visible") {
        load();
      }
    }

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (count === 0) return null;

  return (
    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-semibold text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

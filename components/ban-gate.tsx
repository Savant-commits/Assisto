"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BanDuration } from "@/lib/types";

type ActiveBan = {
  id: string;
  duration: BanDuration;
  banned_until: string | null;
  reason: string;
};

function formatDateTime(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function BanGate() {
  const [activeBan, setActiveBan] = useState<ActiveBan | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  if (!supabaseRef.current) {
    supabaseRef.current = createClient();
  }

  useEffect(() => {
    const supabase = supabaseRef.current;
    if (!supabase) return;

    async function checkBan() {
      try {
        const { data, error } = await supabase.rpc("my_active_ban");
        if (error) return;
        setActiveBan((data as ActiveBan | null) ?? null);
      } catch {
        // Ignore failed checks so a temporary outage never trips the lock screen.
      }
    }

    void checkBan();

    const timer = window.setInterval(() => {
      void checkBan();
    }, 15000);

    function onVisible() {
      if (document.visibilityState === "visible") {
        void checkBan();
      }
    }

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [activeBan, signingOut]);

  useEffect(() => {
    if (!activeBan) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeBan]);

  if (!activeBan) return null;

  const endDate = activeBan.banned_until ? formatDateTime(activeBan.banned_until) : "";
  const periodText =
    activeBan.duration === "permanent"
      ? "This suspension is permanent."
      : activeBan.duration === "1_week"
        ? `Suspended for 1 week (until ${endDate}).`
        : `Suspended for 1 year (until ${endDate}).`;

  async function handleOk() {
    setSigningOut(true);

    try {
      await supabaseRef.current?.auth.signOut({ scope: "global" });
    } catch {
      // Ignore auth sign-out failures and still redirect to the login page.
    }

    window.location.href = "/login";
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 text-left shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ban-gate-title"
      >
        <h2 id="ban-gate-title" className="mb-3 text-xl font-semibold text-gray-900">
          Your account has been suspended
        </h2>

        <div className="space-y-3 text-sm text-gray-700">
          <p>{periodText}</p>
          <p>Reason: {activeBan.reason}</p>
          <p>If you think this is a mistake, please contact support.</p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => void handleOk()}
            disabled={signingOut}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {signingOut ? "Signing out..." : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const ADMIN_ROUTE = "/admin/applications";

export default function AdminLink() {
  const pathname = usePathname() ?? "";
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    let requestId = 0;
    const supabase = createClient();

    async function checkAdmin(userId: string | null, currentRequestId: number) {
      if (!mounted || currentRequestId !== requestId) return;
      if (!userId) {
        setIsAdmin(false);
        return;
      }

      setIsAdmin(null);
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (!mounted || currentRequestId !== requestId) return;
      setIsAdmin(!error && profile?.role === "admin");
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id ?? null;
      const currentRequestId = ++requestId;
      setIsAdmin(null);
      window.setTimeout(() => {
        if (mounted) void checkAdmin(userId, currentRequestId);
      }, 0);
    });

    return () => {
      mounted = false;
      requestId++;
      subscription.unsubscribe();
    };
  }, []);

  if (isAdmin !== true) return null;

  const active = pathname.startsWith(ADMIN_ROUTE);

  return (
    <Link
      href={ADMIN_ROUTE}
      aria-label="Admin"
      title="Admin actions"
      aria-current={active ? "page" : undefined}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${active ? "bg-accent text-primary" : "text-foreground hover:bg-muted"}`}
    >
      <LockKeyhole aria-hidden="true" className="size-5" />
    </Link>
  );
}
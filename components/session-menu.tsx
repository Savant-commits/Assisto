"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SessionMenu({ userId, fullName }: { userId?: string | null; fullName?: string | null }) {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setEmail(data?.user?.email || null);
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // reload to clear server components relying on cookies
    window.location.href = "/";
  }

  if (loading) return <div className="w-8 h-8 rounded-full bg-gray-200" />;

  if (!email) {
    return (
      <Link href="/login" className="rounded-full border px-3 py-1">
        Log in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-sm text-muted-foreground">{fullName || email}</div>
      <Link href="/profile" className="rounded-full border px-3 py-1">
        Profile
      </Link>
      <button onClick={signOut} className="rounded-full border px-3 py-1">
        Sign out
      </button>
    </div>
  );
}

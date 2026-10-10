"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SessionMenu({ fullName, avatarUrl }: { fullName?: string | null; avatarUrl?: string | null }) {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const avatar = avatarUrl || null;

  useEffect(() => {
    let mounted = true;
    async function load() {
      const supabase = createClient();
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error("session menu auth lookup failed", {
          message: userError.message,
          details: "details" in userError ? userError.details : undefined,
          hint: "hint" in userError ? userError.hint : undefined,
          code: userError.code,
        });
      }
      if (!mounted) return;
      setEmail(data?.user?.email || null);

      if (data?.user?.id) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();
        if (profileError) {
          console.error("session menu profile lookup failed", {
            message: profileError.message,
            details: profileError.details,
            hint: profileError.hint,
            code: profileError.code,
          });
        }

        if (mounted) {
          setIsAdmin(profile?.role === "admin");
        }
      }

      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function signOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("session menu sign-out failed", {
        message: error.message,
        details: "details" in error ? error.details : undefined,
        hint: "hint" in error ? error.hint : undefined,
        code: error.code,
      });
    }
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
      <div className="flex items-center gap-2">
        {avatar && (
          <img
            src={avatar}
            alt="Avatar"
            className="h-6 w-6 rounded-full object-cover"
          />
        )}
        <div className="text-sm text-muted-foreground hidden sm:block">{fullName || email}</div>
      </div>
      {isAdmin && (
        <Link href="/admin/applications" className="rounded-full border px-3 py-1 bg-amber-50 text-amber-700 border-amber-200">
          Admin
        </Link>
      )}
      <Link href="/profile" className="rounded-full border px-3 py-1">
        Profile
      </Link>
      <button onClick={signOut} className="rounded-full border px-3 py-1">
        Sign out
      </button>
    </div>
  );
}

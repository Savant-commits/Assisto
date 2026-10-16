"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function ContactUnlock({
  profileId,
  showUnavailable = false,
}: {
  profileId: string;
  showUnavailable?: boolean;
}) {
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("get_profile_phone", { profile_id: profileId });
        if (mounted) {
          if (error) {
            setLoadError(true);
          } else {
            setPhone(data || null);
          }
        }
      } catch {
        if (mounted) setLoadError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [profileId]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading contact…</div>;
  if (loadError) return <div className="text-sm text-muted-foreground">Couldn&apos;t load contact details. Please refresh.</div>;
  if (!phone && showUnavailable) {
    return <div className="text-sm text-muted-foreground">Phone number isn&apos;t available yet. They haven&apos;t verified their number.</div>;
  }
  if (!phone) return null;

  const digits = normalizePhone(phone);

  return (
    <div className="mt-2 flex items-center gap-3">
      <a href={`tel:+${digits}`} className="rounded-md bg-green-600 px-3 py-1 text-sm text-white">Call</a>
      <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="rounded-md bg-emerald-500 px-3 py-1 text-sm text-white">WhatsApp</a>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import LoadingSpinner from "@/components/loading-spinner";
import { ContactUnlock } from "@/components/contact-unlock";

type Enquiry = {
  id: number;
  message: string | null;
  status: string;
  created_at: string | null;
  providers?: { id: string; business_name?: string | null } | null;
  customer_requirements?: { description: string | null } | null;
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function MyEnquiriesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [pendingMap, setPendingMap] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string | null>>({});

  useEffect(() => {
    let mounted = true;
    async function load() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push(`/login?redirect=/my-enquiries`);
        return;
      }

      const { data, error } = await supabase
        .from("enquiries")
        .select(`id,message,status,created_at,providers(id,business_name),customer_requirements(description)`)
        .eq("customer_id", userData.user.id)
        .order("created_at", { ascending: false });

      if (!mounted) return;
      if (error) {
        setEnquiries([]);
      } else {
        setEnquiries((data as any) || []);
      }
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  function setPending(id: number, v: boolean) {
    setPendingMap((s) => ({ ...s, [id]: v }));
  }

  function setCardError(id: number, msg: string | null) {
    setErrors((s) => ({ ...s, [id]: msg }));
  }

  async function updateStatus(id: number, status: string) {
    setPending(id, true);
    setCardError(id, null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("enquiries").update({ status }).eq("id", id);
      if (error) throw error;
      setEnquiries((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    } catch (err: any) {
      setCardError(id, err?.message || "Update failed");
    } finally {
      setPending(id, false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size={10} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-semibold">Past assists</h1>
        <p className="text-muted-foreground">Your previous enquiries and their status.</p>
      </div>

      {enquiries.length === 0 ? (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-muted-foreground">You haven't sent any enquiries yet.</p>
          <div className="mt-4">
            <Link href="/discover" className="text-sm text-blue-600 underline">
              Discover providers
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {enquiries.map((enq) => (
            <div key={enq.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">
                    <Link href={`/providers/${enq.providers?.id ?? ""}`} className="font-medium text-blue-600 underline">
                      {enq.providers?.business_name || "Provider"}
                    </Link>
                  </div>
                  {enq.customer_requirements?.description && (
                    <div className="mt-1 text-sm text-muted-foreground">Regarding: {enq.customer_requirements.description}</div>
                  )}
                </div>
                <div>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                    enq.status === "accepted" || enq.status === "confirmed"
                      ? "bg-green-100 text-green-800"
                      : enq.status === "declined" || enq.status === "cancelled"
                      ? "bg-red-100 text-red-800"
                      : enq.status === "completed"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
                  }`}>{enq.status}</span>
                </div>
              </div>

              <div className="mt-3 text-sm text-muted-foreground">{enq.message}</div>

              <div className="mt-3 text-xs text-muted-foreground">{formatDate(enq.created_at)}</div>

              {enq.status === "accepted" && (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => updateStatus(enq.id, "confirmed")}
                    disabled={!!pendingMap[enq.id]}
                    className="rounded-md bg-green-600 px-3 py-1 text-sm text-white disabled:opacity-60"
                  >
                    {pendingMap[enq.id] ? "Confirming…" : "Confirm"}
                  </button>
                </div>
              )}

              {(enq.status === "confirmed" || enq.status === "completed") && (
                <ContactUnlock profileId={enq.providers?.id ?? ""} />
              )}

              {errors[enq.id] && <p className="mt-2 text-sm text-destructive">{errors[enq.id]}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

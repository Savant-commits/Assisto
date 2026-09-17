"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import LoadingSpinner from "@/components/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { ContactUnlock } from "@/components/contact-unlock";

type Enquiry = {
  id: number;
  message: string | null;
  status: string;
  created_at: string | null;
  customer_id: string;
  profiles?: { full_name: string | null } | null;
  customer_requirements?: { description: string | null } | null;
};

export default function EnquiriesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [tab, setTab] = useState<"new" | "history">("new");
  const [pendingMap, setPendingMap] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string | null>>({});

  useEffect(() => {
    let mounted = true;
    async function load() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push(`/login?redirect=/profile/enquiries`);
        return;
      }

      const { data: provider } = await supabase.from("providers").select("id").eq("id", userData.user.id).single();
      if (!provider) {
        router.push(`/apply`);
        return;
      }

      const { data, error } = await supabase
        .from("enquiries")
        .select(
          `id,message,status,created_at,customer_id,profiles(full_name),customer_requirements(description)`
        )
        .eq("provider_id", userData.user.id)
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size={10} />
      </div>
    );
  }

  const newCount = enquiries.filter((e) => e.status === "sent").length;

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

  const shown = tab === "new" ? enquiries.filter((e) => e.status === "sent") : enquiries.filter((e) => e.status !== "sent");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-semibold">Enquiries</h1>
        <p className="text-muted-foreground">See who reached out and respond to new enquiries.</p>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => setTab("new")}
          className={`rounded-md px-3 py-1 text-sm font-medium ${tab === "new" ? "bg-blue-600 text-white" : "bg-muted"}`}
        >
          New <span className="ml-2">{"(" + newCount + ")"}</span>
        </button>
        <button
          onClick={() => setTab("history")}
          className={`rounded-md px-3 py-1 text-sm font-medium ${tab === "history" ? "bg-blue-600 text-white" : "bg-muted"}`}
        >
          History
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          {tab === "new" ? "No new enquiries yet" : "No enquiry history yet"}
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((enq) => (
            <div key={enq.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{enq.profiles?.full_name || "Anonymous"}</div>
                  {enq.customer_requirements?.description && (
                    <div className="mt-1 text-sm text-muted-foreground">Regarding: {enq.customer_requirements.description}</div>
                  )}
                </div>
                <div>
                  {tab === "history" ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        enq.status === "accepted" || enq.status === "confirmed"
                          ? "bg-green-100 text-green-800"
                          : enq.status === "declined" || enq.status === "cancelled"
                          ? "bg-red-100 text-red-800"
                          : enq.status === "completed"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {enq.status}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 text-sm text-muted-foreground">{enq.message}</div>

              {tab === "new" && (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => updateStatus(enq.id, "accepted")}
                    disabled={!!pendingMap[enq.id]}
                    className="rounded-md bg-green-600 px-3 py-1 text-sm text-white disabled:opacity-60"
                  >
                    {pendingMap[enq.id] ? "Accepting…" : "Accept"}
                  </button>
                  <button
                    onClick={() => updateStatus(enq.id, "declined")}
                    disabled={!!pendingMap[enq.id]}
                    className="rounded-md bg-gray-200 px-3 py-1 text-sm text-gray-800 disabled:opacity-60"
                  >
                    {pendingMap[enq.id] ? "Declining…" : "Decline"}
                  </button>
                </div>
              )}

              {tab === "history" && (enq.status === "confirmed" || enq.status === "completed") && (
                <ContactUnlock profileId={enq.customer_id} />
              )}

              {errors[enq.id] && <p className="mt-2 text-sm text-destructive">{errors[enq.id]}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Link href="/profile" className="text-sm text-blue-600 underline">
          Back to profile
        </Link>
      </div>
    </div>
  );
}

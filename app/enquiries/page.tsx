"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import LoadingSpinner from "@/components/loading-spinner";
import { ContactUnlock } from "@/components/contact-unlock";
import { CompletionActions } from "@/components/completion-actions";

type SentEnquiry = {
  id: number;
  message: string | null;
  status: string;
  created_at: string | null;
  customer_completed_at: string | null;
  provider_completed_at: string | null;
  providers?: { id: string; business_name?: string | null } | null;
  customer_requirements?: { description: string | null } | null;
};

type ReceivedEnquiry = {
  id: number;
  message: string | null;
  status: string;
  created_at: string | null;
  customer_id: string;
  customer_completed_at: string | null;
  provider_completed_at: string | null;
  profiles?: { full_name: string | null } | null;
  customer_requirements?: { description: string | null } | null;
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function statusBadge(status: string) {
  const cls =
    status === "accepted" || status === "confirmed"
      ? "bg-green-100 text-green-800"
      : status === "declined" || status === "cancelled"
      ? "bg-red-100 text-red-800"
      : status === "completed"
      ? "bg-blue-100 text-blue-800"
      : "bg-gray-100 text-gray-800";
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${cls}`}>{status}</span>;
}

export default function EnquiriesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isProvider, setIsProvider] = useState(false);
  const [view, setView] = useState<"sent" | "received">("sent");
  const [sentTab, setSentTab] = useState<"pending" | "active" | "history">("pending");
  const [receivedTab, setReceivedTab] = useState<"pending" | "active" | "history">("pending");
  const [sent, setSent] = useState<SentEnquiry[]>([]);
  const [received, setReceived] = useState<ReceivedEnquiry[]>([]);
  const [pendingMap, setPendingMap] = useState<Record<string, boolean>>({});
  const [confirmingWithdraw, setConfirmingWithdraw] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push(`/login?redirect=/enquiries`);
      return;
    }

    const { data: providerRow } = await supabase.from("providers").select("id").eq("id", userData.user.id).single();
    const amProvider = !!providerRow;

    const { data: sentData } = await supabase
      .from("enquiries")
      .select(
        `id,message,status,created_at,customer_completed_at,provider_completed_at,providers(id,business_name),customer_requirements(description)`
      )
      .eq("customer_id", userData.user.id)
      .order("created_at", { ascending: false });

    let receivedData: any[] = [];
    if (amProvider) {
      const { data } = await supabase
        .from("enquiries")
        .select(
          `id,message,status,created_at,customer_id,customer_completed_at,provider_completed_at,profiles(full_name),customer_requirements(description)`
        )
        .eq("provider_id", userData.user.id)
        .order("created_at", { ascending: false });
      receivedData = data || [];
    }

    if (!mountedRef.current) return;
    setIsProvider(amProvider);
    setSent((sentData as any) || []);
    setReceived(receivedData as any);
    setView(amProvider ? "received" : "sent");
    setLoading(false);
  }, [router]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        load();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [load]);

  function setPending(key: string, v: boolean) {
    setPendingMap((s) => ({ ...s, [key]: v }));
  }
  function setCardError(key: string, msg: string | null) {
    setErrors((s) => ({ ...s, [key]: msg }));
  }

  async function updateSentStatus(id: number, status: string) {
    const key = `sent-${id}`;
    setPending(key, true);
    setCardError(key, null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("enquiries").update({ status }).eq("id", id);
      if (error) throw error;
      setSent((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    } catch (err: any) {
      setCardError(key, err?.message || "Update failed");
    } finally {
      setPending(key, false);
    }
  }

  async function updateReceivedStatus(id: number, status: string) {
    const key = `received-${id}`;
    setPending(key, true);
    setCardError(key, null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("enquiries").update({ status }).eq("id", id);
      if (error) throw error;
      setReceived((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    } catch (err: any) {
      setCardError(key, err?.message || "Update failed");
    } finally {
      setPending(key, false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size={10} />
      </div>
    );
  }

  const bucket = (list: { status: string }[], t: "pending" | "active" | "history") =>
    t === "pending"
      ? list.filter((e) => e.status === "sent")
      : t === "active"
      ? list.filter((e) => e.status === "accepted" || e.status === "confirmed")
      : list.filter((e) => ["completed", "declined", "cancelled"].includes(e.status));

  const sentPendingCount = bucket(sent, "pending").length;
  const sentActiveCount = bucket(sent, "active").length;
  const receivedPendingCount = bucket(received, "pending").length;
  const receivedActiveCount = bucket(received, "active").length;

  const activeTab = view === "sent" ? sentTab : receivedTab;
  const setActiveTab = view === "sent" ? setSentTab : setReceivedTab;
  const pendingCount = view === "sent" ? sentPendingCount : receivedPendingCount;
  const activeCount = view === "sent" ? sentActiveCount : receivedActiveCount;
  const pendingLabel = view === "sent" ? "Sent" : "New";

  const shownSent = view === "sent" ? bucket(sent, sentTab) : [];
  const shownReceived = view === "received" ? bucket(received, receivedTab) : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-semibold">Enquiries</h1>
        <p className="text-muted-foreground">Track what you've sent and, if you're a provider, what you've received.</p>
      </div>

      {isProvider && (
        <div className="mb-6 flex items-center gap-2">
          <button
            onClick={() => setView("received")}
            className={`rounded-md px-3 py-1 text-sm font-medium ${view === "received" ? "bg-black text-white" : "bg-muted"}`}
          >
            Received
          </button>
          <button
            onClick={() => setView("sent")}
            className={`rounded-md px-3 py-1 text-sm font-medium ${view === "sent" ? "bg-black text-white" : "bg-muted"}`}
          >
            Sent by me
          </button>
        </div>
      )}

      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => setActiveTab("pending")}
          className={`rounded-md px-3 py-1 text-sm font-medium ${activeTab === "pending" ? "bg-blue-600 text-white" : "bg-muted"}`}
        >
          {pendingLabel} <span className="ml-2">{"(" + pendingCount + ")"}</span>
        </button>
        <button
          onClick={() => setActiveTab("active")}
          className={`rounded-md px-3 py-1 text-sm font-medium ${activeTab === "active" ? "bg-blue-600 text-white" : "bg-muted"}`}
        >
          Active <span className="ml-2">{"(" + activeCount + ")"}</span>
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`rounded-md px-3 py-1 text-sm font-medium ${activeTab === "history" ? "bg-blue-600 text-white" : "bg-muted"}`}
        >
          History
        </button>
      </div>

      {view === "sent" ? (
        shownSent.length === 0 ? (
          <div className="rounded-lg border p-6 text-center">
            <p className="text-muted-foreground">
              {sentTab === "pending" ? "You haven't sent any enquiries yet." : sentTab === "active" ? "No active work right now." : "No history yet."}
            </p>
            {sentTab === "pending" && (
              <div className="mt-4">
                <Link href="/discover" className="text-sm text-blue-600 underline">
                  Discover providers
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {shownSent.map((enq) => {
              const key = `sent-${enq.id}`;
              return (
                <div key={enq.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link href={`/providers/${enq.providers?.id ?? ""}`} className="font-medium text-blue-600 underline">
                        {enq.providers?.business_name || "Provider"}
                      </Link>
                      {enq.customer_requirements?.description && (
                        <div className="mt-1 text-sm text-muted-foreground">Regarding: {enq.customer_requirements.description}</div>
                      )}
                    </div>
                    <div>{statusBadge(enq.status)}</div>
                  </div>

                  <div className="mt-3 text-sm text-muted-foreground">{enq.message}</div>
                  <div className="mt-3 text-xs text-muted-foreground">{formatDate(enq.created_at)}</div>

                  {sentTab === "pending" && enq.status === "sent" && (
                    <div className="mt-4">
                      {confirmingWithdraw[enq.id] ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Withdraw this enquiry?</span>
                          <button
                            onClick={() => {
                              setConfirmingWithdraw((s) => ({ ...s, [enq.id]: false }));
                              updateSentStatus(enq.id, "cancelled");
                            }}
                            disabled={!!pendingMap[key]}
                            className="rounded-md bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-60"
                          >
                            {pendingMap[key] ? "Withdrawing…" : "Yes, withdraw"}
                          </button>
                          <button
                            onClick={() => setConfirmingWithdraw((s) => ({ ...s, [enq.id]: false }))}
                            className="rounded-md bg-gray-200 px-3 py-1 text-sm text-gray-800"
                          >
                            Never mind
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingWithdraw((s) => ({ ...s, [enq.id]: true }))}
                          className="rounded-md bg-gray-200 px-3 py-1 text-sm text-gray-800"
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  )}

                  {sentTab === "active" && enq.status === "accepted" && (
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={() => updateSentStatus(enq.id, "confirmed")}
                        disabled={!!pendingMap[key]}
                        className="rounded-md bg-green-600 px-3 py-1 text-sm text-white disabled:opacity-60"
                      >
                        {pendingMap[key] ? "Confirming…" : "Confirm"}
                      </button>
                      <button
                        onClick={() => updateSentStatus(enq.id, "cancelled")}
                        disabled={!!pendingMap[key]}
                        className="rounded-md bg-gray-200 px-3 py-1 text-sm text-gray-800 disabled:opacity-60"
                      >
                        {pendingMap[key] ? "Cancelling…" : "Cancel"}
                      </button>
                    </div>
                  )}

                  {sentTab === "active" && enq.status === "confirmed" && (
                    <>
                      <ContactUnlock profileId={enq.providers?.id ?? ""} />
                      <CompletionActions
                        enquiryId={enq.id}
                        role="customer"
                        customerCompletedAt={enq.customer_completed_at}
                        providerCompletedAt={enq.provider_completed_at}
                        onUpdated={(patch) => setSent((prev) => prev.map((p) => (p.id === enq.id ? { ...p, ...patch } : p)))}
                      />
                    </>
                  )}

                  {sentTab === "history" && enq.status === "completed" && null}

                  {errors[key] && <p className="mt-2 text-sm text-destructive">{errors[key]}</p>}
                </div>
              );
            })}
          </div>
        )
      ) : shownReceived.length === 0 ? (
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          {receivedTab === "pending" ? "No new enquiries yet" : receivedTab === "active" ? "No active work right now" : "No history yet"}
        </div>
      ) : (
        <div className="space-y-4">
          {shownReceived.map((enq) => {
            const key = `received-${enq.id}`;
            return (
              <div key={enq.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{enq.profiles?.full_name || "Anonymous"}</div>
                    {enq.customer_requirements?.description && (
                      <div className="mt-1 text-sm text-muted-foreground">Regarding: {enq.customer_requirements.description}</div>
                    )}
                  </div>
                  <div>{receivedTab === "history" && statusBadge(enq.status)}</div>
                </div>

                <div className="mt-3 text-sm text-muted-foreground">{enq.message}</div>

                {receivedTab === "pending" && (
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => updateReceivedStatus(enq.id, "accepted")}
                      disabled={!!pendingMap[key]}
                      className="rounded-md bg-green-600 px-3 py-1 text-sm text-white disabled:opacity-60"
                    >
                      {pendingMap[key] ? "Accepting…" : "Accept"}
                    </button>
                    <button
                      onClick={() => updateReceivedStatus(enq.id, "declined")}
                      disabled={!!pendingMap[key]}
                      className="rounded-md bg-gray-200 px-3 py-1 text-sm text-gray-800 disabled:opacity-60"
                    >
                      {pendingMap[key] ? "Declining…" : "Decline"}
                    </button>
                  </div>
                )}

                {receivedTab === "active" && enq.status === "accepted" && (
                  <p className="mt-3 text-sm text-muted-foreground">Waiting for the customer to confirm.</p>
                )}

                {receivedTab === "active" && enq.status === "confirmed" && (
                  <>
                    <ContactUnlock profileId={enq.customer_id} />
                    <CompletionActions
                      enquiryId={enq.id}
                      role="provider"
                      customerCompletedAt={enq.customer_completed_at}
                      providerCompletedAt={enq.provider_completed_at}
                      onUpdated={(patch) => setReceived((prev) => prev.map((p) => (p.id === enq.id ? { ...p, ...patch } : p)))}
                    />
                  </>
                )}

                {receivedTab === "history" && enq.status === "completed" && null}

                {errors[key] && <p className="mt-2 text-sm text-destructive">{errors[key]}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

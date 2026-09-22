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
  updated_at: string | null;
  decline_reason?: string | null;
  is_asap?: boolean | null;
  scheduled_start_at?: string | null;
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
  updated_at: string | null;
  decline_reason?: string | null;
  is_asap?: boolean | null;
  scheduled_start_at?: string | null;
  customer_id: string;
  customer_completed_at: string | null;
  provider_completed_at: string | null;
  profiles?: { full_name: string | null } | null;
  customer_requirements?: { description: string | null } | null;
};

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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
  const [lastSeenHistory, setLastSeenHistory] = useState<{ sent: string; received: string }>({ sent: "", received: "" });
  const [historyFilter, setHistoryFilter] = useState<"all" | "completed" | "declined" | "cancelled">("all");
  const [pendingMap, setPendingMap] = useState<Record<string, boolean>>({});
  const [confirmingWithdraw, setConfirmingWithdraw] = useState<Record<number, boolean>>({});
  const [confirmingDecline, setConfirmingDecline] = useState<Record<number, { open: boolean; reason: string }>>({});
  const [confirmingSchedule, setConfirmingSchedule] = useState<Record<number, { mode: "now" | "specific" | null; scheduledStartAt: string }>>({});
  const [minFutureDateTime] = useState(() => new Date(Date.now() + 60000).toISOString().slice(0, 16));
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push(`/login?redirect=/enquiries`);
      return;
    }

    const { data: providerRow } = await supabase.from("providers").select("id").eq("id", userData.user.id).maybeSingle();
    const amProvider = !!providerRow;

    const { data: sentData } = await supabase
      .from("enquiries")
      .select(
        `id,message,status,created_at,updated_at,decline_reason,is_asap,scheduled_start_at,customer_completed_at,provider_completed_at,providers(id,business_name),customer_requirements(description)`
      )
      .eq("customer_id", userData.user.id)
      .order("created_at", { ascending: false });

    let receivedData: ReceivedEnquiry[] = [];
    if (amProvider) {
        const { data, error } = await supabase
          .from("enquiries")
          .select(
            `id,message,status,created_at,updated_at,decline_reason,is_asap,scheduled_start_at,customer_id,customer_completed_at,provider_completed_at,profiles!enquiries_customer_id_fkey(full_name),customer_requirements(description)`
          )
          .eq("provider_id", userData.user.id)
          .order("created_at", { ascending: false });

        if (error) console.error("enquiries query failed:", error);
      receivedData = (data as ReceivedEnquiry[]) || [];
      receivedData = receivedData.filter((e: ReceivedEnquiry) => {
        if (e.status !== "cancelled" || !e.created_at || !e.updated_at) return true;
        const heldForMs = new Date(e.updated_at).getTime() - new Date(e.created_at).getTime();
        return heldForMs > 2 * 60 * 1000;
      });
    }

    if (!mountedRef.current) return;
    setIsProvider(amProvider);
    localStorage.setItem("enquiries:lastSeenSentActivity", new Date().toISOString());
    const now = new Date().toISOString();
    const storedSent = localStorage.getItem("enquiries:lastSeenHistory:sent");
    const storedReceived = localStorage.getItem("enquiries:lastSeenHistory:received");
    if (!storedSent) localStorage.setItem("enquiries:lastSeenHistory:sent", now);
    if (!storedReceived) localStorage.setItem("enquiries:lastSeenHistory:received", now);
    setLastSeenHistory({
      sent: storedSent || now,
      received: storedReceived || now,
    });
    setSent((sentData as SentEnquiry[]) || []);
    setReceived(receivedData);
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
    } catch (err: unknown) {
      setCardError(key, err instanceof Error ? err.message : "Update failed");
    } finally {
      setPending(key, false);
    }
  }

  async function updateReceivedStatus(id: number, status: string, declineReason?: string | null) {
    const key = `received-${id}`;
    setPending(key, true);
    setCardError(key, null);
    try {
      const supabase = createClient();
      const nextReason = status === "declined" ? (declineReason?.trim() || null) : null;
      const { error } = await supabase.from("enquiries").update({ status, decline_reason: nextReason }).eq("id", id);
      if (error) throw error;
      setReceived((prev) => prev.map((p) => (p.id === id ? { ...p, status, decline_reason: status === "declined" ? nextReason : p.decline_reason } : p)));
    } catch (err: unknown) {
      setCardError(key, err instanceof Error ? err.message : "Update failed");
    } finally {
      setPending(key, false);
    }
  }

  async function confirmAcceptedEnquiry(id: number, schedule: { isAsap: boolean; scheduledStartAt: string | null }) {
    const key = `sent-${id}`;
    setPending(key, true);
    setCardError(key, null);
    try {
      const supabase = createClient();
      const payload = {
        status: "confirmed",
        is_asap: schedule.isAsap,
        scheduled_start_at: schedule.isAsap ? null : schedule.scheduledStartAt,
      };
      const { error } = await supabase.from("enquiries").update(payload).eq("id", id);
      if (error) throw error;
      setSent((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                status: "confirmed",
                is_asap: schedule.isAsap,
                scheduled_start_at: schedule.isAsap ? null : schedule.scheduledStartAt,
              }
            : p
        )
      );
      setConfirmingSchedule((s) => ({ ...s, [id]: { mode: null, scheduledStartAt: "" } }));
    } catch (err: unknown) {
      setCardError(key, err instanceof Error ? err.message : "Update failed");
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

  function scheduleLine(enq: { is_asap?: boolean | null; scheduled_start_at?: string | null }) {
    if (enq.is_asap) return "Scheduled: Now (ASAP)";
    if (enq.scheduled_start_at) return `Scheduled: ${formatDateTime(enq.scheduled_start_at)}`;
    return null;
  }

  function unseenHistoryCount(list: { status: string; updated_at?: string | null; created_at: string | null }[], lastSeen: string) {
    return list.filter(
      (e) => ["completed", "declined", "cancelled"].includes(e.status) && e.updated_at && e.updated_at > lastSeen
    ).length;
  }

  const bucket = (list: { status: string }[], t: "pending" | "active" | "history") =>
    t === "pending"
      ? list.filter((e) => e.status === "sent")
      : t === "active"
      ? list.filter((e) => e.status === "accepted" || e.status === "confirmed")
      : list.filter((e) => ["completed", "declined", "cancelled"].includes(e.status) && (historyFilter === "all" || e.status === historyFilter));

  const sentPendingCount = bucket(sent, "pending").length;
  const sentActiveCount = bucket(sent, "active").length;
  const receivedPendingCount = bucket(received, "pending").length;
  const receivedActiveCount = bucket(received, "active").length;
  const sentHistoryUnseen = unseenHistoryCount(sent, lastSeenHistory.sent);
  const receivedHistoryUnseen = unseenHistoryCount(received, lastSeenHistory.received);
  const historyUnseen = view === "sent" ? sentHistoryUnseen : receivedHistoryUnseen;

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
        <p className="text-muted-foreground">Track what you have sent and, if you are a provider, what you have received.</p>
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
          className={`relative rounded-md px-3 py-1 text-sm font-medium ${activeTab === "history" ? "bg-blue-600 text-white" : "bg-muted"}`}
        >
          History
          {historyUnseen > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-semibold text-white">
              {historyUnseen > 9 ? "9+" : historyUnseen}
            </span>
          )}
        </button>
        {activeTab === "history" && historyUnseen > 0 && (
          <button
            onClick={() => {
              const now = new Date().toISOString();
              localStorage.setItem(`enquiries:lastSeenHistory:${view}`, now);
              setLastSeenHistory((s) => ({ ...s, [view]: now }));
            }}
            className="ml-auto rounded-md bg-gray-200 px-3 py-1 text-sm text-gray-800"
          >
            Alright, got it
          </button>
        )}
      </div>

      {activeTab === "history" && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          {(["all", "completed", "declined", "cancelled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setHistoryFilter(f)}
              className={`rounded-full px-3 py-1 ${historyFilter === f ? "bg-black text-white" : "bg-muted"}`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      )}

      {view === "sent" ? (
        shownSent.length === 0 ? (
          <div className="rounded-lg border p-6 text-center">
            <p className="text-muted-foreground">
              {sentTab === "pending" ? "You have not sent any enquiries yet." : sentTab === "active" ? "No active work right now." : "No history yet."}
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
                  <div className="mt-3 text-xs text-muted-foreground">
                    Sent {formatDateTime(enq.created_at)}
                    {sentTab === "history" && enq.updated_at && (
                      <> · {enq.status === "completed" ? "Completed" : enq.status === "declined" ? "Declined" : "Cancelled"} {formatDateTime(enq.updated_at)}</>
                    )}
                  </div>
                  {sentTab === "history" && enq.status === "declined" && enq.decline_reason && (
                    <div className="mt-2 text-sm text-muted-foreground">Reason: {enq.decline_reason}</div>
                  )}
                  {scheduleLine(enq) && <div className="mt-2 text-sm text-muted-foreground">{scheduleLine(enq)}</div>}

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
                    <div className="mt-4 space-y-3">
                      {confirmingSchedule[enq.id]?.mode !== undefined ? (
                        <div className="flex flex-col gap-2 rounded-md border border-muted p-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmingSchedule((s) => ({ ...s, [enq.id]: { mode: "now", scheduledStartAt: "" } }))}
                              className={`rounded-md px-3 py-1 text-sm ${confirmingSchedule[enq.id]?.mode === "now" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800"}`}
                            >
                              Now
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingSchedule((s) => ({ ...s, [enq.id]: { mode: "specific", scheduledStartAt: confirmingSchedule[enq.id]?.scheduledStartAt || "" } }))}
                              className={`rounded-md px-3 py-1 text-sm ${confirmingSchedule[enq.id]?.mode === "specific" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800"}`}
                            >
                              Specific date & time
                            </button>
                          </div>

                          {confirmingSchedule[enq.id]?.mode === "specific" && (
                            <input
                              type="datetime-local"
                              min={minFutureDateTime}
                              value={confirmingSchedule[enq.id]?.scheduledStartAt || ""}
                              onChange={(e) =>
                                setConfirmingSchedule((s) => ({
                                  ...s,
                                  [enq.id]: { mode: "specific", scheduledStartAt: e.target.value },
                                }))
                              }
                              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                            />
                          )}

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const chosen = confirmingSchedule[enq.id];
                                if (!chosen || (!chosen.scheduledStartAt && chosen.mode !== "now")) return;
                                if (chosen.mode === "now") {
                                  confirmAcceptedEnquiry(enq.id, { isAsap: true, scheduledStartAt: null });
                                } else if (chosen.mode === "specific" && chosen.scheduledStartAt) {
                                  confirmAcceptedEnquiry(enq.id, { isAsap: false, scheduledStartAt: new Date(chosen.scheduledStartAt).toISOString() });
                                }
                              }}
                              disabled={
                                !!pendingMap[key] ||
                                !confirmingSchedule[enq.id]?.mode ||
                                (confirmingSchedule[enq.id]?.mode === "specific" && !confirmingSchedule[enq.id]?.scheduledStartAt)
                              }
                              className="rounded-md bg-green-600 px-3 py-1 text-sm text-white disabled:opacity-60"
                            >
                              {pendingMap[key] ? "Confirming…" : "Confirm"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmingSchedule((s) => ({ ...s, [enq.id]: { mode: null, scheduledStartAt: "" } }));
                              }}
                              className="rounded-md bg-gray-200 px-3 py-1 text-sm text-gray-800"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setConfirmingSchedule((s) => ({ ...s, [enq.id]: { mode: null, scheduledStartAt: "" } }))}
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
                <div className="mt-3 text-xs text-muted-foreground">
                  Sent {formatDateTime(enq.created_at)}
                  {receivedTab === "history" && enq.updated_at && (
                    <> · {enq.status === "completed" ? "Completed" : enq.status === "declined" ? "Declined" : "Cancelled"} {formatDateTime(enq.updated_at)}</>
                  )}
                </div>
                {receivedTab === "history" && enq.status === "declined" && enq.decline_reason && (
                  <div className="mt-2 text-sm text-muted-foreground">Reason: {enq.decline_reason}</div>
                )}
                {scheduleLine(enq) && <div className="mt-2 text-sm text-muted-foreground">{scheduleLine(enq)}</div>}

                {receivedTab === "pending" && (
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => updateReceivedStatus(enq.id, "accepted")}
                      disabled={!!pendingMap[key]}
                      className="rounded-md bg-green-600 px-3 py-1 text-sm text-white disabled:opacity-60"
                    >
                      {pendingMap[key] ? "Accepting…" : "Accept"}
                    </button>
                    {confirmingDecline[enq.id]?.open ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={confirmingDecline[enq.id]?.reason ?? ""}
                          onChange={(e) =>
                            setConfirmingDecline((s) => ({
                              ...s,
                              [enq.id]: { open: true, reason: e.target.value },
                            }))
                          }
                          placeholder="Optional reason"
                          className="w-48 rounded-md border border-input bg-background px-2 py-1 text-sm"
                        />
                        <button
                          onClick={() => {
                            const reason = confirmingDecline[enq.id]?.reason ?? "";
                            setConfirmingDecline((s) => ({ ...s, [enq.id]: { open: false, reason: "" } }));
                            updateReceivedStatus(enq.id, "declined", reason);
                          }}
                          disabled={!!pendingMap[key]}
                          className="rounded-md bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-60"
                        >
                          {pendingMap[key] ? "Declining…" : "Confirm decline"}
                        </button>
                        <button
                          onClick={() => setConfirmingDecline((s) => ({ ...s, [enq.id]: { open: false, reason: "" } }))}
                          className="rounded-md bg-gray-200 px-3 py-1 text-sm text-gray-800"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingDecline((s) => ({ ...s, [enq.id]: { open: true, reason: "" } }))}
                        disabled={!!pendingMap[key]}
                        className="rounded-md bg-gray-200 px-3 py-1 text-sm text-gray-800 disabled:opacity-60"
                      >
                        {pendingMap[key] ? "Declining…" : "Decline"}
                      </button>
                    )}
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

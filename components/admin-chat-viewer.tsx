"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEscapeKey } from "@/lib/use-escape-key";
import BanUserDialog, { type BanDuration } from "./ban-user-dialog";
import SendWarningDialog from "./send-warning-dialog";
import AdminTakeActionMenu from "./admin-take-action-menu";

type Attachment = {
  id: string;
  kind: "photo" | "video" | "file";
  signedUrl?: string | null;
  file_name: string;
  deleted_at?: string | null;
  bucket?: string;
  storage_path?: string;
};

type ReportRow = {
  id: string;
  reportable_id: string;
  status: string;
  reason?: string | null;
  admin_notes?: string | null;
  reporter_name?: string | null;
  updated_at?: string | null;
  target?: { sender_id?: string | null; full_name?: string | null; user_code?: string | null } | null;
};

type Message = {
  id: string;
  body: string | null;
  sender_id: string;
  created_at: string;
  deleted_at?: string | null;
  admin_removed_at?: string | null;
  attachments?: Attachment[];
  reports?: ReportRow[];
};

type Party = { full_name?: string | null; user_code?: string | null; id?: string; business_name?: string | null; profiles?: { user_code?: string | null } | null } | null;
type ProjectSummary = { project_code?: string | null; openedAt?: string | null; id?: string | null };
type EnquirySummary = { enquiry_code?: string | null; status?: string | null; customer_id?: string | null; provider_id?: string | null; completed_at?: string | null; admin_cancelled_at?: string | null; updated_at?: string | null } | null;

function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AdminChatViewer({ project, enquiry, customer, provider, messages, reports, targetMessageId, durationLabel }: { project: ProjectSummary; enquiry: EnquirySummary; customer: Party; provider: Party; messages: Message[]; reports?: ReportRow[]; targetMessageId: string; durationLabel?: string; }) {
  const router = useRouter();
  const [currentIdx, setCurrentIdx] = useState(Math.max(0, messages.filter((m) => (m.reports || []).length > 0).map((m) => m.id).indexOf(targetMessageId)));
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [warnCustomer, setWarnCustomer] = useState(false);
  const [warnProvider, setWarnProvider] = useState(false);
  const [banDialog, setBanDialog] = useState<{ isOpen: boolean; userId: string | null; userLabel: string; duration: BanDuration }>({ isOpen: false, userId: null, userLabel: "", duration: "1_week" });
  const [banToast, setBanToast] = useState<string | null>(null);
  const [removeMessageId, setRemoveMessageId] = useState<string | null>(null);
  const [removeAlsoActioned, setRemoveAlsoActioned] = useState(true);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removingMessageId, setRemovingMessageId] = useState<string | null>(null);

  function showToast(message: string) {
    setBanToast(message);
    window.setTimeout(() => setBanToast(null), 5000);
  }

  useEscapeKey(removeMessageId !== null, () => setRemoveMessageId(null));

  const reportedIds = useMemo(
    () =>
      (reports && reports.length
        ? messages.filter((m) => (reports.some((report) => report.reportable_id === m.id) ? true : (m.reports || []).length > 0))
        : messages.filter((m) => (m.reports || []).length > 0)
      ).map((m) => m.id),
    [messages, reports]
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = document.getElementById(`msg-${targetMessageId}`);
      if (el) {
        el.scrollIntoView({ block: "center" });
        setHighlightedId(targetMessageId);
        setTimeout(() => setHighlightedId(null), 3000);
      }
    });
  }, [targetMessageId]);

  function gotoReported(i: number) {
    const id = reportedIds[i];
    const el = document.getElementById(`msg-${id}`);
    if (el) el.scrollIntoView({ block: "center" });
    setCurrentIdx(i);
    setHighlightedId(id);
    setTimeout(() => setHighlightedId(null), 3000);
  }

  async function handleMessageRemoval(message: Message) {
    if (!message) return;
    const supabase = createClient();
    try {
      if (message.admin_removed_at) {
        setRemovingMessageId(message.id);
        await supabase.rpc("admin_restore_project_message", { p_message_id: message.id });
        setRemoveMessageId(null);
        router.refresh();
        return;
      }

      const unresolved = (message.reports || []).filter((r) => r.status === "open" || r.status === "reviewed");
      if (unresolved.length > 0 && removeAlsoActioned) {
        await Promise.all(
          unresolved.map((report) =>
            supabase.rpc("admin_update_report", {
              p_report_id: report.id,
              p_status: "actioned",
              p_admin_notes: report.admin_notes ?? null,
            })
          )
        );
      }

      setRemovingMessageId(message.id);
      await supabase.rpc("admin_remove_project_message", { p_message_id: message.id });
      setRemoveMessageId(null);
      router.refresh();
    } catch (err) {
      console.error("Message admin action failed:", err);
      setRemoveError(err instanceof Error ? err.message : "Unable to update this message.");
    } finally {
      setRemovingMessageId(null);
    }
  }

  const openedAt = project?.openedAt;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <a href="/admin/chats" className="text-sm text-blue-600 underline">Back to Chats</a>
          <span className="mx-2 text-muted-foreground">/</span>
          <a href="/admin/reports" className="text-sm text-blue-600 underline">Back to Reports</a>
        </div>
        <div className="text-sm text-muted-foreground">
          Project {project.project_code} · Enquiry {enquiry?.enquiry_code} · <span className="ml-2 px-2 py-1 rounded border text-xs">{enquiry?.status}</span>
        </div>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Customer</p>
          <p className="font-medium">{customer?.full_name}</p>
          {customer?.user_code && <p className="text-sm text-muted-foreground">#{customer.user_code}</p>}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Provider</p>
          <p className="font-medium">{provider?.business_name ?? provider?.full_name}</p>
          {provider?.profiles?.user_code && <p className="text-sm text-muted-foreground">#{provider.profiles.user_code}</p>}
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">Chat opened: {formatDateTime(openedAt)} · {durationLabel}</p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => setWarnCustomer(true)}>Warn customer</button>
        <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => setWarnProvider(true)}>Warn provider</button>
        <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => { if (enquiry?.customer_id) setBanDialog({ isOpen: true, userId: enquiry.customer_id, userLabel: `${customer?.full_name ?? "Customer"}${customer?.user_code ? ` (#${customer.user_code})` : ""}`, duration: "1_week" }); }}>Ban customer</button>
        <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => { if (enquiry?.provider_id) setBanDialog({ isOpen: true, userId: enquiry.provider_id, userLabel: `${provider?.business_name ?? provider?.full_name ?? "Provider"}${provider?.profiles?.user_code ? ` (#${provider.profiles.user_code})` : ""}`, duration: "1_week" }); }}>Ban provider</button>
        <a href={`/admin/enquiries?q=${encodeURIComponent(enquiry?.enquiry_code ?? "")}`} className="rounded border px-3 py-1.5 text-sm text-blue-600 underline">Open enquiry in admin</a>
        <span className="text-xs text-muted-foreground">Force-cancel there to lock this chat</span>
      </div>

      <div className="rounded border bg-muted p-3 mb-4">
        <p className="text-sm">Read-only admin view. You can see this chat because a message in it was reported.</p>
      </div>

      <div className="sticky top-14 z-40 mt-2 mb-4 flex items-center gap-2 bg-background border rounded shadow-sm p-2">
        <span className="text-sm">Reported message highlighted below</span>
        <button className="rounded border px-2 py-1" onClick={() => gotoReported(currentIdx)}>Jump to reported message</button>
        {reportedIds.length > 1 && (
          <>
            <div className="ml-2 text-sm text-muted-foreground">Reported message {currentIdx + 1} of {reportedIds.length}</div>
            <div className="ml-2 inline-flex items-center gap-2">
              <button className="rounded border px-2 py-1" onClick={() => gotoReported((currentIdx - 1 + reportedIds.length) % reportedIds.length)}>Previous</button>
              <button className="rounded border px-2 py-1" onClick={() => gotoReported((currentIdx + 1) % reportedIds.length)}>Next</button>
            </div>
          </>
        )}
      </div>

      <BanUserDialog
        isOpen={banDialog.isOpen}
        userId={banDialog.userId}
        userLabel={banDialog.userLabel}
        defaultDuration={banDialog.duration}
        onClose={() => setBanDialog((prev) => ({ ...prev, isOpen: false }))}
        onSuccess={(emailSent, bannedUntil) => {
          const dateText = bannedUntil ? new Date(bannedUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "permanently";
          setBanToast(`User banned until ${dateText}`);
          setBanDialog((prev) => ({ ...prev, isOpen: false }));
          setTimeout(() => setBanToast(null), 5000);
          router.refresh();
          if (emailSent) {
            console.info("Ban email delivered");
          }
        }}
      />

      {banToast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {banToast}
        </div>
      )}

      <div className="space-y-6">
        {messages.map((m) => {
          const isProvider = m.sender_id === enquiry?.provider_id;
          const reported = (m.reports || []).length > 0;
          const showBody = !!(m.body && m.body.trim());

          return (
            <div key={m.id} id={`msg-${m.id}`} className={`w-full p-2 scroll-mt-24 ${reported ? 'border-l-4 border-red-500' : ''} ${highlightedId === m.id ? 'ring-4 ring-red-200 bg-red-50' : ''}`}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <div className="text-sm font-medium">{isProvider ? (provider?.business_name ?? 'Provider') : (customer?.full_name ?? 'Customer')} <span className="ml-2 text-xs text-muted-foreground">{isProvider ? 'Provider' : 'Customer'}</span></div>
                <div className="flex items-center gap-2">
                  {reported && (
                    <AdminTakeActionMenu
                      message={m}
                      authorName={isProvider ? (provider?.business_name ?? 'Provider') : (customer?.full_name ?? 'Customer')}
                      authorUserCode={isProvider ? provider?.profiles?.user_code ?? null : customer?.user_code ?? null}
                      isAuthorAdmin={false}
                      onRemoveToggle={(messageId) => setRemoveMessageId(messageId)}
                      onToast={showToast}
                    />
                  )}
                  <div className="text-xs text-muted-foreground">{formatDateTime(m.created_at)}</div>
                </div>
              </div>

              {m.admin_removed_at && (
                <div className="mb-2 inline-flex items-center gap-2 rounded bg-orange-50 px-2 py-0.5 text-orange-700 font-medium">
                  <span>⚠</span>
                  <span>Removed by admin {formatDateTime(m.admin_removed_at)}</span>
                </div>
              )}

              {showBody && !m.admin_removed_at && (
                <div className={`rounded-md p-3 ${isProvider ? 'bg-blue-600 text-white ml-auto max-w-[70%]' : 'bg-gray-100 text-black max-w-[70%]'} ${m.admin_removed_at ? 'opacity-80' : ''}`}>
                  <div className="whitespace-pre-wrap">{m.body}</div>
                </div>
              )}

              {m.admin_removed_at && showBody && (
                <div className="rounded-md border border-dashed border-orange-200 bg-orange-50 p-3 text-sm italic text-orange-800 opacity-80">
                  <div className="whitespace-pre-wrap">{m.body}</div>
                </div>
              )}

              {m.attachments && m.attachments.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  {m.attachments.map((att) => (
                    <div key={att.id} className="rounded border p-2">
                      {att.deleted_at && (
                        <div className="mb-2 inline-flex items-center gap-2 rounded bg-red-50 px-2 py-0.5 text-red-600 font-medium">
                          <span>⚠</span>
                          <span>Removed by sender {formatDateTime(att.deleted_at)}</span>
                        </div>
                      )}
                      {att.kind === 'photo' && att.signedUrl ? (
                        <a href={att.signedUrl} target="_blank" rel="noopener noreferrer">
                          <Image src={att.signedUrl} className="h-44 w-72 object-cover" alt={att.file_name} width={720} height={176} unoptimized />
                        </a>
                      ) : att.kind === 'photo' ? (
                        <div className="text-sm text-muted-foreground">Preview unavailable</div>
                      ) : null}

                      {att.kind === 'video' && att.signedUrl ? (
                        <video controls preload="metadata" src={att.signedUrl} className="aspect-video w-full max-w-sm bg-black" />
                      ) : att.kind === 'video' ? (
                        <div className="text-sm text-muted-foreground">Preview unavailable</div>
                      ) : null}

                      {att.kind === 'file' && (
                        <div className="flex items-center gap-2">
                          <div className="text-sm">{att.file_name}</div>
                          {att.signedUrl ? (
                            <a href={att.signedUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">Open</a>
                          ) : (
                            <div className="text-sm text-muted-foreground">Preview unavailable</div>
                          )}
                        </div>
                      )}

                      {att.deleted_at && <div className="mt-1 text-xs text-muted-foreground">Removed by sender {formatDateTime(att.deleted_at)}</div>}
                    </div>
                  ))}
                </div>
              )}

              {m.deleted_at && (
                <div className="mb-2 inline-flex items-center gap-2 rounded bg-red-50 px-2 py-0.5 text-red-600 font-medium">
                  <span>⚠</span>
                  <span>Deleted by sender {formatDateTime(m.deleted_at)}</span>
                </div>
              )}

              {!reported && !m.deleted_at && !m.admin_removed_at && (
                <div className="mt-2">
                  <button type="button" className="text-xs text-blue-600 underline" onClick={() => setRemoveMessageId(m.id)}>Remove message</button>
                </div>
              )}

              {!reported && m.admin_removed_at && (
                <div className="mt-2">
                  <button type="button" className="text-xs text-blue-600 underline" onClick={() => handleMessageRemoval(m)}>{removingMessageId === m.id ? "Restoring..." : "Restore message"}</button>
                </div>
              )}

              {reported && (
                <div className="mt-2 text-sm text-red-700">
                  <div className="inline-flex items-center gap-2"><span className="font-medium rounded bg-red-100 px-2 py-1 text-red-700">Reported</span></div>
                  {(m.reports || []).map((r) => (
                    <div key={r.id} className="mt-1 text-xs text-muted-foreground">{r.status} · {r.reason} · {r.reporter_name}</div>
                  ))}
                  {(m.reports || []).filter((r) => !!r.admin_notes?.trim()).map((r) => (
                    <div key={`notes-${r.id}`} className="mt-2 rounded border bg-muted/60 p-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Admin note:</span> {r.admin_notes}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {warnCustomer && (
        <SendWarningDialog
          isOpen={warnCustomer}
          recipientId={enquiry?.customer_id}
          onClose={() => setWarnCustomer(false)}
          onSuccess={() => undefined}
          recipientName={customer?.full_name ?? "Customer"}
          recipientUserCode={customer?.user_code ?? undefined}
        />
      )}

      {warnProvider && (
        <SendWarningDialog
          isOpen={warnProvider}
          recipientId={enquiry?.provider_id}
          onClose={() => setWarnProvider(false)}
          onSuccess={() => undefined}
          recipientName={provider?.business_name ?? provider?.full_name ?? "Provider"}
          recipientUserCode={provider?.profiles?.user_code ?? undefined}
        />
      )}

      {removeMessageId && (() => {
        const entry = messages.find((m) => m.id === removeMessageId);
        if (!entry) return null;
        const unresolved = (entry.reports || []).filter((r) => r.status === "open" || r.status === "reviewed");
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Remove this message from the chat for both people? The original stays visible here for review.</h3>
              {unresolved.length > 0 && (
                <label className="mb-4 flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={removeAlsoActioned} onChange={(e) => setRemoveAlsoActioned(e.target.checked)} className="mt-1" />
                  <span>Also mark its unresolved reports as actioned</span>
                </label>
              )}
              {removeError && <p className="mb-3 text-sm text-red-600">{removeError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => { setRemoveMessageId(null); setRemoveError(null); }}>Cancel</button>
                <button type="button" className="rounded bg-orange-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={removingMessageId !== null} onClick={() => { setRemoveError(null); void handleMessageRemoval(entry); }}>
                  {removingMessageId === entry.id ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}


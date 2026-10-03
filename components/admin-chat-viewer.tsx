"use client";

import { useEffect, useMemo, useState } from "react";

type Attachment = {
  id: string;
  kind: "photo" | "video" | "file";
  signedUrl?: string | null;
  file_name: string;
  deleted_at?: string | null;
  bucket?: string;
  storage_path?: string;
};

type ReportRow = { id: string; reportable_id: string; status: string; reason?: string | null; profiles?: { full_name?: string | null } | null };

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

type Party = { full_name?: string | null; user_code?: string | null; id?: string; business_name?: string | null } | null;

function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AdminChatViewer({ project, enquiry, customer, provider, messages, targetMessageId }: { project: any; enquiry: any; customer: Party; provider: Party; messages: Message[]; targetMessageId: string; }) {
  const reportedIds = useMemo(() => messages.filter((m) => (m.reports || []).length > 0).map((m) => m.id), [messages]);
  const [currentIdx, setCurrentIdx] = useState(Math.max(0, reportedIds.indexOf(targetMessageId)));
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    // scroll to target once
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

  const openedAt = project?.openedAt;
  const closedAt = enquiry?.status !== "confirmed" ? enquiry?.completed_at ?? enquiry?.admin_cancelled_at ?? enquiry?.updated_at ?? null : null;

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
          {provider && (provider as any).profiles?.user_code && <p className="text-sm text-muted-foreground">#{(provider as any).profiles.user_code}</p>}
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">Chat opened: {formatDateTime(openedAt)} · {enquiry?.status === 'confirmed' ? `Open for ${/* humanDuration called on server */ ''}` : `Was open for ${''}`}</p>

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

      <div className="space-y-6">
        {messages.map((m) => {
          const isCustomer = m.sender_id === enquiry?.customer_id;
          const isProvider = m.sender_id === enquiry?.provider_id;
          const reported = (m.reports || []).length > 0;
          const showBody = !!(m.body && m.body.trim());

          return (
            <div key={m.id} id={`msg-${m.id}`} className={`w-full p-2 scroll-mt-24 ${reported ? 'border-l-4 border-red-500' : ''} ${highlightedId === m.id ? 'ring-4 ring-red-200 bg-red-50' : ''}`}>
              <div className="mb-1 flex items-center justify-between">
                <div className="text-sm font-medium">{isProvider ? (provider?.business_name ?? 'Provider') : (customer?.full_name ?? 'Customer')} <span className="ml-2 text-xs text-muted-foreground">{isProvider ? 'Provider' : 'Customer'}</span></div>
                <div className="text-xs text-muted-foreground">{formatDateTime(m.created_at)}</div>
              </div>

              {m.admin_removed_at && (
                <div className="mb-2 inline-flex items-center gap-2 rounded bg-orange-50 px-2 py-0.5 text-orange-700 font-medium">
                  <span>⚠</span>
                  <span>Removed by admin {formatDateTime(m.admin_removed_at)}</span>
                </div>
              )}

              {showBody && (
                <div className={`rounded-md p-3 ${isProvider ? 'bg-blue-600 text-white ml-auto max-w-[70%]' : 'bg-gray-100 text-black max-w-[70%]'} ${m.admin_removed_at ? 'opacity-80' : ''}`}>
                  <div className="whitespace-pre-wrap">{m.body}</div>
                </div>
              )}

              {m.attachments && m.attachments.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  {m.attachments.map((att) => (
                    <div key={att.id} className="rounded border p-2">
                      {/* Removed/Deleted label above content if present */}
                      {att.deleted_at && (
                        <div className="mb-2 inline-flex items-center gap-2 rounded bg-red-50 px-2 py-0.5 text-red-600 font-medium">
                          <span>⚠</span>
                          <span>Removed by sender {formatDateTime(att.deleted_at)}</span>
                        </div>
                      )}
                      {att.kind === 'photo' && att.signedUrl ? (
                        <a href={att.signedUrl} target="_blank" rel="noopener noreferrer"><img src={att.signedUrl} className="h-44 w-72 object-cover" alt={att.file_name} /></a>
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

              {reported && (
                <div className="mt-2 text-sm text-red-700">
                  <div className="inline-flex items-center gap-2"><span className="font-medium rounded bg-red-100 px-2 py-1 text-red-700">Reported</span></div>
                  {(m.reports || []).map((r) => (
                    <div key={r.id} className="mt-1 text-xs text-muted-foreground">{r.status} · {r.reason} · {r.profiles?.full_name}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AdminChatViewer({ project, enquiry, customer, provider, messages, targetMessageId }: any) {
  const reportedIds = useMemo(() => messages.filter((m: any) => (m.reports || []).length > 0).map((m: any) => m.id), [messages]);
  const idxMap = useMemo(() => reportedIds.reduce((acc: any, id: string, i: number) => ((acc[id] = i), acc), {} as Record<string, number>), [reportedIds]);
  const [currentIdx, setCurrentIdx] = useState(idxMap[targetMessageId] ?? 0);
  const mountedRef = useRef(false);

  useEffect(() => {
    // scroll to target once
    requestAnimationFrame(() => {
      const el = document.getElementById(`msg-${targetMessageId}`);
      if (el) {
        el.scrollIntoView({ block: "center" });
        el.classList.add("ring-4", "ring-red-200", "bg-red-50");
        setTimeout(() => {
          el.classList.remove("ring-4", "ring-red-200");
        }, 3000);
      }
    });
  }, [targetMessageId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  function gotoReported(i: number) {
    const id = reportedIds[i];
    const el = document.getElementById(`msg-${id}`);
    if (el) el.scrollIntoView({ block: "center" });
    setCurrentIdx(i);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <a href="/admin/chats" className="text-sm text-blue-600 underline">Back to Chats</a>
          <span className="mx-2 text-muted-foreground">/</span>
          <a href="/admin/reports" className="text-sm text-blue-600 underline">Back to Reports</a>
        </div>
        <div className="text-sm text-muted-foreground">Project {project.project_code} · Enquiry {enquiry?.enquiry_code}</div>
      </div>

      <div className="rounded border bg-muted p-3">
        <p className="text-sm">Read-only admin view. You can see this chat because a message in it was reported.</p>
      </div>

      <div className="sticky top-14 z-40 mt-2 mb-4 flex items-center gap-2">
        <span className="text-sm">Reported message highlighted below</span>
        <button className="rounded border px-2 py-1" onClick={() => gotoReported(currentIdx)}>Jump to reported message</button>
        {reportedIds.length > 1 && (
          <div className="ml-2 inline-flex items-center gap-2">
            <button className="rounded border px-2 py-1" onClick={() => gotoReported((currentIdx - 1 + reportedIds.length) % reportedIds.length)}>Previous</button>
            <button className="rounded border px-2 py-1" onClick={() => gotoReported((currentIdx + 1) % reportedIds.length)}>Next</button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {messages.map((m: any) => {
          const isCustomer = customer && m.sender_id === customer.user_id;
          const isProvider = provider && m.sender_id === provider.id;
          const reported = (m.reports || []).length > 0;

          return (
            <div key={m.id} id={`msg-${m.id}`} className={`w-full ${reported ? 'border-l-4 border-red-500' : ''} p-2`}> 
              <div className="mb-1 flex items-center justify-between">
                <div className="text-sm font-medium">{m.sender_id === provider?.id ? provider.business_name : customer?.full_name || m.sender_id}</div>
                <div className="text-xs text-muted-foreground">{formatDateTime(m.created_at)}</div>
              </div>

              <div className={`rounded-md p-3 ${m.sender_id === provider?.id ? 'bg-blue-600 text-white ml-auto max-w-[70%]' : 'bg-gray-100 text-black max-w-[70%]'}`}>
                <div className="whitespace-pre-wrap">{m.body}</div>
              </div>

              {m.deleted_at && <div className="mt-1 text-xs text-muted-foreground">Deleted by sender {formatDateTime(m.deleted_at)}</div>}

              {m.attachments && m.attachments.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  {m.attachments.map((att: any) => (
                    <div key={att.id} className="rounded border p-2">
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

              {reported && (
                <div className="mt-2 text-sm text-red-700">
                  <div className="inline-flex items-center gap-2"><span className="font-medium">Reported</span></div>
                  {(m.reports || []).map((r: any) => (
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

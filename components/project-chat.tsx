"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEscapeKey } from "@/lib/use-escape-key";

type ProjectMessage = {
  id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

const EMPTY_MESSAGES: ProjectMessage[] = [];

type ProjectChatProps = {
  projectId: string;
  currentUserId: string;
  canSend: boolean;
  initialMessages?: ProjectMessage[];
  otherPartyName: string;
  readOnlyReason: string | null;
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function ProjectChat({
  projectId,
  currentUserId,
  canSend,
  initialMessages = EMPTY_MESSAGES,
  otherPartyName,
  readOnlyReason,
}: ProjectChatProps) {
  const [messages, setMessages] = useState<ProjectMessage[]>(initialMessages);
  const [loadingMessages, setLoadingMessages] = useState(initialMessages.length === 0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const supabaseRef = useRef(createClient());
  const channelRef = useRef<ReturnType<typeof createClient>["channel"] | null>(null);
  const visibilityRef = useRef(true);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEscapeKey(openMenuFor !== null || reportingMessageId !== null, () => {
    setOpenMenuFor(null);
    setReportingMessageId(null);
  });

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (loadingMessages) return;
    const lastMsg = messages[messages.length - 1];
    const isNewMessage = messages.length > prevMessageCountRef.current;
    const lastIsMine = lastMsg?.sender_id === currentUserId;
    if (isNearBottomRef.current || (isNewMessage && lastIsMine) || prevMessageCountRef.current === 0) {
      scrollToBottom();
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, loadingMessages, currentUserId]);

  const markAsRead = useCallback(async () => {
    try {
      const supabase = supabaseRef.current;
      const { error } = await supabase.rpc("mark_project_messages_read", {
        p_project_id: projectId,
      });
      if (error) {
        console.error("Mark as read error:", error.message, error.details, error.hint, error.code);
      }
    } catch (err) {
      console.error("Mark as read exception:", err);
    }
  }, [projectId]);

  // Visibility tracking
  useEffect(() => {
    const handleVisibilityChange = () => {
      visibilityRef.current = document.visibilityState === "visible";
      if (visibilityRef.current && !canSend) {
        // Mark as read when tab becomes visible (for admins)
        markAsRead();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [canSend, markAsRead]);

  // Load messages on mount if not provided
  useEffect(() => {
    if (initialMessages.length > 0) return;

    const loadMessages = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("project_messages")
          .select("id,sender_id,body,read_at,created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true });

        if (error) {
          console.error(error);
          return;
        }

        setMessages(data || []);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [projectId]);

  const handleCopyMessage = async (msg: ProjectMessage) => {
    try {
      await navigator.clipboard.writeText(msg.body);
      setCopiedMessageId(msg.id);
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
      copiedTimeoutRef.current = setTimeout(() => {
        setCopiedMessageId(null);
        setOpenMenuFor(null);
      }, 1500);
    } catch (error) {
      console.error("Copy message failed:", error);
      setOpenMenuFor(null);
    }
  };

  const closeReportDialog = () => {
    setReportingMessageId(null);
    setReportReason("");
    setReportError(null);
    setReportSubmitting(false);
  };

  const handleSubmitReport = async () => {
    if (!reportingMessageId || reportSubmitting) return;

    const trimmedReason = reportReason.trim();
    if (!trimmedReason) return;

    setReportSubmitting(true);
    setReportError(null);

    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("reports").insert({
        reportable_type: "project_message",
        reportable_id: reportingMessageId,
        reporter_id: currentUserId,
        reason: trimmedReason,
        status: "open",
      });

      if (insertError) {
        console.error(
          insertError.message,
          insertError.details,
          insertError.hint,
          insertError.code
        );

        if (insertError.code === "23505") {
          setReportedIds((prev) => new Set(prev).add(reportingMessageId));
          setReportError("You've already reported this message.");
          return;
        }

        setReportError("Could not submit the report. Please try again.");
        return;
      }

      setReportedIds((prev) => new Set(prev).add(reportingMessageId));
      setToastMessage("Message reported");
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = setTimeout(() => {
        setToastMessage(null);
      }, 2000);
      closeReportDialog();
    } catch (err) {
      console.error("Report submission error:", err);
      setReportError("Could not submit the report. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  };

  // On mount: mark as read and set up realtime
  useEffect(() => {
    const supabase = supabaseRef.current;

    // Mark as read on mount if canSend and visible
    if (canSend && visibilityRef.current) {
      markAsRead();
    }

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`project_messages:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_messages",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const newMessage = payload.new as ProjectMessage;
          setMessages((prev) => {
            // Dedupe by id
            if (prev.some((m) => m.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });

          // Mark as read if it's from the other party and we're visible and not an admin
          if (
            newMessage.sender_id !== currentUserId &&
            canSend &&
            visibilityRef.current
          ) {
            markAsRead();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "project_messages",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as ProjectMessage;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updatedMessage.id
                ? { ...m, read_at: updatedMessage.read_at }
                : m
            )
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, currentUserId, canSend, markAsRead]);

  // Send message
  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);

    try {
      const supabase = supabaseRef.current;
      const { data, error: insertError } = await supabase
        .from("project_messages")
        .insert({
          project_id: projectId,
          sender_id: currentUserId,
          body: trimmed,
        })
        .select()
        .single();

      if (insertError) {
        console.error(
          insertError.message,
          insertError.details,
          insertError.hint,
          insertError.code
        );
        setError("Failed to send message. Please try again.");
        return;
      }

      // Append to messages, dedupe by id
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) {
          return prev;
        }
        return [...prev, data];
      });

      setText("");
    } catch (err) {
      console.error("Send exception:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // Handle Enter / Shift+Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="mt-10 rounded-lg border p-6">
      <h2 className="mb-6 text-lg font-semibold">Chat with {otherPartyName}</h2>

      {toastMessage && (
        <div className="mb-4 rounded bg-green-50 p-2 text-sm text-green-700">{toastMessage}</div>
      )}

      {/* Message list */}
      <div
        ref={containerRef}
        className="mb-6 max-h-96 space-y-4 overflow-y-auto rounded bg-gray-50 p-4"
        onScroll={() => {
          const el = containerRef.current;
          if (!el) return;
          isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {loadingMessages ? (
          <p className="text-center text-sm text-gray-500">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-gray-500">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === currentUserId;
            return isOwn ? (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-xs rounded-lg bg-blue-500 px-3 py-2 text-sm text-white">
                  <p className="break-words">{msg.body}</p>
                  <div className="mt-1 text-xs text-blue-100">
                    {formatTime(msg.created_at)}
                    <span className="ml-2">{msg.read_at ? "Seen" : "Sent"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div key={msg.id} className="group flex items-start justify-start gap-1">
                <div className="max-w-xs rounded-lg bg-gray-200 px-3 py-2 text-sm text-gray-900">
                  <p className="break-words">{msg.body}</p>
                  <div className="mt-1 text-xs text-gray-600">
                    {formatTime(msg.created_at)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenMenuFor(openMenuFor === msg.id ? null : msg.id)}
                  aria-label="Message options"
                  className={`mt-1 rounded p-1 text-gray-500 hover:bg-gray-200 ${
                    openMenuFor === msg.id ? "opacity-100" : "opacity-60 group-hover:opacity-100"
                  }`}
                >
                  ⋮
                </button>
                {openMenuFor === msg.id && (
                  <div className="relative">
                    <div className="absolute left-0 top-6 z-10 w-32 rounded border bg-white text-sm shadow-lg">
                      <button
                        type="button"
                        className="block w-full border-b border-gray-100 px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
                        onClick={() => handleCopyMessage(msg)}
                      >
                        {copiedMessageId === msg.id ? "Copied" : "Copy"}
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                        disabled={reportedIds.has(msg.id)}
                        onClick={() => {
                          setOpenMenuFor(null);
                          setReportingMessageId(msg.id);
                          setReportReason("");
                          setReportError(null);
                        }}
                      >
                        {reportedIds.has(msg.id) ? "Reported" : "Report"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {reportingMessageId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">Report this message</h3>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={4}
              placeholder="Why are you reporting this message?"
              className="w-full rounded border border-gray-300 p-2 text-sm outline-none focus:border-blue-500"
            />
            {reportError && <p className="mt-2 text-sm text-red-600">{reportError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700"
                onClick={closeReportDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={reportReason.trim().length === 0 || reportSubmitting}
                onClick={handleSubmitReport}
              >
                {reportSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Send box or read-only message */}
      {canSend ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            placeholder="Type a message..."
            className="w-full rounded border p-2 text-sm disabled:opacity-50"
            rows={3}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">{text.length} / 2000</span>
            <button
              onClick={handleSend}
              disabled={sending || !text.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded bg-gray-100 p-4 text-sm text-gray-700">{readOnlyReason}</div>
      )}
    </div>
  );
}

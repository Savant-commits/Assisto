"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProjectMessage = {
  id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type ProjectChatProps = {
  projectId: string;
  currentUserId: string;
  canSend: boolean;
  initialMessages: ProjectMessage[];
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
  initialMessages,
  otherPartyName,
  readOnlyReason,
}: ProjectChatProps) {
  const [messages, setMessages] = useState<ProjectMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabaseRef = useRef(createClient());
  const channelRef = useRef<any>(null);
  const visibilityRef = useRef(true);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
  }, [canSend]);

  // Mark messages as read
  const markAsRead = async () => {
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
  }, [projectId, currentUserId, canSend]);

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

      {/* Message list */}
      <div className="mb-6 max-h-96 space-y-4 overflow-y-auto rounded bg-gray-50 p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-gray-500">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-xs rounded-lg px-3 py-2 text-sm ${
                    isOwn ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-900"
                  }`}
                >
                  <p className="break-words">{msg.body}</p>
                  <div className={`mt-1 text-xs ${isOwn ? "text-blue-100" : "text-gray-600"}`}>
                    {formatTime(msg.created_at)}
                    {isOwn && (
                      <span className="ml-2">
                        {msg.read_at ? "Seen" : "Sent"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
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
            <span className="text-xs text-gray-600">
              {text.length} / 2000
            </span>
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
        <div className="rounded bg-gray-100 p-4 text-sm text-gray-700">
          {readOnlyReason}
        </div>
      )}
    </div>
  );
}

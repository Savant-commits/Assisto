"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEscapeKey } from "@/lib/use-escape-key";
import { ProjectMessageAttachment, ProjectMessage } from "@/lib/types";

type PendingFile = {
  id: string;
  file: File;
  kind: "photo" | "video" | "file";
  previewUrl?: string;
  error?: string;
};

const EMPTY_MESSAGES: ProjectMessage[] = [];
const EMPTY_PENDING_FILES: PendingFile[] = [];
const EMPTY_ATTACHMENTS_BY_MESSAGE_ID: Record<string, ProjectMessageAttachment[]> = {};

type ProjectChatProps = {
  projectId: string;
  currentUserId: string;
  canSend: boolean;
  initialMessages?: ProjectMessage[];
  otherPartyName: string;
  readOnlyReason: string | null;
};

// File validation constants
const FILE_CONFIG: Record<string, { kind: "photo" | "video" | "file"; bucket: string; maxSize: number; mimeTypes: string[] }> = {
  photo: {
    kind: "photo",
    bucket: "chat-photos",
    maxSize: 10 * 1024 * 1024, // 10 MB
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  video: {
    kind: "video",
    bucket: "chat-videos",
    maxSize: 50 * 1024 * 1024, // 50 MB
    mimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
  },
  file: {
    kind: "file",
    bucket: "chat-files",
    maxSize: 10 * 1024 * 1024, // 10 MB
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/csv",
      "text/plain",
    ],
  },
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function getMimeTypeFromExtension(ext: string): string {
  const ext_lower = ext.toLowerCase();
  if (["jpg", "jpeg", "png", "webp"].includes(ext_lower)) return "image/*";
  if (["mp4", "mov", "webm"].includes(ext_lower)) return "video/*";
  return "application/*";
}

function getContentTypeFromFile(file: File): string {
  if (file.type) return file.type;

  const ext = getFileExtension(file.name);
  const extMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    csv: "text/csv",
    txt: "text/plain",
  };

  return extMap[ext] || "application/octet-stream";
}

function determineFileKind(file: File): { kind: "photo" | "video" | "file"; config: typeof FILE_CONFIG.photo } | null {
  const ext = getFileExtension(file.name);
  if (ext === "heic" || ext === "heif") {
    return null;
  }

  let mimeType = file.type;
  if (!mimeType) {
    mimeType = getMimeTypeFromExtension(ext);
  }

  // Check photo
  if (mimeType.startsWith("image/")) {
    if (mimeType === "image/heic" || mimeType === "image/heif") {
      return null; // HEIC not supported
    }
    return { kind: "photo", config: FILE_CONFIG.photo };
  }

  // Check video
  if (mimeType.startsWith("video/")) {
    return { kind: "video", config: FILE_CONFIG.video };
  }

  // Check document/file
  return { kind: "file", config: FILE_CONFIG.file };
}

function validateFile(file: File): { valid: true; kind: "photo" | "video" | "file" } | { valid: false; error: string } {
  const ext = getFileExtension(file.name);
  if (ext === "heic" || ext === "heif") {
    return { valid: false, error: "Please use JPG or PNG" };
  }

  const fileKindResult = determineFileKind(file);

  if (!fileKindResult) {
    return { valid: false, error: "Please use JPG or PNG" };
  }

  const { kind, config } = fileKindResult;

  // Check MIME type
  if (config.mimeTypes.length > 0 && !config.mimeTypes.includes(file.type || "")) {
    if (file.type === "") {
      // Fall back to checking by extension if type is empty
      const ext = getFileExtension(file.name);
      const expectedMimes = FILE_CONFIG[kind].mimeTypes;
      let mimeMatches = false;

      for (const mime of expectedMimes) {
        const mimeParts = mime.split("/");
        if (mimeParts[1] === "*") continue;
        const knownExts: Record<string, string[]> = {
          "image/jpeg": ["jpg", "jpeg"],
          "image/png": ["png"],
          "image/webp": ["webp"],
          "video/mp4": ["mp4"],
          "video/quicktime": ["mov"],
          "video/webm": ["webm"],
          "application/pdf": ["pdf"],
          "application/msword": ["doc"],
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
          "application/vnd.ms-excel": ["xls"],
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
          "application/vnd.ms-powerpoint": ["ppt"],
          "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
          "text/csv": ["csv"],
          "text/plain": ["txt"],
        };

        if (knownExts[mime] && knownExts[mime].includes(ext)) {
          mimeMatches = true;
          break;
        }
      }

      if (!mimeMatches) {
        return { valid: false, error: `File type not supported for ${kind}s` };
      }
    } else {
      return { valid: false, error: `File type not supported for ${kind}s` };
    }
  }

  // Check size
  if (file.size > config.maxSize) {
    return { valid: false, error: `File exceeds ${formatFileSize(config.maxSize)} limit` };
  }

  return { valid: true, kind };
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
  const [attachmentsByMessageId, setAttachmentsByMessageId] = useState<Record<string, ProjectMessageAttachment[]>>(
    EMPTY_ATTACHMENTS_BY_MESSAGE_ID
  );
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>(EMPTY_PENDING_FILES);
  const [loadingMessages, setLoadingMessages] = useState(initialMessages.length === 0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [confirmDeleteMessageId, setConfirmDeleteMessageId] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [signedUrlsByKey, setSignedUrlsByKey] = useState<Record<string, string>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const supabaseRef = useRef(createClient());
  const visibilityRef = useRef(true);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signedUrlCacheRef = useRef<Record<string, string>>({});
  const pendingFilesRef = useRef<PendingFile[]>(EMPTY_PENDING_FILES);
  const displayUrlRetryRef = useRef<Record<string, number>>({});
  const inFlightDisplayUrlKeysRef = useRef<Set<string>>(new Set());

  useEscapeKey(
    lightboxImage !== null || openMenuFor !== null || reportingMessageId !== null || confirmDeleteMessageId !== null,
    () => {
      if (lightboxImage !== null) {
        setLightboxImage(null);
        return;
      }
      setOpenMenuFor(null);
      setReportingMessageId(null);
      setConfirmDeleteMessageId(null);
    }
  );

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

  // Load messages and attachments on mount if not provided
  useEffect(() => {
    if (initialMessages.length > 0) return;

    const loadMessages = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("project_messages")
          .select("id,sender_id,body,read_at,deleted_at,created_at")
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

    const loadAttachments = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("project_message_attachments")
          .select("*")
          .eq("project_id", projectId);

        if (error) {
          console.error("project_message_attachments load failed:", error);
          return;
        }

        const grouped: Record<string, ProjectMessageAttachment[]> = {};
        for (const row of (data as ProjectMessageAttachment[]) || []) {
          if (!grouped[row.message_id]) grouped[row.message_id] = [];
          grouped[row.message_id].push(row);
        }
        setAttachmentsByMessageId(grouped);
      } catch (err) {
        console.error("Attachment load exception:", err);
      }
    };

    loadMessages();
    loadAttachments();
  }, [projectId, initialMessages]);

  const upsertMessage = useCallback((nextMessage: ProjectMessage) => {
    setMessages((prev) => {
      if (prev.some((message) => message.id === nextMessage.id)) {
        return prev.map((message) => (message.id === nextMessage.id ? nextMessage : message));
      }
      return [...prev, nextMessage];
    });
  }, []);

  const mergeAttachmentsForMessage = useCallback((messageId: string, nextAttachments: ProjectMessageAttachment[]) => {
    setAttachmentsByMessageId((prev) => {
      const existing = prev[messageId] || [];
      const merged = [...existing];

      for (const attachment of nextAttachments) {
        if (!merged.some((item) => item.id === attachment.id)) {
          merged.push(attachment);
        }
      }

      return {
        ...prev,
        [messageId]: merged,
      };
    });
  }, []);

  const getSignedUrl = useCallback(async (bucket: string, path: string, fileName?: string, mode: "display" | "download" = "display") => {
    const cacheKey = `${mode}:${bucket}:${path}`;
    if (signedUrlCacheRef.current[cacheKey]) {
      return signedUrlCacheRef.current[cacheKey];
    }

    try {
      const supabase = createClient();
      const params = mode === "download" && fileName ? { download: fileName } : undefined;
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600, params);

      if (error || !data?.signedUrl) {
        console.error("Signed URL failed:", error);
        return null;
      }

      signedUrlCacheRef.current[cacheKey] = data.signedUrl;
      setSignedUrlsByKey((prev) => ({ ...prev, [cacheKey]: data.signedUrl }));
      return data.signedUrl;
    } catch (err) {
      console.error("Signed URL exception:", err);
      return null;
    }
  }, []);

  const revokePendingFileUrls = useCallback((files: PendingFile[]) => {
    for (const file of files) {
      if (file.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
    }
  }, []);

  const handleDisplayUrlError = useCallback((bucket: string, path: string) => {
    const key = `display:${bucket}:${path}`;
    const retries = displayUrlRetryRef.current[key] ?? 0;

    delete signedUrlCacheRef.current[key];
    setSignedUrlsByKey((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    if (retries < 1) {
      displayUrlRetryRef.current[key] = retries + 1;
      void getSignedUrl(bucket, path, undefined, "display");
    }
  }, [getSignedUrl]);

  const preloadVisibleAttachmentUrls = useCallback(() => {
    const tasks: Array<{ bucket: string; path: string }> = [];

    for (const msg of messages) {
      if (msg.deleted_at !== null) continue;
      const itemAttachments = attachmentsByMessageId[msg.id] || [];
      for (const attachment of itemAttachments) {
        if (attachment.kind !== "photo" && attachment.kind !== "video") continue;
        const key = `display:${attachment.bucket}:${attachment.storage_path}`;
        if (signedUrlCacheRef.current[key] || inFlightDisplayUrlKeysRef.current.has(key)) continue;
        tasks.push({ bucket: attachment.bucket, path: attachment.storage_path });
        inFlightDisplayUrlKeysRef.current.add(key);
      }
    }

    if (tasks.length === 0) return;

    const bucketMap: Record<string, string[]> = {};
    for (const task of tasks) {
      if (!bucketMap[task.bucket]) bucketMap[task.bucket] = [];
      bucketMap[task.bucket].push(task.path);
    }

    Object.entries(bucketMap).forEach(async ([bucket, paths]) => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600);
        if (error || !data) return;

        const nextMap: Record<string, string> = {};
        data.forEach((row, index) => {
          const path = paths[index];
          const key = `display:${bucket}:${path}`;
          if (row.signedUrl) {
            signedUrlCacheRef.current[key] = row.signedUrl;
            nextMap[key] = row.signedUrl;
          }
          inFlightDisplayUrlKeysRef.current.delete(key);
        });

        if (Object.keys(nextMap).length > 0) {
          setSignedUrlsByKey((prev) => ({ ...prev, ...nextMap }));
        }
      } catch (err) {
        console.error("Preload signed URLs failed:", err);
        for (const path of paths) {
          inFlightDisplayUrlKeysRef.current.delete(`display:${bucket}:${path}`);
        }
      }
    });
  }, [attachmentsByMessageId, messages]);

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

  const handleDeleteMessage = async (messageId: string) => {
    setDeletingMessageId(messageId);
    setConfirmDeleteMessageId(null);
    setOpenMenuFor(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("delete_project_message", {
        p_message_id: messageId,
      });

      if (error) {
        console.error("Delete message failed:", error);
        setToastMessage("Failed to delete message");
        if (toastTimeoutRef.current) {
          clearTimeout(toastTimeoutRef.current);
        }
        toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
        return;
      }

      const deletedAt = new Date().toISOString();
      setMessages((prev) =>
        prev.map((message) => (message.id === messageId ? { ...message, deleted_at: deletedAt } : message))
      );
      setToastMessage("Message deleted");
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 2000);
    } catch (error) {
      console.error("Delete message exception:", error);
      setToastMessage("Failed to delete message");
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setDeletingMessageId(null);
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

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadError(null);

    const nextPending: PendingFile[] = [];
    const errors: string[] = [];
    const newFiles: PendingFile[] = [];

    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        errors.push(`${file.name}: ${validation.error}`);
        continue;
      }

      const fileEntry: PendingFile = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        file,
        kind: validation.kind,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      };
      newFiles.push(fileEntry);
    }

    if (errors.length > 0) {
      setUploadError(errors.join("\n"));
    }

    setPendingFiles((prev) => {
      const combined = [...prev, ...newFiles];
      if (combined.length > 5) {
        const trimmed = combined.slice(0, 5);
        for (const file of combined.slice(5)) {
          if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
        }
        setUploadError("Maximum 5 files per message");
        return trimmed;
      }
      return combined;
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setPendingFiles((prev) => {
      const target = prev.find((item) => item.id === fileId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== fileId);
    });
    setUploadError(null);
  };

  const cleanupUploadedFiles = useCallback(async (records: Array<{ bucket: string; path: string }>) => {
    if (!records.length) return;
    const supabase = createClient();
    const grouped: Record<string, string[]> = {};
    for (const record of records) {
      if (!grouped[record.bucket]) grouped[record.bucket] = [];
      grouped[record.bucket].push(record.path);
    }

    await Promise.all(
      Object.entries(grouped).map(([bucket, paths]) =>
        supabase.storage
          .from(bucket)
          .remove(paths)
          .catch(() => undefined)
      )
    );
  }, []);

  // On mount: mark as read and set up realtime
  useEffect(() => {
    const supabase = supabaseRef.current;

    // Mark as read on mount if canSend and visible
    if (canSend && visibilityRef.current) {
      markAsRead();
    }

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
            if (prev.some((m) => m.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });

          if (newMessage.sender_id !== currentUserId && canSend && visibilityRef.current) {
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
                ? { ...m, read_at: updatedMessage.read_at, deleted_at: updatedMessage.deleted_at }
                : m
            )
          );
        }
      )
      .subscribe();

    const attachmentChannel = supabase
      .channel(`project_message_attachments:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_message_attachments",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const attachment = payload.new as ProjectMessageAttachment;
          mergeAttachmentsForMessage(attachment.message_id, [attachment]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(attachmentChannel);
    };
  }, [projectId, currentUserId, canSend, markAsRead, mergeAttachmentsForMessage]);

  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);

  useEffect(() => {
    return () => {
      revokePendingFileUrls(pendingFilesRef.current);
    };
  }, [revokePendingFileUrls]);

  useEffect(() => {
    preloadVisibleAttachmentUrls();
  }, [messages, attachmentsByMessageId, preloadVisibleAttachmentUrls]);

  // Send message
  const handleSend = async () => {
    const trimmed = text.trim();
    const hasPendingFiles = pendingFiles.length > 0;
    if ((!trimmed && !hasPendingFiles) || sending) return;

    setSending(true);
    setError(null);
    setUploadError(null);

    const uploadedRecords: Array<{ bucket: string; path: string }> = [];

    try {
      const supabase = supabaseRef.current;
      const filesToUpload = [...pendingFiles];

      const results = await Promise.allSettled(
        filesToUpload.map(async (pendingFile) => {
          const config = FILE_CONFIG[pendingFile.kind];
          const ext = getFileExtension(pendingFile.file.name) || {
            photo: "jpg",
            video: "mp4",
            file: "bin",
          }[pendingFile.kind];
          const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
          const contentType = getContentTypeFromFile(pendingFile.file);

          const { error } = await supabase.storage.from(config.bucket).upload(path, pendingFile.file, {
            contentType,
          });
          if (error) {
            throw new Error(`Failed to upload ${pendingFile.file.name}: ${error.message}`);
          }

          uploadedRecords.push({ bucket: config.bucket, path });
          return {
            bucket: config.bucket,
            path,
            fileName: pendingFile.file.name,
            kind: pendingFile.kind,
            sizeBytes: pendingFile.file.size,
            mimeType: contentType,
          };
        })
      );

      const uploadedFiles = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
        .map((result) => result.value);

      if (results.some((result) => result.status === "rejected")) {
        await cleanupUploadedFiles(uploadedRecords);
        setError("Some files could not be uploaded. Please try again.");
        return;
      }

      const { data, error: insertError } = await supabase
        .from("project_messages")
        .insert({
          project_id: projectId,
          sender_id: currentUserId,
          body: trimmed || "",
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
        await cleanupUploadedFiles(uploadedRecords);
        setError("Failed to send message. Please try again.");
        return;
      }

      const message = data as ProjectMessage;
      upsertMessage(message);

      const successfulAttachments: ProjectMessageAttachment[] = [];
      const failedAttachments: Array<{ bucket: string; path: string }> = [];

      await Promise.all(
        uploadedFiles.map(async (uploadedFile) => {
          const { data: attachmentRow, error: attachmentError } = await supabase
            .from("project_message_attachments")
            .insert({
              message_id: message.id,
              project_id: projectId,
              uploader_id: currentUserId,
              kind: uploadedFile.kind,
              bucket: uploadedFile.bucket,
              storage_path: uploadedFile.path,
              file_name: uploadedFile.fileName,
              mime_type: uploadedFile.mimeType,
              size_bytes: uploadedFile.sizeBytes,
            })
            .select()
            .single();

          if (attachmentError) {
            console.error("Attachment insert failed:", attachmentError);
            failedAttachments.push({ bucket: uploadedFile.bucket, path: uploadedFile.path });
            return;
          }

          successfulAttachments.push(attachmentRow as ProjectMessageAttachment);
        })
      );

      if (failedAttachments.length > 0) {
        setError("Some attachments could not be saved. Please try again.");
        await cleanupUploadedFiles(failedAttachments);
      }

      if (successfulAttachments.length > 0) {
        mergeAttachmentsForMessage(message.id, successfulAttachments);
      }

      revokePendingFileUrls(filesToUpload);
      setPendingFiles(EMPTY_PENDING_FILES);
      setText("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Send exception:", err);
      setError("An error occurred. Please try again.");
      await cleanupUploadedFiles(uploadedRecords);
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
    <div className="w-full">
      {toastMessage && (
        <div className="mb-4 rounded bg-green-50 p-2 text-sm text-green-700">{toastMessage}</div>
      )}

      <div
        ref={containerRef}
        className="mb-6 max-h-[50vh] space-y-4 overflow-y-auto rounded bg-gray-50 p-4"
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
            const isDeleted = msg.deleted_at !== null;
            const msgAttachments = attachmentsByMessageId[msg.id] || [];

            if (isDeleted) {
              return (
                <div key={msg.id} className={isOwn ? "flex justify-end" : "flex items-start justify-start"}>
                  <div className="max-w-xs rounded-lg bg-gray-100 px-3 py-2 text-sm italic text-gray-500">
                    <p>This message was deleted</p>
                    <div className="mt-1 text-xs text-gray-400">{formatTime(msg.created_at)}</div>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={isOwn ? "flex justify-end gap-1" : "group flex items-start justify-start gap-1"}>
                {isOwn && canSend && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMenuFor(openMenuFor === msg.id ? null : msg.id)}
                      aria-label="Message options"
                      className={`mt-1 rounded p-1 text-blue-400 hover:bg-blue-100 ${
                        openMenuFor === msg.id ? "opacity-100" : "opacity-60 group-hover:opacity-100"
                      }`}
                    >
                      ⋮
                    </button>
                    {openMenuFor === msg.id && (
                      <div className="absolute right-0 top-6 z-10 w-32 rounded border bg-white text-sm shadow-lg">
                        {msg.body && (
                          <button
                            type="button"
                            className="block w-full border-b border-gray-100 px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
                            onClick={() => handleCopyMessage(msg)}
                          >
                            {copiedMessageId === msg.id ? "Copied" : "Copy"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
                          onClick={() => setConfirmDeleteMessageId(msg.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="max-w-xs">
                  {msg.body && (
                    <div className={`rounded-lg px-3 py-2 text-sm ${isOwn ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-900"}`}>
                      <p className="break-words">{msg.body}</p>
                    </div>
                  )}

                  {msgAttachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {msgAttachments.filter((attachment) => attachment.kind === "photo").map((attachment) => {
                        const key = `display:${attachment.bucket}:${attachment.storage_path}`;
                        const signedUrl = signedUrlsByKey[key];

                        return (
                          <button
                            key={attachment.id}
                            type="button"
                            className="block overflow-hidden rounded-md border border-gray-200 bg-white"
                            onClick={async () => {
                              const url = await getSignedUrl(attachment.bucket, attachment.storage_path, attachment.file_name, "display");
                              if (url) setLightboxImage(url);
                            }}
                          >
                            {signedUrl ? (
                              <img
                                src={signedUrl}
                                alt={attachment.file_name}
                                className="h-32 w-56 object-cover"
                                onError={() => handleDisplayUrlError(attachment.bucket, attachment.storage_path)}
                              />
                            ) : (
                              <div className="flex h-32 w-56 items-center justify-center bg-gray-100 text-xs text-gray-500">
                                Loading…
                              </div>
                            )}
                          </button>
                        );
                      })}

                      {msgAttachments.filter((attachment) => attachment.kind === "video").map((attachment) => {
                        const key = `display:${attachment.bucket}:${attachment.storage_path}`;
                        const signedUrl = signedUrlsByKey[key];

                        return (
                          <video
                            key={attachment.id}
                            controls
                            preload="metadata"
                            playsInline
                            className="max-h-60 w-full max-w-xs rounded-md bg-black"
                            src={signedUrl || undefined}
                            onError={() => handleDisplayUrlError(attachment.bucket, attachment.storage_path)}
                          />
                        );
                      })}

                      {msgAttachments.filter((attachment) => attachment.kind === "file").map((attachment) => {
                        const key = `${attachment.bucket}:${attachment.storage_path}`;
                        const signedUrl = signedUrlsByKey[key];

                        return (
                          <div key={attachment.id} className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-800">{attachment.file_name}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(attachment.size_bytes)}</p>
                            </div>
                            <button
                              type="button"
                              className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
                              onClick={async () => {
                                const url = await getSignedUrl(attachment.bucket, attachment.storage_path, attachment.file_name, "download");
                                if (url) window.open(url, "_blank", "noopener,noreferrer");
                              }}
                            >
                              Download
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className={`mt-1 text-xs ${isOwn ? "text-blue-100" : "text-gray-600"}`}>
                    {formatTime(msg.created_at)}
                    {isOwn && <span className="ml-2">{msg.read_at ? "Seen" : "Sent"}</span>}
                  </div>
                </div>
                {!isOwn && !isDeleted && (
                  <div className="relative">
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
                      <div className="absolute left-0 top-6 z-10 w-32 rounded border bg-white text-sm shadow-lg">
                        {msg.body && (
                          <button
                            type="button"
                            className="block w-full border-b border-gray-100 px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
                            onClick={() => handleCopyMessage(msg)}
                          >
                            {copiedMessageId === msg.id ? "Copied" : "Copy"}
                          </button>
                        )}
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
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {lightboxImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightboxImage(null)}>
          <div className="relative max-h-[90vh] max-w-4xl rounded-lg bg-white p-2 shadow-2xl">
            <button
              type="button"
              className="absolute -right-3 -top-3 rounded-full bg-white p-2 text-gray-700 shadow"
              aria-label="Close image"
              onClick={() => setLightboxImage(null)}
            >
              ✕
            </button>
            <img src={lightboxImage} alt="Attachment preview" className="max-h-[85vh] max-w-full rounded-md object-contain" />
          </div>
        </div>
      )}

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

      {confirmDeleteMessageId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">Delete message?</h3>
            <p className="mb-4 text-sm text-gray-600">Delete this message for everyone? This can't be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700"
                onClick={() => setConfirmDeleteMessageId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={deletingMessageId !== null}
                onClick={() => handleDeleteMessage(confirmDeleteMessageId)}
              >
                {deletingMessageId === confirmDeleteMessageId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {canSend ? (
        <div className="space-y-2">
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingFiles.map((pendingFile) => (
                <div key={pendingFile.id} className="relative w-24 rounded-md border border-gray-200 bg-white p-2">
                  <button
                    type="button"
                    aria-label={`Remove ${pendingFile.file.name}`}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-[10px] text-white"
                    onClick={() => handleRemoveFile(pendingFile.id)}
                  >
                    ×
                  </button>
                  {pendingFile.kind === "photo" && pendingFile.previewUrl ? (
                    <img src={pendingFile.previewUrl} alt={pendingFile.file.name} className="h-16 w-full rounded object-cover" />
                  ) : (
                    <div className="flex h-16 w-full items-center justify-center rounded bg-gray-100 text-xl">
                      {pendingFile.kind === "video" ? "🎬" : "📄"}
                    </div>
                  )}
                  <p className="mt-2 truncate text-[10px] text-gray-700">{pendingFile.file.name}</p>
                  <p className="text-[10px] text-gray-500">{formatFileSize(pendingFile.file.size)}</p>
                </div>
              ))}
            </div>
          )}

          {uploadError && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 whitespace-pre-line">{uploadError}</div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Add files"
            >
              📎
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
              onChange={handleAddFiles}
              disabled={sending}
            />

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              placeholder="Type a message..."
              className="flex-1 rounded border p-2 text-sm disabled:opacity-50"
              rows={3}
            />

            <button
              onClick={handleSend}
              disabled={sending || (!text.trim() && pendingFiles.length === 0)}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700"
            >
              {sending ? "Uploading…" : "Send"}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded bg-gray-100 p-4 text-sm text-gray-700">{readOnlyReason}</div>
      )}
    </div>
  );
}

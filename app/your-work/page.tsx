"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import Link from "next/link";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, Play, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/loading-spinner";
import { friendlyDbError } from "@/lib/db-errors";
import MediaViewer from "@/components/media-viewer";
import type { ProviderPortfolioItem } from "@/lib/types";
import { PageHeading } from "@/components/page-heading";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "photos", label: "Photos" },
  { value: "videos", label: "Videos" },
] as const;

const SORT_OPTIONS = [
  { value: "latest", label: "Latest" },
  { value: "oldest", label: "Oldest" },
] as const;

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_PORTFOLIO_ITEMS = 30;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
const ACCEPTED_FILE_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];

type MediaFilter = (typeof FILTERS)[number]["value"];
type SortDirection = (typeof SORT_OPTIONS)[number]["value"];

type PortfolioItem = {
  id: string;
  provider_id?: string;
  media_type: "image" | "video";
  image_url: string;
  caption: string | null;
  description: string | null;
  sort_order: number | null;
  duration_seconds: number | null;
  created_at: string;
};

type StagedPortfolioFile = {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
  media_type: "image" | "video";
  status: "queued" | "uploading" | "success" | "error";
  error: string | null;
  progress: number;
};

function logSupabaseError(context: string, error: { message: string; details?: string; hint?: string; code?: string }) {
  console.error(context, {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAcceptedTypes(types: readonly string[]) {
  return types.map((type) => {
    const subtype = type.split("/")[1] ?? type;
    if (subtype === "jpeg") return "JPEG";
    if (subtype === "png") return "PNG";
    if (subtype === "webp") return "WebP";
    if (subtype === "webm") return "WebM";
    if (subtype === "quicktime") return "QuickTime";
    return subtype.toUpperCase();
  }).join(", ");
}

function validateStagedFile(file: File) {
  const isVideo = ACCEPTED_VIDEO_TYPES.includes(file.type as (typeof ACCEPTED_VIDEO_TYPES)[number]);
  const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number]);

  if (!isImage && !isVideo) {
    return { media_type: "image" as const, error: `Choose a ${formatAcceptedTypes(ACCEPTED_IMAGE_TYPES)} image, or a ${formatAcceptedTypes(ACCEPTED_VIDEO_TYPES)} video.` };
  }

  const limit = isVideo ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;
  const label = isVideo ? "Video" : "Image";

  if (file.size > limit) {
    return {
      media_type: (isVideo ? "video" : "image") as "image" | "video",
      error: `${label} must be less than ${formatFileSize(limit)}.`,
    };
  }

  return {
    media_type: (isVideo ? "video" : "image") as "image" | "video",
    error: null,
  };
}

function SortablePortfolioCard({
  item,
  onDelete,
  onSaveCaption,
  onOpenMedia,
  reorderMode,
}: {
  item: PortfolioItem;
  onDelete: (itemId: string) => Promise<void>;
  onSaveCaption: (itemId: string, nextCaption: string) => Promise<void>;
  onOpenMedia: (itemId: string, trigger: HTMLElement) => void;
  reorderMode: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftCaption, setDraftCaption] = useState(() => item.caption ?? item.description ?? "");

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`overflow-hidden rounded-lg border bg-card ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="relative">
        <button
          type="button"
          onClick={(event) => onOpenMedia(item.id, event.currentTarget)}
          aria-label={`View ${item.media_type === "video" ? "video" : "photo"}`}
          className="group relative block aspect-[4/3] w-full overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:aspect-square"
        >
          {item.media_type === "video" ? (
            <span className="absolute inset-0 grid place-items-center bg-muted text-muted-foreground" aria-hidden="true">
              <span className="flex flex-col items-center gap-1.5">
                <Play className="size-7 fill-current" />
                <span className="text-xs font-medium">Video</span>
              </span>
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt={item.caption || item.description || "Portfolio item"} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          )}
        </button>

        <div className="absolute right-2 top-2 flex max-w-[calc(100%-1rem)] flex-wrap justify-end gap-1.5">
          {reorderMode && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-background/95 px-3 text-xs font-medium text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Reorder portfolio item"
            >
              ⋮⋮
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsEditing((current) => !current)}
            className="inline-flex min-h-11 items-center rounded-full border border-border bg-background/95 px-3 text-xs font-medium text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Edit caption"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Delete this work sample? This action cannot be undone.")) void onDelete(item.id);
            }}
            className="inline-flex min-h-11 items-center rounded-full border border-destructive/30 bg-destructive/10 px-3 text-xs font-medium text-destructive shadow-sm hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Delete portfolio item"
          >
            Delete
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2 p-3">
          <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Caption</label>
          <input
            value={draftCaption}
            maxLength={200}
            onChange={(event) => setDraftCaption(event.target.value)}
            placeholder="Add a note for this project"
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-0"
          />
          {draftCaption.length > 160 && (
            <p className="text-right text-xs text-muted-foreground">{draftCaption.length}/200</p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(false)} className="min-h-11">
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="min-h-11"
              onClick={async () => {
                await onSaveCaption(item.id, draftCaption);
                setIsEditing(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        (item.caption ?? item.description) && (
          <div className="border-t bg-muted/20 p-3">
            <p className="text-sm text-foreground">{item.caption ?? item.description}</p>
          </div>
        )
      )}

    </div>
  );
}

export default function PortfolioPage() {
  const router = useRouter();
  const [providerId, setProviderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [stagedUploads, setStagedUploads] = useState<StagedPortfolioFile[]>([]);
  const [uploadingBatch, setUploadingBatch] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [sortDirection, setSortDirection] = useState<SortDirection>("latest");
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderSnapshot, setReorderSnapshot] = useState<PortfolioItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState<number | null>(null);
  const [mediaViewerTrigger, setMediaViewerTrigger] = useState<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const successToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stagedUploadsRef = useRef<StagedPortfolioFile[]>([]);
  const dragDepthRef = useRef(0);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    stagedUploadsRef.current = stagedUploads;
  }, [stagedUploads]);

  useEffect(() => {
    return () => {
      stagedUploadsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      if (successToastTimerRef.current) clearTimeout(successToastTimerRef.current);
    };
  }, []);

  const sortByCreatedAt = useCallback(
    (list: PortfolioItem[], direction: SortDirection = "latest") =>
      [...list].sort((a, b) => {
        const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return direction === "latest" ? -diff : diff;
      }),
    []
  );

  const loadPortfolioItems = useCallback(async (providerId: string): Promise<PortfolioItem[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("provider_portfolio_items")
      .select("*")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false });
    if (error) logSupabaseError("your work items lookup failed", error);

    return sortByCreatedAt((data ?? []) as PortfolioItem[]);
  }, [sortByCreatedAt]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError && !isAuthSessionMissingError(userError)) logSupabaseError("your work auth lookup failed", userError);

      if (!userData.user) {
        router.push(`/login?redirect=/your-work`);
        return;
      }

      const { data: provider, error: providerError } = await supabase
        .from("providers")
        .select("id")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (providerError) logSupabaseError("your work provider lookup failed", providerError);

      if (!provider) {
        router.replace("/apply");
        return;
      }

      if (mounted) setProviderId(userData.user.id);
      const portfolioItems = await loadPortfolioItems(userData.user.id);

      if (mounted) {
        setItems(portfolioItems);
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [loadPortfolioItems, router]);

  useEffect(() => {
    const handlePullRefresh = () => {
      if (!providerId || loading || uploadingBatch || reorderMode || mediaViewerIndex !== null || stagedUploads.length > 0) return;
      void loadPortfolioItems(providerId).then(setItems);
    };
    window.addEventListener("app:pull-refresh", handlePullRefresh);
    return () => window.removeEventListener("app:pull-refresh", handlePullRefresh);
  }, [loadPortfolioItems, loading, mediaViewerIndex, providerId, reorderMode, stagedUploads.length, uploadingBatch]);

  function stageFiles(files: File[]) {
    if (files.length === 0) return;

    let availableSlots = MAX_PORTFOLIO_ITEMS - items.length - stagedUploads.filter(
      (item) => !item.error && item.status !== "success"
    ).length;
    if (availableSlots <= 0) {
      setError("You've reached the limit of 30 portfolio items.");
      return;
    }

    const selectedEntries: StagedPortfolioFile[] = files.map((file) => {
      const validation = validateStagedFile(file);
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${file.name}`,
        file,
        previewUrl: URL.createObjectURL(file),
        caption: "",
        media_type: validation.media_type,
        status: validation.error ? "error" : "queued",
        error: validation.error,
        progress: 0,
      };
    });
    const newEntries = selectedEntries.filter((entry) => {
      if (entry.error) return true;
      if (availableSlots <= 0) return false;
      availableSlots -= 1;
      return true;
    });

    setStagedUploads((current) => [...current, ...newEntries]);
    setError(newEntries.length < selectedEntries.length ? "You've reached the limit of 30 portfolio items." : null);
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    stageFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFiles(false);
  }

  function handleFileDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    if (uploadingBatch) return;
    stageFiles(Array.from(event.dataTransfer.files));
  }

  function removeStagedFile(fileId: string) {
    setStagedUploads((current) => {
      const file = current.find((item) => item.id === fileId);
      if (file) URL.revokeObjectURL(file.previewUrl);
      return current.filter((item) => item.id !== fileId);
    });
  }

  async function handleUploadStagedFiles() {
    const stagedItemCount = stagedUploads.filter((item) => !item.error && item.status !== "success").length;
    if (items.length >= MAX_PORTFOLIO_ITEMS || items.length + stagedItemCount > MAX_PORTFOLIO_ITEMS) {
      setError("You've reached the limit of 30 portfolio items.");
      return;
    }

    const validFiles = stagedUploads.filter((item) => !item.error && item.status !== "success");
    if (validFiles.length === 0) {
      setError("Add at least one valid file before uploading.");
      return;
    }

    setError(null);
    setSuccess(null);
    setSuccessToast(null);
    setUploadingBatch(true);
    let uploadedCount = 0;

    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError && !isAuthSessionMissingError(userError)) logSupabaseError("your work upload auth lookup failed", userError);
      if (userError && !isAuthSessionMissingError(userError)) logSupabaseError("your work upload auth lookup failed", userError);
      if (!userData.user) {
        setError("Not signed in.");
        return;
      }

      const { data: maxSortData, error: maxSortError } = await supabase
        .from("provider_portfolio_items")
        .select("sort_order")
        .eq("provider_id", userData.user.id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (maxSortError) logSupabaseError("your work sort-order lookup failed", maxSortError);

      let nextSortOrder = typeof maxSortData?.sort_order === "number" ? maxSortData.sort_order + 1 : 1;

      for (const stagedFile of validFiles) {
        setStagedUploads((current) =>
          current.map((item) =>
            item.id === stagedFile.id
              ? { ...item, status: "uploading", progress: 0, error: null }
              : item
          )
        );

        try {
          const extension = stagedFile.file.name.includes(".")
            ? stagedFile.file.name.split(".").pop() || "file"
            : "file";
          const path = `${userData.user.id}/portfolio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${stagedFile.file.name.replace(/\s+/g, "-")}.${extension}`;

          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from("portfolio")
            .createSignedUploadUrl(path, { upsert: false });

          if (signedUrlError) logSupabaseError("your work upload URL creation failed", signedUrlError);
          if (signedUrlError || !signedUrlData?.signedUrl) {
            throw new Error(signedUrlError?.message || "Could not create a signed upload URL.");
          }

          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.onprogress = (event) => {
              if (!event.lengthComputable) return;
              const percent = Math.round((event.loaded / event.total) * 100);
              setStagedUploads((current) =>
                current.map((item) =>
                  item.id === stagedFile.id ? { ...item, progress: percent } : item
                )
              );
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
                return;
              }
              reject(new Error(`Upload failed (${xhr.status})`));
            };

            xhr.onerror = () => reject(new Error("Upload failed due to a network or browser error."));
            xhr.open("PUT", signedUrlData.signedUrl, true);
            xhr.setRequestHeader("Content-Type", stagedFile.file.type || "application/octet-stream");
            xhr.send(stagedFile.file);
          });

          const publicUrl = supabase.storage.from("portfolio").getPublicUrl(path).data.publicUrl;
          const trimmedCaption = stagedFile.caption.trim();

          const { error: insertError } = await supabase.from("provider_portfolio_items").insert({
            provider_id: userData.user.id,
            image_url: publicUrl,
            media_type: stagedFile.media_type,
            caption: trimmedCaption || null,
            description: trimmedCaption || null,
            sort_order: nextSortOrder,
            created_at: new Date().toISOString(),
          });

          if (insertError) {
            logSupabaseError("your work item save failed", insertError);
            throw insertError;
          }

          nextSortOrder += 1;
          uploadedCount += 1;
          setStagedUploads((current) =>
            current.map((item) =>
              item.id === stagedFile.id ? { ...item, status: "success", progress: 100, error: null } : item
            )
          );
        } catch (err: unknown) {
          const message = friendlyDbError(err && typeof err === "object" ? err as { message?: string; code?: string } : null, "Upload failed. Please check your connection and try again.");
          setStagedUploads((current) =>
            current.map((item) =>
              item.id === stagedFile.id
                ? { ...item, status: "error", progress: item.progress, error: message }
                : item
            )
          );
        }
      }

      const refreshedItems = await loadPortfolioItems(userData.user.id);
      setItems(refreshedItems);
      setStagedUploads((current) => current.filter((item) => item.status !== "success"));
      if (uploadedCount > 0) {
        const message = uploadedCount === 1 ? "Your work was uploaded." : `${uploadedCount} work samples were uploaded.`;
        setSuccess(message);
        setSuccessToast(message);
        if (successToastTimerRef.current) clearTimeout(successToastTimerRef.current);
        successToastTimerRef.current = setTimeout(() => setSuccessToast(null), 4500);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setError(message);
    } finally {
      setUploadingBatch(false);
    }
  }

  async function deleteItem(itemId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("provider_portfolio_items").delete().eq("id", itemId);

    if (error) {
      logSupabaseError("your work item delete failed", error);
      setError(error.message);
      return;
    }

    setItems((current) => current.filter((item) => item.id !== itemId));
    setSuccess("Item deleted");
  }

  async function saveCaption(itemId: string, nextCaption: string) {
    const trimmed = nextCaption.trim();
    const supabase = createClient();
    const { error } = await supabase
      .from("provider_portfolio_items")
      .update({ caption: trimmed || null, description: trimmed || null })
      .eq("id", itemId);

    if (error) {
      logSupabaseError("your work caption save failed", error);
      setError(friendlyDbError(error, "Unable to save this caption."));
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, caption: trimmed || null, description: trimmed || null }
          : item
      )
    );
    setSuccess("Caption updated");
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!reorderMode || !over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === String(active.id));
    const newIndex = items.findIndex((item) => item.id === String(over.id));

    if (oldIndex < 0 || newIndex < 0) return;

    setItems((current) => arrayMove(current, oldIndex, newIndex));
  }

  async function handleDoneReorder() {
    const supabase = createClient();
    const { error } = await supabase.rpc("reorder_portfolio_items", {
      p_items: items.map((item, index) => ({ id: item.id, sort_order: index })),
    });

    if (error) {
      logSupabaseError("your work reorder failed", error);
      setError(friendlyDbError(error, "Unable to update your portfolio order."));
      setItems(reorderSnapshot);
      setReorderMode(false);
      setMediaFilter("all");
      return;
    }

    setSuccess("Portfolio order updated");
    setReorderMode(false);
    setMediaFilter("all");
  }

  const visibleItems = useMemo(() => {
    const arranged = reorderMode ? items : sortByCreatedAt(items, sortDirection);
    if (mediaFilter === "all") return arranged;
    return arranged.filter((item) => (mediaFilter === "photos" ? item.media_type !== "video" : item.media_type === "video"));
  }, [items, mediaFilter, reorderMode, sortByCreatedAt, sortDirection]);

  const itemIds = useMemo(() => visibleItems.map((item) => item.id), [visibleItems]);
  const hasValidQueuedFiles = stagedUploads.some((item) => !item.error && item.status !== "success");
  const viewerItems = useMemo<ProviderPortfolioItem[]>(() => visibleItems.map((item) => ({
    id: item.id,
    image_url: item.image_url,
    media_type: item.media_type,
    caption: item.caption,
    description: item.description,
    created_at: item.created_at,
  })), [visibleItems]);

  function openMedia(itemId: string, trigger: HTMLElement) {
    const index = visibleItems.findIndex((item) => item.id === itemId);
    if (index < 0) return;
    setMediaViewerTrigger(trigger);
    setMediaViewerIndex(index);
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size={8} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-0 pb-10">
      <PageHeading title="Your work" description="Photos and videos of your past projects. Customers see them on your profile." />

      <div
        onDragEnter={handleDragEnter}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
        onDragLeave={handleDragLeave}
        onDrop={handleFileDrop}
        className={`mb-8 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm transition-colors motion-reduce:transition-none sm:p-6 ${isDraggingFiles ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border"}`}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Add photos or videos of your work</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatAcceptedTypes(ACCEPTED_IMAGE_TYPES)} images up to {formatFileSize(MAX_IMAGE_SIZE_BYTES)} each; {formatAcceptedTypes(ACCEPTED_VIDEO_TYPES)} videos up to {formatFileSize(MAX_VIDEO_SIZE_BYTES)} each.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => hasValidQueuedFiles ? void handleUploadStagedFiles() : fileInputRef.current?.click()}
            disabled={uploadingBatch}
            className="min-h-11 w-full rounded-full text-base sm:w-auto sm:min-w-32"
          >
            {uploadingBatch ? "Uploading…" : "Upload"}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              id="portfolio-upload-files"
              accept={ACCEPTED_FILE_TYPES.join(",")}
              multiple
              onChange={handleFileSelection}
              disabled={uploadingBatch}
              className="sr-only"
            />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingBatch} className="inline-flex min-h-11 items-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">Choose more files</button>
          </div>

          {stagedUploads.length > 0 && (
            <div aria-label="Selected files" className="space-y-3">
              {stagedUploads.map((item) => (
                <div key={item.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {item.media_type === "video" ? (
                        <span className="absolute inset-0 grid place-items-center bg-muted text-muted-foreground" aria-hidden="true"><span className="flex flex-col items-center gap-1"><Play className="size-6 fill-current" /><span className="text-[10px] font-medium">Video</span></span></span>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-all text-sm font-medium text-foreground">{item.file.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.media_type === "video" ? "Video" : "Photo"} · {formatFileSize(item.file.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStagedFile(item.id)}
                          disabled={uploadingBatch || item.status === "uploading"}
                          aria-label={`Remove ${item.file.name}`}
                          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <X aria-hidden="true" className="size-4" />
                        </button>
                      </div>

                      <input
                        value={item.caption}
                        maxLength={200}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setStagedUploads((current) =>
                            current.map((entry) =>
                              entry.id === item.id ? { ...entry, caption: nextValue } : entry
                            )
                          );
                        }}
                        placeholder="Caption this file"
                        disabled={uploadingBatch || item.status === "uploading"}
                        className="mt-2 min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                      />
                      {item.caption.length > 160 && (
                        <p className="mt-1 text-right text-xs text-muted-foreground">{item.caption.length}/200</p>
                      )}

                      {item.error && <p className="mt-2 text-xs text-destructive">{item.error}</p>}

                      {item.status === "uploading" && (
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Uploading</span>
                            <span>{item.progress}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-foreground transition-all motion-reduce:transition-none"
                              style={{ width: `${item.progress}%` }}
                              role="progressbar"
                              aria-label={`Uploading ${item.file.name}`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={item.progress}
                            />
                          </div>
                        </div>
                      )}

                      {item.status === "success" && <p className="mt-2 text-xs font-medium text-primary">Uploaded</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isDraggingFiles && <p role="status" className="rounded-xl border border-dashed border-primary bg-primary/5 p-4 text-center text-sm font-medium text-primary">Drop files to add them to your work samples</p>}
          {!hasValidQueuedFiles && !uploadingBatch && <p className="text-xs text-muted-foreground">Choose files or drop them here to get started, then select Upload.</p>}

          {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {success && <p role="status" className="text-sm text-primary">{success}</p>}
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-medium">Your work ({items.length})</h2>
          <div className="flex items-center gap-2">
            {reorderMode ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    setItems(reorderSnapshot.map((item) => ({ ...item })));
                    setReorderMode(false);
                    setMediaFilter("all");
                    setSuccess("Reorder cancelled");
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" variant="outline" className="min-h-11" onClick={handleDoneReorder}>
                  Done
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setReorderSnapshot(items.map((item) => ({ ...item })));
                  setReorderMode(true);
                }}
              >
                Reorder
              </Button>
            )}
          </div>
        </div>

        {!reorderMode && items.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((option) => {
                const isActive = mediaFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMediaFilter(option.value)}
                    className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive ? "bg-foreground text-background" : ""}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((option) => {
                const isActive = sortDirection === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSortDirection(option.value)}
                    className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive ? "bg-foreground text-background" : ""}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {visibleItems.length === 0 ? (
          <p className="text-muted-foreground">
            {mediaFilter === "all" ? "No items yet. Upload your first work above." : "No matching items in this filter."}
          </p>
        ) : reorderMode ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-3 gap-3">
                {visibleItems.map((item) => (
                  <SortablePortfolioCard
                    key={`${item.id}-${item.caption ?? item.description ?? ""}`}
                    item={item}
                    onDelete={deleteItem}
                    onSaveCaption={saveCaption}
                    onOpenMedia={openMedia}
                    reorderMode={reorderMode}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {visibleItems.map((item) => (
              <SortablePortfolioCard
                key={`${item.id}-${item.caption ?? item.description ?? ""}`}
                item={item}
                onDelete={deleteItem}
                onSaveCaption={saveCaption}
                onOpenMedia={openMedia}
                reorderMode={reorderMode}
              />
            ))}
          </div>
        )}
      </div>

      <MediaViewer
        key={`${mediaViewerIndex ?? "closed"}-${viewerItems[mediaViewerIndex ?? 0]?.id ?? "none"}`}
        open={mediaViewerIndex !== null}
        items={viewerItems}
        providerName="Your work"
        initialIndex={mediaViewerIndex ?? 0}
        trigger={mediaViewerTrigger}
        onClose={() => setMediaViewerIndex(null)}
      />

      <div className="mt-8">
        <Link href="/profile" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to profile
        </Link>
      </div>
      {successToast && (
        <div role="status" aria-live="polite" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-card-foreground shadow-lg">
          {successToast}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/loading-spinner";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "photos", label: "Photos" },
  { value: "videos", label: "Videos" },
] as const;

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;

type MediaFilter = (typeof FILTERS)[number]["value"];

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

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateStagedFile(file: File) {
  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");

  if (!isImage && !isVideo) {
    return { media_type: "image" as const, error: "Only images and videos are allowed." };
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
  reorderMode,
}: {
  item: PortfolioItem;
  onDelete: (itemId: string) => Promise<void>;
  onSaveCaption: (itemId: string, nextCaption: string) => Promise<void>;
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
        {item.media_type === "video" ? (
          <video src={item.image_url} controls className="aspect-square w-full max-h-[180px] object-cover" />
        ) : (
          <img src={item.image_url} alt={item.caption || item.description || "Portfolio item"} className="aspect-square w-full max-h-[180px] object-cover" />
        )}

        {item.media_type === "video" && <Badge className="absolute left-2 top-2">Video</Badge>}

        <div className="absolute right-2 top-2 flex gap-2">
          {reorderMode && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="rounded-full bg-black/70 px-2 py-1 text-xs text-white"
              aria-label="Reorder portfolio item"
            >
              ⋮⋮
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsEditing((current) => !current)}
            className="rounded-full bg-black/70 px-2 py-1 text-xs text-white"
            aria-label="Edit caption"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="rounded-full bg-red-600 px-2 py-1 text-xs text-white"
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
            onChange={(event) => setDraftCaption(event.target.value)}
            placeholder="Add a note for this project"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-0"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
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
  const [loading, setLoading] = useState(true);
  const [isProvider, setIsProvider] = useState(false);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [stagedUploads, setStagedUploads] = useState<StagedPortfolioFile[]>([]);
  const [uploadingBatch, setUploadingBatch] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [reorderMode, setReorderMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const stagedUploadsRef = useRef<StagedPortfolioFile[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    stagedUploadsRef.current = stagedUploads;
  }, [stagedUploads]);

  useEffect(() => {
    return () => {
      stagedUploadsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const sortByCreatedAt = (list: PortfolioItem[]) =>
    [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const sortBySortOrder = (list: PortfolioItem[]) =>
    [...list].sort((a, b) => {
      const left = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const right = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (left !== right) return left - right;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  async function loadPortfolioItems(providerId: string): Promise<PortfolioItem[]> {
    const supabase = createClient();
    const { data } = await supabase
      .from("provider_portfolio_items")
      .select("*")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false });

    return sortByCreatedAt((data ?? []) as PortfolioItem[]);
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push(`/login?redirect=/profile/portfolio`);
        return;
      }

      const { data: provider } = await supabase
        .from("providers")
        .select("id")
        .eq("id", userData.user.id)
        .single();

      if (!provider) {
        router.push("/apply");
        return;
      }

      setIsProvider(true);
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
  }, [router]);

  async function ensureStorageBucket(bucket: "avatars" | "portfolio") {
    const response = await fetch("/api/storage/ensure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bucket }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `Unable to prepare the ${bucket} bucket.`);
    }
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const newEntries: StagedPortfolioFile[] = files.map((file) => {
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

    setStagedUploads((current) => [...current, ...newEntries]);
    event.target.value = "";
  }

  async function handleUploadStagedFiles() {
    const validFiles = stagedUploads.filter((item) => !item.error && item.status !== "success");
    if (validFiles.length === 0) {
      setError("Add at least one valid file before uploading.");
      return;
    }

    setError(null);
    setSuccess(null);
    setUploadingBatch(true);

    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setError("Not signed in.");
        return;
      }

      await ensureStorageBucket("portfolio");

      const { data: maxSortData } = await supabase
        .from("provider_portfolio_items")
        .select("sort_order")
        .eq("provider_id", userData.user.id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

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
            .createSignedUploadUrl(path, 60);

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
            throw new Error(insertError.message);
          }

          nextSortOrder += 1;
          setStagedUploads((current) =>
            current.map((item) =>
              item.id === stagedFile.id ? { ...item, status: "success", progress: 100, error: null } : item
            )
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Upload failed.";
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
      setSuccess("Upload batch finished.");
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
      setError(error.message);
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

    const previous = sortBySortOrder(items);
    const oldIndex = previous.findIndex((item) => item.id === String(active.id));
    const newIndex = previous.findIndex((item) => item.id === String(over.id));

    if (oldIndex < 0 || newIndex < 0) return;

    const reorderedItems = arrayMove(previous, oldIndex, newIndex);
    setItems(reorderedItems);

    const supabase = createClient();
    const { error } = await supabase.rpc("reorder_portfolio_items", {
      p_items: reorderedItems.map((item, index) => ({ id: item.id, sort_order: index })),
    });

    if (error) {
      setError(error.message);
      setItems(previous);
      return;
    }

    setSuccess("Portfolio order updated");
  }

  const visibleItems = useMemo(() => {
    const arranged = reorderMode ? sortBySortOrder(items) : sortByCreatedAt(items);
    if (mediaFilter === "all") return arranged;
    return arranged.filter((item) => (mediaFilter === "photos" ? item.media_type !== "video" : item.media_type === "video"));
  }, [items, mediaFilter, reorderMode]);

  const itemIds = useMemo(() => visibleItems.map((item) => item.id), [visibleItems]);
  const hasValidQueuedFiles = stagedUploads.some((item) => !item.error && item.status !== "success");

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size={8} />
      </div>
    );
  }

  if (!isProvider) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="text-muted-foreground">Only providers can upload portfolio items.</p>
        <Link href="/apply" className="mt-4 inline-block text-blue-600 underline">
          Apply as a provider
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-semibold">Your portfolio</h1>
        <p className="text-muted-foreground">
          Upload photos and videos of your past work. Add a quick caption to show customers what you did.
        </p>
      </div>

      <div className="mb-8 rounded-lg border p-6">
        <h2 className="mb-4 font-medium">Upload your work</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Image or video</label>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileSelection}
              disabled={uploadingBatch}
              className="w-full text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Images (max 10MB) or videos (max 50MB, ~10 seconds)
            </p>
          </div>

          {stagedUploads.length > 0 && (
            <div className="space-y-3">
              {stagedUploads.map((item) => (
                <div key={item.id} className="rounded-md border p-3">
                  <div className="flex gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      {item.media_type === "video" ? (
                        <video src={item.previewUrl} className="h-full w-full object-cover" />
                      ) : (
                        <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-cover" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{item.file.name}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(item.file.size)}</span>
                      </div>

                      <input
                        value={item.caption}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setStagedUploads((current) =>
                            current.map((entry) =>
                              entry.id === item.id ? { ...entry, caption: nextValue } : entry
                            )
                          );
                        }}
                        placeholder="Caption this file"
                        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-0"
                      />

                      {item.error && <p className="mt-2 text-xs text-destructive">{item.error}</p>}

                      {item.status === "uploading" && (
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Uploading</span>
                            <span>{item.progress}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-foreground transition-all"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {item.status === "success" && (
                        <p className="mt-2 text-xs text-green-600">Uploaded</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              onClick={handleUploadStagedFiles}
              disabled={uploadingBatch || !hasValidQueuedFiles}
            >
              {uploadingBatch ? "Uploading..." : "Upload"}
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-medium">Your work ({items.length})</h2>
          <div className="flex items-center gap-2">
            {reorderMode ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReorderMode(false);
                  setItems((current) => sortByCreatedAt(current));
                  setMediaFilter("all");
                }}
              >
                Done
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReorderMode(true);
                  setItems((current) => sortBySortOrder(current));
                }}
              >
                Reorder
              </Button>
            )}
          </div>
        </div>

        {!reorderMode && items.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {FILTERS.map((option) => {
              const isActive = mediaFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMediaFilter(option.value)}
                  className={`rounded-full border px-3 py-1 text-sm ${isActive ? "bg-foreground text-background" : ""}`}
                >
                  {option.label}
                </button>
              );
            })}
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
                reorderMode={reorderMode}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <Link href="/profile" className="text-sm text-blue-600 underline">
          Back to profile
        </Link>
      </div>
    </div>
  );
}

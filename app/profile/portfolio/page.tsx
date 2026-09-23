"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/loading-spinner";

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

function SortablePortfolioCard({
  item,
  onDelete,
  onSaveCaption,
}: {
  item: PortfolioItem;
  onDelete: (itemId: string) => Promise<void>;
  onSaveCaption: (itemId: string, nextCaption: string) => Promise<void>;
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
          <video src={item.image_url} controls className="aspect-square w-full object-cover" />
        ) : (
          <img src={item.image_url} alt={item.caption || item.description || "Portfolio item"} className="aspect-square w-full object-cover" />
        )}

        {item.media_type === "video" && <Badge className="absolute left-2 top-2">Video</Badge>}

        <div className="absolute right-2 top-2 flex gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="rounded-full bg-black/70 px-2 py-1 text-xs text-white"
            aria-label="Reorder portfolio item"
          >
            ⋮⋮
          </button>
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
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function loadPortfolioItems(providerId: string): Promise<PortfolioItem[]> {
    const supabase = createClient();
    const { data } = await supabase
      .from("provider_portfolio_items")
      .select("*")
      .eq("provider_id", providerId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    return ((data ?? []) as PortfolioItem[]).sort((a, b) => {
      const left = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const right = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (left !== right) return left - right;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);
    setUploading(true);

    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setError("Not signed in");
        return;
      }

      await ensureStorageBucket("portfolio");

      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");

      if (!isImage && !isVideo) {
        setError("Only images and videos are allowed");
        return;
      }

      if (isVideo && file.size > 50 * 1024 * 1024) {
        setError("Video must be less than 50MB");
        return;
      }

      if (isImage && file.size > 10 * 1024 * 1024) {
        setError("Image must be less than 10MB");
        return;
      }

      const ext = file.name.includes(".") ? file.name.split(".").pop() || "file" : "file";
      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const path = `${userData.user.id}/portfolio-${uniqueSuffix}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("portfolio").upload(path, file, { upsert: true });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const { data } = supabase.storage.from("portfolio").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      const trimmedCaption = caption.trim();

      const res = await fetch("/api/profile/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: publicUrl,
          media_type: isVideo ? "video" : "image",
          caption: trimmedCaption || null,
          description: trimmedCaption || null,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error || "Failed to save portfolio item.");
        return;
      }

      setSuccess("Work uploaded successfully!");
      setCaption("");
      e.target.value = "";
      setItems(await loadPortfolioItems(userData.user.id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
    } finally {
      setUploading(false);
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
    if (!over || active.id === over.id) return;

    const previous = [...items];
    const oldIndex = previous.findIndex((item) => item.id === String(active.id));
    const newIndex = previous.findIndex((item) => item.id === String(over.id));

    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(previous, oldIndex, newIndex).map((item, index) => ({
      ...item,
      sort_order: index + 1,
      caption: item.caption ?? item.description,
    }));

    setItems(reordered);
    const supabase = createClient();
    const { error } = await supabase.from("provider_portfolio_items").upsert(
      reordered.map((item) => ({
        id: item.id,
        sort_order: item.sort_order,
        caption: item.caption ?? null,
        description: item.caption ?? item.description ?? null,
      })),
      { onConflict: "id" }
    );

    if (error) {
      setError(error.message);
      setItems(previous);
      return;
    }

    setSuccess("Portfolio order updated");
  }

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

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
              onChange={handleFileUpload}
              disabled={uploading}
              className="w-full text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Images (max 10MB) or videos (max 50MB, ~10 seconds)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Caption (optional)</label>
            <input
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Describe this project, material, or result"
              disabled={uploading}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-0"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
        </div>
      </div>

      <div>
        <h2 className="mb-4 font-medium">Your work ({items.length})</h2>

        {items.length === 0 ? (
          <p className="text-muted-foreground">No items yet. Upload your first work above.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {items.map((item) => (
                  <SortablePortfolioCard
                    key={`${item.id}-${item.caption ?? item.description ?? ""}`}
                    item={item}
                    onDelete={deleteItem}
                    onSaveCaption={saveCaption}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
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

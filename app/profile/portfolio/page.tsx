"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import LoadingSpinner from "@/components/loading-spinner";

type PortfolioItem = {
  id: string;
  media_type: "image" | "video";
  image_url: string;
  description: string | null;
  duration_seconds: number | null;
  created_at: string;
};

export default function PortfolioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isProvider, setIsProvider] = useState(false);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push(`/login?redirect=/profile/portfolio`);
        return;
      }

      // Check if user is a provider
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

      // Load existing portfolio items
      const { data: portfolioData } = await supabase
        .from("provider_portfolio_items")
        .select("*")
        .eq("provider_id", userData.user.id)
        .order("created_at", { ascending: false });

      if (mounted) {
        setItems(portfolioData || []);
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

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

      // Upload file
      const ext = file.name.split(".").pop();
      const path = `${userData.user.id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("portfolio")
        .upload(path, file);

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      // Get public URL
      const { data } = supabase.storage.from("portfolio").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      // Create portfolio item in database
      const { error: insertError } = await supabase
        .from("provider_portfolio_items")
        .insert({
          provider_id: userData.user.id,
          image_url: publicUrl,
          media_type: isVideo ? "video" : "image",
          description: description || null,
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      setSuccess("Work uploaded successfully!");
      setDescription("");

      // Reload items
      const { data: portfolioData } = await supabase
        .from("provider_portfolio_items")
        .select("*")
        .eq("provider_id", userData.user.id)
        .order("created_at", { ascending: false });

      setItems(portfolioData || []);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function deleteItem(itemId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("provider_portfolio_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      setError(error.message);
    } else {
      setItems(items.filter((item) => item.id !== itemId));
      setSuccess("Item deleted");
    }
  }

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
          Upload photos and videos of your past work. Add descriptions to showcase your expertise.
        </p>
      </div>

      {/* Upload Form */}
      <div className="mb-8 rounded-lg border p-6">
        <h2 className="mb-4 font-medium">Upload your work</h2>

        <div className="space-y-4">
        <div>
            <label className="block text-sm font-medium mb-2">Image or video</label>
            <input
              id="file-upload-main"
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
            <label className="block text-sm font-medium mb-2">Description (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell customers what this work shows — materials used, challenges solved, etc."
              rows={3}
              disabled={uploading}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <Button
            type="button"
            onClick={() => {
              const input = document.getElementById("file-upload") as HTMLInputElement;
              input?.click();
            }}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>

        <input
          id="file-upload"
          type="file"
          accept="image/*,video/*"
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
        />
      </div>

      {/* Portfolio Grid */}
      <div>
        <h2 className="mb-4 font-medium">Your work ({items.length})</h2>

        {items.length === 0 ? (
          <p className="text-muted-foreground">No items yet. Upload your first work above.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {items.map((item) => (
              <div key={item.id} className="group relative rounded-lg overflow-hidden bg-muted">
                {item.media_type === "video" ? (
                  <video
                    src={item.image_url}
                    controls
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <img
                    src={item.image_url}
                    alt={item.description || "Portfolio item"}
                    className="aspect-square w-full object-cover"
                  />
                )}

                {item.description && (
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="text-sm text-white line-clamp-3">{item.description}</p>
                  </div>
                )}

                <button
                  onClick={() => deleteItem(item.id)}
                  className="absolute right-2 top-2 rounded-full bg-red-600 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  title="Delete"
                >
                  ✕
                </button>

                {item.media_type === "video" && (
                  <Badge className="absolute left-2 top-2">Video</Badge>
                )}
              </div>
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

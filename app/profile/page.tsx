"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const schema = z.object({
  full_name: z.string().min(2),
  phone: z.string().min(6).optional(),
  city: z.enum(["Cuddalore", "Chidambaram"]).optional(),
});

type FormValues = z.infer<typeof schema>;

type Profile = {
  full_name: string | null;
  phone: string | null;
  city: string | null;
  role: string | null;
  avatar_url: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isProvider, setIsProvider] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", phone: "", city: "Cuddalore" },
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push(`/login?redirect=/profile`);
        return;
      }

      const { data: profileData } = await supabase.from("profiles").select("full_name, phone, city, role, avatar_url").eq("id", userData.user.id).single();
      const { data: providerData } = await supabase.from("providers").select("id").eq("id", userData.user.id).single();
      
      if (mounted && profileData) {
        setProfile(profileData);
        form.reset({ full_name: profileData.full_name || "", phone: profileData.phone || "", city: profileData.city || "Cuddalore" });
        setAvatarUrl(profileData.avatar_url);
        setIsAdmin(profileData.role === "admin");
        setIsProvider(!!providerData);
      }
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function onSubmit(values: FormValues) {
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push(`/login?redirect=/profile`);
      return;
    }

    const { error: updateError } = await supabase.from("profiles").upsert({ id: userData.user.id, ...values });
    if (updateError) {
      setError(updateError.message);
    } else {
      router.refresh();
    }
  }

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

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);
    setIsUploading(true);

    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setAvatarError("Not signed in");
        return;
      }

      await ensureStorageBucket("avatars");

      // Upload file to Supabase Storage
      const ext = file.name.split(".").pop();
      // Upload into a folder named with the user's id so RLS/storage policies
      // that restrict by folder (storage.foldername(name))[1] = auth.uid()
      // will work. Example path: <user-id>/avatar.png
      const path = `${userData.user.id}/avatar.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      console.log("upload result:", { uploadData, uploadError });

      if (uploadError) {
        setAvatarError(uploadError.message);
        return;
      }

      // Get public URL
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      // Update profile with avatar URL via server-side route to ensure
      // row-level security (RLS) context is preserved for the current user.
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: publicUrl }),
      });

      const payload = await res.json().catch(() => ({}));
      console.log("/api/profile/avatar response:", { status: res.status, payload });
      if (!res.ok) {
        setAvatarError(payload?.error || "Failed to update profile avatar");
      } else {
        setAvatarUrl(publicUrl);
      }
    } catch (err: any) {
      setAvatarError(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  if (loading) return <div className="p-8">Loading profile…</div>;

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="mb-2 flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Your profile</h1>
        {isAdmin && <Badge variant="secondary">Admin</Badge>}
        {isProvider && <Badge>Provider</Badge>}
      </div>
      <p className="mb-6 text-muted-foreground">Edit your public details.</p>

      {/* Profile Picture Section */}
      <div className="mb-6 rounded-lg border p-4">
        <label className="block text-sm font-medium mb-3">Profile picture</label>
        <div className="flex items-center gap-4">
          <img
            src={avatarUrl || "/placeholder-avatar.png"}
            alt="Profile"
            className="h-20 w-20 rounded-full object-cover bg-muted"
          />
          <div className="flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={uploadAvatar}
              disabled={isUploading}
              className="text-sm"
            />
            {avatarError && <p className="mt-1 text-xs text-destructive">{avatarError}</p>}
            {isUploading && <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>}
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <select className="w-full rounded-md border px-3 py-2 text-sm" {...field}>
                    <option value="Cuddalore">Cuddalore</option>
                    <option value="Chidambaram">Chidambaram</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit">Save</Button>
        </form>
      </Form>

      {isProvider && (
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h2 className="font-medium text-blue-900 mb-2">Share your work</h2>
          <p className="text-sm text-blue-800 mb-4">Upload photos and videos of your past projects to showcase your work.</p>
          <a href="/profile/portfolio" className="inline-block rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700">
            Upload portfolio
          </a>
        </div>
      )}
    </div>
  );
}

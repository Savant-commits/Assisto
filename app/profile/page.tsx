"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { PhoneGateDialog } from "@/components/phone-gate-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { friendlyDbError } from "@/lib/db-errors";
import { isAllowedMapsUrl } from "@/lib/maps";

const schema = z.object({
  full_name: z.string().min(2),
  city: z.enum(["Cuddalore", "Chidambaram"]).optional(),
});

type FormValues = z.infer<typeof schema>;

type Profile = {
  full_name: string | null;
  city: string | null;
  role: string | null;
  avatar_url: string | null;
  user_code: string | null;
  phone_verified_at: string | null;
};

type ProviderListing = {
  headline: string;
  bio: string;
  locality: string;
  maps_url: string;
};

const emptyProviderListing: ProviderListing = {
  headline: "",
  bio: "",
  locality: "",
  maps_url: "",
};

const emptyFormValues: FormValues = {
  full_name: "",
  city: "Cuddalore",
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

function logSupabaseError(context: string, error: { message: string; details?: string; hint?: string; code?: string }) {
  console.error(context, {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });
}

async function resizeAvatar(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The selected image could not be read."));
      image.src = objectUrl;
    });

    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not process the selected image.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const webpBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    if (webpBlob?.type === "image/webp") return webpBlob;

    const jpegBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!jpegBlob) throw new Error("Could not process the selected image.");
    return jpegBlob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isProvider, setIsProvider] = useState(false);
  const [providerListing, setProviderListing] = useState<ProviderListing>(emptyProviderListing);
  const [isSavingListing, setIsSavingListing] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [listingSuccess, setListingSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [phoneVerifiedAt, setPhoneVerifiedAt] = useState<string | null>(null);
  const [isPhoneGateOpen, setIsPhoneGateOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [savedFormValues, setSavedFormValues] = useState<FormValues>(emptyFormValues);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyFormValues,
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError && !isAuthSessionMissingError(userError)) logSupabaseError("profile auth lookup failed", userError);
      if (!userData.user) {
        router.push(`/login?redirect=/profile`);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, city, role, avatar_url, user_code, phone_verified_at")
        .eq("id", userData.user.id)
        .single();
      if (profileError) logSupabaseError("profile details lookup failed", profileError);
      const { data: phoneData, error: phoneError } = await supabase.rpc("get_profile_phone", {
        profile_id: userData.user.id,
      });
      if (phoneError) logSupabaseError("profile phone lookup failed", phoneError);
      const { data: providerData, error: providerError } = await supabase
        .from("providers")
        .select("id, headline, bio, locality, maps_url")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (providerError) logSupabaseError("profile provider lookup failed", providerError);

      if (mounted && profileData) {
        const nextValues: FormValues = {
          full_name: profileData.full_name || "",
          city: profileData.city || "Cuddalore",
        };

        setProfile(profileData);
        setPhoneNumber(phoneData || null);
        setPhoneVerifiedAt(profileData.phone_verified_at);
        setSavedFormValues(nextValues);
        form.reset(nextValues);
        setAvatarUrl(profileData.avatar_url);
        setIsAdmin(profileData.role === "admin");
        setIsProvider(!!providerData);
        if (providerData) {
          setProviderListing({
            headline: providerData.headline ?? "",
            bio: providerData.bio ?? "",
            locality: providerData.locality ?? "",
            maps_url: providerData.maps_url ?? "",
          });
        }
      }
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [form, router]);

  async function onSubmit(values: FormValues) {
    setError(null);
    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError && !isAuthSessionMissingError(userError)) logSupabaseError("profile save auth lookup failed", userError);
    if (!userData.user) {
      router.push(`/login?redirect=/profile`);
      return;
    }

    const { error: updateError } = await supabase.from("profiles").upsert({ id: userData.user.id, ...values });
    if (updateError) {
      logSupabaseError("profile save failed", updateError);
      setError(updateError.message);
    } else {
      setSavedFormValues(values);
      setIsEditing(false);
      router.refresh();
    }
  }

  async function saveProviderListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setListingError(null);
    setListingSuccess(null);

    const headline = providerListing.headline.trim();
    const bio = providerListing.bio.trim();
    const locality = providerListing.locality.trim();
    const mapsUrl = providerListing.maps_url.trim();
    if (mapsUrl && !isAllowedMapsUrl(mapsUrl)) {
      setListingError("Please paste a link from Google Maps (google.com/maps or maps.app.goo.gl).");
      return;
    }

    setIsSavingListing(true);
    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError && !isAuthSessionMissingError(userError)) logSupabaseError("provider listing auth lookup failed", userError);
      if (!userData.user) {
        setListingError("Please sign in again to save your business listing.");
        return;
      }

      const { error: updateError } = await supabase
        .from("providers")
        .update({
          headline: headline || null,
          bio: bio || null,
          locality: locality || null,
          maps_url: mapsUrl || null,
        })
        .eq("id", userData.user.id);

      if (updateError) {
        logSupabaseError("provider listing save failed", updateError);
        setListingError(friendlyDbError(updateError, "Unable to save your business listing."));
        return;
      }

      setProviderListing({ headline, bio, locality, maps_url: mapsUrl });
      setListingSuccess("Business listing saved.");
    } catch (saveError: unknown) {
      setListingError(
        friendlyDbError(
          saveError && typeof saveError === "object" ? saveError as { message?: string; code?: string } : null,
          "Unable to save your business listing."
        )
      );
    } finally {
      setIsSavingListing(false);
    }
  }

  async function refreshPhoneDetails() {
    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError && !isAuthSessionMissingError(userError)) logSupabaseError("phone refresh auth lookup failed", userError);
    if (!userData.user) return;

    const [{ data: phoneData, error: phoneError }, { data: profileData, error: profileError }] = await Promise.all([
      supabase.rpc("get_profile_phone", { profile_id: userData.user.id }),
      supabase.from("profiles").select("phone_verified_at").eq("id", userData.user.id).single(),
    ]);
    if (phoneError) logSupabaseError("phone refresh phone lookup failed", phoneError);
    if (profileError) logSupabaseError("phone refresh profile lookup failed", profileError);
    setPhoneNumber(phoneData || null);
    setPhoneVerifiedAt(profileData?.phone_verified_at || null);
    router.refresh();
  }

  function handleCancelEdit() {
    setError(null);
    form.reset(savedFormValues);
    setIsEditing(false);
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";
    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      setAvatarError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Profile pictures must be 5 MB or smaller.");
      return;
    }

    setAvatarError(null);
    setIsUploading(true);

    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError && !isAuthSessionMissingError(userError)) logSupabaseError("avatar upload auth lookup failed", userError);
      if (!userData.user) {
        setAvatarError("Not signed in");
        return;
      }

      const resizedAvatar = await resizeAvatar(file);
      const ext = resizedAvatar.type === "image/webp" ? "webp" : "jpg";
      // Upload into a folder named with the user's id so RLS/storage policies
      // that restrict by folder (storage.foldername(name))[1] = auth.uid()
      // will work. Example path: <user-id>/avatar.png
      const path = `${userData.user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, resizedAvatar, { upsert: true, contentType: resizedAvatar.type });

      if (uploadError) {
        logSupabaseError("avatar upload failed", uploadError);
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
      if (!res.ok) {
        setAvatarError(payload?.error || "Failed to update profile avatar");
      } else {
        setAvatarUrl(publicUrl);
      }
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : "Upload failed");
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
              accept="image/jpeg,image/png,image/webp"
              onChange={uploadAvatar}
              disabled={isUploading}
              className="text-sm"
            />
            {avatarError && <p className="mt-1 text-xs text-destructive">{avatarError}</p>}
            {isUploading && <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <p className="mb-1 text-sm font-medium text-muted-foreground">Phone</p>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base">{phoneNumber || "Not provided"}</p>
          {phoneVerifiedAt ? (
            <Badge variant="outline" className="border-green-600 text-green-700 dark:text-green-400">
              Verified · {new Date(phoneVerifiedAt).toLocaleDateString()}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-600 text-amber-700 dark:text-amber-400">
              Not verified
            </Badge>
          )}
          {!phoneVerifiedAt && (
            <Button type="button" size="sm" variant="outline" onClick={() => setIsPhoneGateOpen(true)}>
              Verify
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => setIsPhoneGateOpen(true)}>
            Change number
          </Button>
        </div>
      </div>

      {!isEditing ? (
        <div className="space-y-5">
          <div>
            <p className="text-lg font-medium">{profile?.full_name || savedFormValues.full_name || "Not provided"}</p>
            {profile?.user_code ? <p className="mt-1 text-xs text-muted-foreground">#{profile.user_code}</p> : null}
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-muted-foreground">City</p>
            <p className="text-base">{savedFormValues.city || "Not provided"}</p>
          </div>

          <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-lg font-medium">{profile?.full_name || savedFormValues.full_name || "Not provided"}</p>
            {profile?.user_code ? <p className="mt-1 text-xs text-muted-foreground">#{profile.user_code}</p> : null}
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

              <div className="flex items-center gap-2">
                <Button type="submit">Save</Button>
                <Button type="button" variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </>
      )}
      <PhoneGateDialog
        isOpen={isPhoneGateOpen}
        onClose={() => setIsPhoneGateOpen(false)}
        onVerified={() => {
          setIsPhoneGateOpen(false);
          void refreshPhoneDetails();
        }}
        initialPhone={phoneNumber || undefined}
      />
      {isProvider && (
        <section className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-2 font-medium text-blue-900">Categories &amp; services</h2>
          <p className="mb-4 text-sm text-blue-800">Manage which categories and services you offer so customers can find you for the right work.</p>
          <a href="/profile/services" className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Manage services
          </a>
        </section>
      )}
      {isProvider && (
        <section className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-2 font-medium text-blue-900">Your business listing</h2>
          <form onSubmit={saveProviderListing} className="space-y-4">
            <div>
              <label htmlFor="provider-headline" className="mb-1 block text-sm font-medium text-blue-900">Headline</label>
              <Input
                id="provider-headline"
                value={providerListing.headline}
                maxLength={150}
                onChange={(event) => {
                  setProviderListing((current) => ({ ...current, headline: event.target.value }));
                  setListingSuccess(null);
                }}
              />
              {providerListing.headline.length > 120 && (
                <p className="mt-1 text-right text-xs text-blue-800">{providerListing.headline.length}/150</p>
              )}
            </div>
            <div>
              <label htmlFor="provider-bio" className="mb-1 block text-sm font-medium text-blue-900">Bio</label>
              <Textarea
                id="provider-bio"
                value={providerListing.bio}
                maxLength={2000}
                rows={5}
                onChange={(event) => {
                  setProviderListing((current) => ({ ...current, bio: event.target.value }));
                  setListingSuccess(null);
                }}
              />
              {providerListing.bio.length > 1600 && (
                <p className="mt-1 text-right text-xs text-blue-800">{providerListing.bio.length}/2000</p>
              )}
            </div>
            <div>
              <label htmlFor="provider-locality" className="mb-1 block text-sm font-medium text-blue-900">Based at (area or landmark)</label>
              <Input
                id="provider-locality"
                value={providerListing.locality}
                maxLength={150}
                placeholder="Beach Road, Cuddalore"
                onChange={(event) => {
                  setProviderListing((current) => ({ ...current, locality: event.target.value }));
                  setListingSuccess(null);
                }}
              />
              {providerListing.locality.length > 120 && (
                <p className="mt-1 text-right text-xs text-blue-800">{providerListing.locality.length}/150</p>
              )}
            </div>
            <div>
              <label htmlFor="provider-maps-url" className="mb-1 block text-sm font-medium text-blue-900">Google Maps link (optional)</label>
              <Input
                id="provider-maps-url"
                value={providerListing.maps_url}
                maxLength={300}
                onChange={(event) => {
                  setProviderListing((current) => ({ ...current, maps_url: event.target.value }));
                  setListingSuccess(null);
                }}
              />
              {providerListing.maps_url.length > 240 && (
                <p className="mt-1 text-right text-xs text-blue-800">{providerListing.maps_url.length}/300</p>
              )}
            </div>
            {listingError && <p className="text-sm text-destructive" role="alert">{listingError}</p>}
            {listingSuccess && <p className="text-sm text-green-800" role="status">{listingSuccess}</p>}
            <Button type="submit" disabled={isSavingListing}>
              {isSavingListing ? "Saving…" : "Save business listing"}
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}

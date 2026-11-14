"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
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
import { CITY_CENTERS, DEFAULT_MAP_CENTER } from "@/lib/maps";
import { LocationMap } from "@/components/map/location-map";
import { LocationPicker } from "@/components/map/location-picker";
import { Avatar } from "@/components/avatar";
import { PrivateProfileAddress } from "@/components/profile/private-address";
import { usePhoneVerificationRequired } from "@/components/phone-verification-required-context";

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
  lat: number | null;
  lng: number | null;
};

const emptyProviderListing: ProviderListing = {
  headline: "",
  bio: "",
  locality: "",
  lat: null,
  lng: null,
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
  const phoneVerificationRequired = usePhoneVerificationRequired();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isProvider, setIsProvider] = useState(false);
  const [providerListing, setProviderListing] = useState<ProviderListing>(emptyProviderListing);
  const [savedProviderListing, setSavedProviderListing] = useState<ProviderListing>(emptyProviderListing);
  const [providerLocationLabel, setProviderLocationLabel] = useState<{ coordinates: string; label: string } | null>(null);
  const [isSavingListing, setIsSavingListing] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [listingSuccess, setListingSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [phoneVerifiedAt, setPhoneVerifiedAt] = useState<string | null>(null);
  const [isPhoneGateOpen, setIsPhoneGateOpen] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [activeEditor, setActiveEditor] = useState<"identity" | "address" | "provider" | null>(null);
  const [savedFormValues, setSavedFormValues] = useState<FormValues>(emptyFormValues);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const isEditing = activeEditor === "identity";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyFormValues,
  });

  useEffect(() => {
    if (providerListing.lat === null || providerListing.lng === null) return;

    const controller = new AbortController();
    const coordinates = `${providerListing.lat},${providerListing.lng}`;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(String(providerListing.lat))}&lng=${encodeURIComponent(String(providerListing.lng))}`, {
          signal: controller.signal,
        });
        const payload = await response.json() as { location?: { formattedLabel?: string; label?: string } | null };
        if (response.ok && !controller.signal.aborted) {
          const label = payload.location?.formattedLabel || payload.location?.label;
          if (label) setProviderLocationLabel({ coordinates, label });
        }
      } catch {
        // The saved coordinates remain visible even if reverse geocoding is unavailable.
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [providerListing.lat, providerListing.lng]);

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
      if (mounted) setProfileId(userData.user.id);

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
        .select("id, headline, bio, locality, lat, lng")
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
          const listing = {
            headline: providerData.headline ?? "",
            bio: providerData.bio ?? "",
            locality: providerData.locality ?? "",
            lat: providerData.lat ?? null,
            lng: providerData.lng ?? null,
          };
          setProviderListing(listing);
          setSavedProviderListing(listing);
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
      setActiveEditor(null);
      router.refresh();
    }
  }

  async function saveProviderListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeEditor !== "provider") return;
    setListingError(null);
    setListingSuccess(null);

    const headline = providerListing.headline.trim();
    const bio = providerListing.bio.trim();
    const locality = providerListing.locality.trim();

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
        })
        .eq("id", userData.user.id);

      if (updateError) {
        logSupabaseError("provider listing save failed", updateError);
        setListingError(friendlyDbError(updateError, "Unable to save your business listing."));
        return;
      }

      setProviderListing((current) => ({
        ...current,
        headline,
        bio,
        locality,
      }));
      setSavedProviderListing((current) => ({ ...current, headline, bio, locality }));
      setListingSuccess("Business listing saved.");
      setActiveEditor(null);
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

  async function saveProviderLocation(nextLocation: { lat: number; lng: number }) {
    setListingError(null);
    setListingSuccess(null);

    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError && !isAuthSessionMissingError(userError)) logSupabaseError("provider location auth lookup failed", userError);
      if (!userData.user) {
        setListingError("Please sign in again to save your business location.");
        return;
      }

      const { error: updateError } = await supabase
        .from("providers")
        .update({
          lat: nextLocation.lat,
          lng: nextLocation.lng,
        })
        .eq("id", userData.user.id);

      if (updateError) {
        logSupabaseError("provider location save failed", updateError);
        setListingError(friendlyDbError(updateError, "Unable to save your business location."));
        return;
      }

      setProviderListing((current) => ({
        ...current,
        lat: nextLocation.lat,
        lng: nextLocation.lng,
      }));
      setSavedProviderListing((current) => ({
        ...current,
        lat: nextLocation.lat,
        lng: nextLocation.lng,
      }));
      setListingSuccess("Business location saved.");
      setIsLocationPickerOpen(false);
    } catch (saveError: unknown) {
      setListingError(
        friendlyDbError(
          saveError && typeof saveError === "object" ? saveError as { message?: string; code?: string } : null,
          "Unable to save your business location."
        )
      );
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
    setActiveEditor(null);
  }

  function handleCancelProviderEdit() {
    setListingError(null);
    setListingSuccess(null);
    setProviderListing(savedProviderListing);
    setActiveEditor(null);
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

  if (loading) return (
    <main aria-label="Loading profile" aria-busy="true" className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8 md:px-6">
      <div className="h-10 w-48 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2].map((item) => <div key={item} className="min-h-44 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />)}
      </div>
    </main>
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 pb-[calc(var(--bottom-nav-height)+2rem+env(safe-area-inset-bottom))] md:px-6 md:py-10">
      <header className="mb-6 sm:mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl">Your profile</h1>
          {isAdmin && <Badge variant="secondary">Admin</Badge>}
          {isProvider && <Badge>Provider</Badge>}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Manage your public details and private address.</p>
      </header>

      <div className="grid items-start gap-4 md:grid-cols-2 md:gap-5">
        <section aria-labelledby="identity-heading" className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 id="identity-heading" className="font-display text-xl">Identity</h2>
              <p className="mt-1 text-xs font-medium text-muted-foreground">Public details</p>
            </div>
            {!isEditing && <Button type="button" variant="outline" className="min-h-11 shrink-0" disabled={activeEditor !== null} onClick={() => {
              form.reset(savedFormValues);
              setError(null);
              setActiveEditor("identity");
            }}>Edit</Button>}
          </div>

          <div className="mb-5 flex items-center gap-4">
            <Avatar
              src={avatarUrl}
              name={profile?.full_name || savedFormValues.full_name || "Profile"}
              size={80}
              className="size-20 rounded-full border border-border bg-muted object-cover text-2xl text-muted-foreground"
            />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-foreground">{profile?.full_name || savedFormValues.full_name || "Name not provided"}</p>
              {profile?.user_code && <span className="mt-1 inline-flex min-h-7 items-center rounded-full border border-border bg-muted/50 px-3 text-xs font-medium text-muted-foreground">ID · {profile.user_code}</span>}
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={isUploading} className="sr-only" aria-label="Choose a profile photo" />
              <Button type="button" variant="outline" className="mt-2 min-h-11" disabled={isUploading || activeEditor !== null} onClick={() => avatarInputRef.current?.click()}>
                {isUploading ? "Uploading…" : "Change photo"}
              </Button>
              {avatarError && <p role="alert" className="mt-2 text-xs text-destructive">{avatarError}</p>}
            </div>
          </div>

          {isEditing ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 border-t border-border pt-4">
                <FormField control={form.control} name="full_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl><Input {...field} className="min-h-11" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <select className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...field}>
                        <option value="Cuddalore">Cuddalore</option>
                        <option value="Chidambaram">Chidambaram</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="submit" className="min-h-11" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving…" : "Save"}</Button>
                  <Button type="button" variant="outline" className="min-h-11" onClick={handleCancelEdit} disabled={form.formState.isSubmitting}>Cancel</Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Name</span><span className="truncate font-medium">{savedFormValues.full_name || "Not provided"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">City</span><span className="font-medium">{savedFormValues.city || "Not provided"}</span></div>
            </div>
          )}
        </section>

        <section aria-labelledby="contact-heading" className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <h2 id="contact-heading" className="font-display text-xl">Contact</h2>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Private account contact</p>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">Phone</p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-base font-medium">{phoneNumber || "Not provided"}</p>
            {phoneVerificationRequired && (phoneVerifiedAt ? (
              <Badge variant="outline" className="border-primary/40 text-primary">Verified · {new Date(phoneVerifiedAt).toLocaleDateString()}</Badge>
            ) : (
              <Badge variant="outline" className="border-border text-muted-foreground">Not verified</Badge>
            ))}
            {phoneVerificationRequired && !phoneVerifiedAt && <Button type="button" variant="outline" className="min-h-11" disabled={activeEditor !== null} onClick={() => setIsPhoneGateOpen(true)}>Verify</Button>}
            <Button type="button" variant="outline" className="min-h-11" disabled={activeEditor !== null} onClick={() => setIsPhoneGateOpen(true)}>Change number</Button>
          </div>
        </section>

        {profileId && <div className="md:col-span-2">
          <PrivateProfileAddress
            profileId={profileId}
            isEditing={activeEditor === "address"}
            canEdit={activeEditor === null || activeEditor === "address"}
            onEdit={() => setActiveEditor("address")}
            onCancel={() => setActiveEditor(null)}
            onSaved={() => setActiveEditor(null)}
          />
        </div>}

        {isProvider && (() => {
          const providerCity = profile?.city || savedFormValues.city || "Cuddalore";
          const cityCenter = providerCity in CITY_CENTERS ? CITY_CENTERS[providerCity as keyof typeof CITY_CENTERS] : DEFAULT_MAP_CENTER;
          const hasLocation = providerListing.lat !== null && providerListing.lng !== null;
          const isEditingProvider = activeEditor === "provider";

          return (
            <section aria-labelledby="provider-heading" className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm md:col-span-2 sm:p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="provider-heading" className="font-display text-xl">Provider listing</h2>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">Public business details and location</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href="/profile/services" className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Manage services</a>
                  {!isEditingProvider && <Button type="button" variant="outline" className="min-h-11" disabled={activeEditor !== null} onClick={() => { setProviderListing(savedProviderListing); setListingError(null); setListingSuccess(null); setActiveEditor("provider"); }}>Edit</Button>}
                </div>
              </div>

              <form onSubmit={saveProviderListing} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="provider-headline" className="mb-1 block text-sm font-medium">Headline</label>
                    <Input id="provider-headline" value={providerListing.headline} maxLength={150} readOnly={!isEditingProvider} onChange={(event) => { setProviderListing((current) => ({ ...current, headline: event.target.value })); setListingSuccess(null); }} className="min-h-11 read-only:border-transparent read-only:bg-muted/40 read-only:px-0" />
                    {isEditingProvider && providerListing.headline.length > 120 && <p className="mt-1 text-right text-xs text-muted-foreground">{providerListing.headline.length}/150</p>}
                  </div>
                  <div>
                    <label htmlFor="provider-locality" className="mb-1 block text-sm font-medium">Based at (area or landmark)</label>
                    <Input id="provider-locality" value={providerListing.locality} maxLength={150} placeholder="Beach Road, Cuddalore" readOnly={!isEditingProvider} onChange={(event) => { setProviderListing((current) => ({ ...current, locality: event.target.value })); setListingSuccess(null); }} className="min-h-11 read-only:border-transparent read-only:bg-muted/40 read-only:px-0" />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="provider-bio" className="mb-1 block text-sm font-medium">Bio</label>
                    <Textarea id="provider-bio" value={providerListing.bio} maxLength={2000} rows={4} readOnly={!isEditingProvider} onChange={(event) => { setProviderListing((current) => ({ ...current, bio: event.target.value })); setListingSuccess(null); }} className="read-only:resize-none read-only:border-transparent read-only:bg-muted/40 read-only:px-0" />
                    {isEditingProvider && providerListing.bio.length > 1600 && <p className="mt-1 text-right text-xs text-muted-foreground">{providerListing.bio.length}/2000</p>}
                  </div>
                </div>
                {isEditingProvider && (
                  <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                    <Button type="submit" className="min-h-11" disabled={isSavingListing}>{isSavingListing ? "Saving…" : "Save"}</Button>
                    <Button type="button" variant="outline" className="min-h-11" onClick={handleCancelProviderEdit} disabled={isSavingListing}>Cancel</Button>
                  </div>
                )}
              </form>

              <div className="mt-5 border-t border-border pt-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Business location</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Your business pin is public on your profile.</p>
                  </div>
                  <Button type="button" variant="outline" className="min-h-11" disabled={activeEditor !== null} onClick={() => setIsLocationPickerOpen(true)}>{hasLocation ? "Change location" : "Set location"}</Button>
                </div>
                {providerLocationLabel?.coordinates === `${providerListing.lat},${providerListing.lng}` && <p className="mb-2 truncate text-sm text-muted-foreground" title={providerLocationLabel.label}>{providerLocationLabel.label}</p>}
                {hasLocation ? (
                  <LocationMap lat={providerListing.lat!} lng={providerListing.lng!} height={240} />
                ) : (
                  <>
                    <LocationMap lat={cityCenter.lat} lng={cityCenter.lng} height={240} />
                    <p className="text-sm text-muted-foreground">No business location set yet.</p>
                  </>
                )}
                <p className="mt-3 text-xs text-muted-foreground">For privacy, place a public pin at your shop or office rather than your home.</p>
              </div>

              {listingError && <p className="mt-4 text-sm text-destructive" role="alert">{listingError}</p>}
              {listingSuccess && <p className="mt-4 text-sm text-primary" role="status">{listingSuccess}</p>}

              <LocationPicker
                open={isLocationPickerOpen}
                onOpenChange={setIsLocationPickerOpen}
                initial={hasLocation ? { lat: providerListing.lat!, lng: providerListing.lng! } : null}
                fallbackCenter={cityCenter}
                title="Business location"
                confirmLabel="Confirm"
                onConfirm={saveProviderLocation}
              />
            </section>
          );
        })()}
      </div>

      <PhoneGateDialog
        isOpen={isPhoneGateOpen}
        onClose={() => setIsPhoneGateOpen(false)}
        onVerified={() => {
          setIsPhoneGateOpen(false);
          void refreshPhoneDetails();
        }}
        initialPhone={phoneNumber || undefined}
        bypassWhenVerificationDisabled={false}
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
      {isProvider && (() => {
        const providerCity = profile?.city || savedFormValues.city || "Cuddalore";
        const cityCenter = providerCity in CITY_CENTERS ? CITY_CENTERS[providerCity as keyof typeof CITY_CENTERS] : DEFAULT_MAP_CENTER;
        const hasLocation = providerListing.lat !== null && providerListing.lng !== null;

        return (
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

              <div className="space-y-3">
                <h3 className="text-sm font-medium text-blue-900">Business location</h3>
                {providerLocationLabel?.coordinates === `${providerListing.lat},${providerListing.lng}` && (
                  <p className="truncate text-sm text-blue-900" title={providerLocationLabel.label}>{providerLocationLabel.label}</p>
                )}
                {hasLocation ? (
                  <LocationMap lat={providerListing.lat!} lng={providerListing.lng!} height={220} />
                ) : (
                  <>
                    <LocationMap lat={cityCenter.lat} lng={cityCenter.lng} height={220} />
                    <p className="text-sm text-blue-800">No location set yet</p>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setIsLocationPickerOpen(true)}
                  className="rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-white"
                >
                  {hasLocation ? "Change location" : "Set location"}
                </button>
                <p className="text-xs text-blue-800">Your pin is public on your profile. If you prefer privacy, place it at your shop or office rather than your home.</p>
              </div>

              {listingError && <p className="text-sm text-destructive" role="alert">{listingError}</p>}
              {listingSuccess && <p className="text-sm text-green-800" role="status">{listingSuccess}</p>}
              <Button type="submit" disabled={isSavingListing}>
                {isSavingListing ? "Saving…" : "Save business listing"}
              </Button>
            </form>

            <LocationPicker
              open={isLocationPickerOpen}
              onOpenChange={setIsLocationPickerOpen}
              initial={hasLocation ? { lat: providerListing.lat!, lng: providerListing.lng! } : null}
              fallbackCenter={cityCenter}
              title="Business location"
              confirmLabel="Confirm"
              onConfirm={saveProviderLocation}
            />
          </section>
        );
      })()}
    </main>
  );
}

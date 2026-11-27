"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
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
import { ProviderSummaryCard } from "@/components/profile/provider-summary-card";
import { usePhoneVerificationRequired } from "@/components/phone-verification-required-context";
import { PageHeading } from "@/components/page-heading";
import ThemeToggle from "@/components/theme-toggle";
import { SettingsLogOutButton, SettingsSignInButton } from "@/components/settings-account-actions";
import AdminLink from "@/components/shell/admin-link";

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
  business_name: string;
  headline: string;
  bio: string;
  locality: string;
  lat: number | null;
  lng: number | null;
  years_experience: number | null;
  service_edit_credits: number;
  categories: string[];
};

const emptyProviderListing: ProviderListing = {
  business_name: "",
  headline: "",
  bio: "",
  locality: "",
  lat: null,
  lng: null,
  years_experience: null,
  service_edit_credits: 0,
  categories: [],
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

async function resizeAvatar(file: File): Promise<Blob | null> {
  let bitmap: ImageBitmap | null = null;
  let image: HTMLImageElement | null = null;
  let objectUrl: string | null = null;

  try {
    let width: number;
    let height: number;
    try {
      bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
    } catch {
      objectUrl = URL.createObjectURL(file);
      image = new Image();
      await new Promise<void>((resolve, reject) => {
        image!.onload = () => resolve();
        image!.onerror = () => reject(new Error("The selected image could not be read."));
        image!.src = objectUrl!;
      });
      width = image.naturalWidth;
      height = image.naturalHeight;
    }

    if (!width || !height) return null;
    const scale = Math.min(1, 512 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    if (bitmap) context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    else if (image) context.drawImage(image, 0, 0, canvas.width, canvas.height);
    else return null;

    const toBlob = (type: string) => new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob(resolve, type, 0.85);
      } catch {
        resolve(null);
      }
    });
    const webpBlob = await toBlob("image/webp");
    if (webpBlob?.type === "image/webp") return webpBlob;
    const jpegBlob = await toBlob("image/jpeg");
    return jpegBlob?.type === "image/jpeg" ? jpegBlob : null;
  } catch {
    return null;
  } finally {
    bitmap?.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export default function ProfilePage() {
  const phoneVerificationRequired = usePhoneVerificationRequired();
  const pathname = usePathname();
  const router = useRouter();
  const isProviderHubRoute = pathname === "/profile/provider";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isProvider, setIsProvider] = useState<boolean | null>(null);
  const [providerLookupError, setProviderLookupError] = useState<string | null>(null);
  const [providerListing, setProviderListing] = useState<ProviderListing>(emptyProviderListing);
  const [savedProviderListing, setSavedProviderListing] = useState<ProviderListing>(emptyProviderListing);
  const [providerBaseCity, setProviderBaseCity] = useState<string | null>(null);
  const [providerLocationLabel, setProviderLocationLabel] = useState<{ coordinates: string; label: string } | null>(null);
  const [isSavingListing, setIsSavingListing] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [listingSuccess, setListingSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState("");
  const [guestSettings, setGuestSettings] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [phoneVerifiedAt, setPhoneVerifiedAt] = useState<string | null>(null);
  const [isPhoneGateOpen, setIsPhoneGateOpen] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [activeEditor, setActiveEditor] = useState<"identity" | "address" | "provider" | null>(null);
  const [savedFormValues, setSavedFormValues] = useState<FormValues>(emptyFormValues);
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
        if (!isProviderHubRoute) {
          setGuestSettings(true);
          setLoading(false);
          return;
        }
        setLoading(false);
        router.push(`/login?redirect=${encodeURIComponent(isProviderHubRoute ? "/profile/provider" : "/profile")}`);
        return;
      }
      if (mounted) {
        setProfileId(userData.user.id);
        setAccountEmail(userData.user.email ?? "");
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
        .select("id, city, business_name, headline, bio, locality, lat, lng, years_experience, service_edit_credits, provider_categories ( service_categories ( name ) )")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (providerError) logSupabaseError("profile provider lookup failed", providerError);

      if (!mounted) return;
      if (providerError) {
        setProviderLookupError("Unable to verify provider access right now. Reload to try again.");
      } else {
        setIsProvider(!!providerData);
        setProviderBaseCity(typeof providerData?.city === "string" ? providerData.city.trim() || null : null);
      }

      if (profileData) {
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
      }
      if (providerData) {
        const listing = {
          business_name: providerData.business_name ?? "",
          headline: providerData.headline ?? "",
          bio: providerData.bio ?? "",
          locality: providerData.locality ?? "",
          lat: providerData.lat ?? null,
          lng: providerData.lng ?? null,
          years_experience: providerData.years_experience ?? null,
          service_edit_credits: providerData.service_edit_credits ?? 0,
          categories: (providerData.provider_categories ?? []).flatMap((providerCategory) => {
            const serviceCategory = Array.isArray(providerCategory.service_categories)
              ? providerCategory.service_categories[0]
              : providerCategory.service_categories;
            return serviceCategory?.name ? [serviceCategory.name] : [];
          }),
        };
        setProviderListing(listing);
        setSavedProviderListing(listing);
      }
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [form, isProviderHubRoute, router]);

  useEffect(() => {
    if (!loading && isProviderHubRoute && isProvider === false) router.replace("/profile");
  }, [isProvider, isProviderHubRoute, loading, router]);

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

    const businessName = providerListing.business_name.trim();
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
          business_name: businessName || null,
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
        business_name: businessName,
        headline,
        bio,
        locality,
      }));
      setSavedProviderListing((current) => ({ ...current, business_name: businessName, headline, bio, locality }));
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

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    let previewUrl: string | null = null;
    let failureStep: "validate" | "storage" = "validate";

    const reportFailure = (step: "auth" | "validate" | "storage" | "profile-update", message: string) => {
      const formattedMessage = `Upload failed (${step}): ${message}`;
      console.error(formattedMessage);
      setAvatarError(formattedMessage);
      setAvatarStatus(null);
    };

    setAvatarError(null);
    try {
      if (!file) {
        reportFailure("validate", "No image was selected. Please choose a photo.");
        return;
      }
      if (!AVATAR_MIME_TYPES.includes(file.type)) {
        reportFailure("validate", "Choose a JPEG, PNG, or WebP image.");
        return;
      }
      if (file.size === 0 || file.size > MAX_AVATAR_BYTES) {
        reportFailure("validate", "Choose an image that is larger than 0 bytes and no more than 5 MB.");
        return;
      }

      previewUrl = URL.createObjectURL(file);
      setAvatarPreviewUrl(previewUrl);
      const fileSizeKb = Math.max(1, Math.round(file.size / 1024));
      const selectedStatus = `Selected: ${file.name} (${fileSizeKb} KB, ${file.type})`;
      setAvatarStatus(`${selectedStatus} — Preparing`);
      setIsUploading(true);

      const resizedAvatar = await resizeAvatar(file);
      let uploadBlob = resizedAvatar;
      if (!uploadBlob || uploadBlob.size > 4 * 1024 * 1024) {
        if (file.size <= 4 * 1024 * 1024) {
          uploadBlob = file;
        } else {
          reportFailure("validate", "Could not process this image. Try a smaller JPEG or PNG.");
          return;
        }
      }

      const extension = uploadBlob.type === "image/webp" ? "webp" : uploadBlob.type === "image/png" ? "png" : "jpg";
      const formData = new FormData();
      formData.append("file", uploadBlob, `avatar.${extension}`);
      failureStep = "storage";
      setAvatarStatus(`${selectedStatus} — Uploading`);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const payload = await res.json().catch(() => null) as { error?: string; step?: "auth" | "validate" | "storage" | "profile-update"; code?: string | number | null; url?: string } | null;
      if (!res.ok) {
        reportFailure(payload?.step ?? "storage", payload?.error ?? `The server returned status ${res.status}.`);
        return;
      }
      if (typeof payload?.url !== "string" || payload.url.length === 0) {
        reportFailure("profile-update", "The server did not return the saved avatar URL.");
        return;
      }

      setAvatarUrl(payload.url);
      setAvatarPreviewUrl(null);
      setAvatarStatus(`${selectedStatus} — Done`);
      router.refresh();
    } catch (err: unknown) {
      reportFailure(failureStep, err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsUploading(false);
      input.value = "";
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setAvatarPreviewUrl((current) => current === previewUrl ? null : current);
      }
    }
  }

  if (loading) return isProviderHubRoute ? (
    <main aria-label="Loading provider hub" aria-busy="true" className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <div className="mb-4 h-10 w-48 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <p className="mb-4 text-sm text-muted-foreground">Manage how customers see your business.</p>
      <div className="space-y-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="min-h-36 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />)}
      </div>
    </main>
  ) : (
    <main aria-label="Loading profile" aria-busy="true" className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8 md:px-6">
      <div className="h-10 w-48 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2].map((item) => <div key={item} className="min-h-44 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />)}
      </div>
    </main>
  );

  if (guestSettings) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 pt-0 pb-[calc(var(--bottom-nav-height)+2rem+env(safe-area-inset-bottom))] md:px-6">
        <PageHeading title="Your profile" />
        <section aria-labelledby="settings" className="space-y-5 border-t border-border pt-6">
          <h2 id="settings" className="font-display text-2xl font-medium text-foreground">Settings</h2>
          <section aria-labelledby="appearance-heading" className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
            <h3 id="appearance-heading" className="mb-2 text-lg font-semibold text-foreground">Appearance</h3>
            <p className="mb-5 text-sm text-muted-foreground">Choose a light or dark theme, or follow your device setting.</p>
            <ThemeToggle />
          </section>
          <section aria-labelledby="account-heading" className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
            <h3 id="account-heading" className="mb-4 text-lg font-semibold text-foreground">Account</h3>
            <p className="mb-4 text-sm text-muted-foreground">You&apos;re browsing as a guest</p>
            <div className="flex flex-wrap items-center gap-3">
              <SettingsSignInButton />
              <Link href="/signup?redirect=%2Fprofile%23settings" className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Create account</Link>
            </div>
          </section>
        </section>
      </main>
    );
  }

  if (isProviderHubRoute && isProvider === null) {
    if (providerLookupError) {
      return (
        <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
          <section role="alert" className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <PageHeading title="Provider hub" className="mb-0 pt-0" />
            <p className="mt-2 text-sm text-muted-foreground">{providerLookupError}</p>
            <Button type="button" variant="outline" className="mt-4 min-h-11" onClick={() => window.location.reload()}>Reload</Button>
          </section>
        </main>
      );
    }
    return (
      <main aria-label="Loading provider hub" aria-busy="true" className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
        <div className="mb-4 h-10 w-48 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <p className="mb-4 text-sm text-muted-foreground">Manage how customers see your business.</p>
        <div className="space-y-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="min-h-36 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />)}
        </div>
      </main>
    );
  }

  if (isProviderHubRoute && isProvider === true && profileId) {
    const providerCity = providerBaseCity || profile?.city || savedFormValues.city || "Cuddalore";
    const cityCenter = providerCity in CITY_CENTERS ? CITY_CENTERS[providerCity as keyof typeof CITY_CENTERS] : DEFAULT_MAP_CENTER;
    const hasLocation = providerListing.lat !== null && providerListing.lng !== null;
    const isEditingProvider = activeEditor === "provider";

    return (
      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 pt-0 pb-[calc(var(--bottom-nav-height)+2rem+env(safe-area-inset-bottom))] md:px-6">
        <PageHeading title="Provider hub" description="Manage how customers see your business." action={<Badge>Provider</Badge>} />

        <ProviderSummaryCard
          providerId={profileId}
          categories={providerListing.categories}
          yearsExperience={providerListing.years_experience}
          about={providerListing.bio}
        />

        <section aria-labelledby="provider-listing-heading" className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="provider-listing-heading" className="font-display text-xl">Provider listing</h2>
              <p className="mt-1 text-xs font-medium text-muted-foreground">Public business details</p>
            </div>
            {!isEditingProvider && <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label="Edit provider listing" title="Edit provider listing" disabled={activeEditor !== null} onClick={() => { setProviderListing(savedProviderListing); setListingError(null); setListingSuccess(null); setActiveEditor("provider"); }}><Pencil aria-hidden="true" className="size-4" /></Button>}
          </div>
          <form onSubmit={saveProviderListing} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="provider-business-name" className="mb-1 block text-sm font-medium">Business name</label>
                <Input id="provider-business-name" value={providerListing.business_name} maxLength={150} readOnly={!isEditingProvider} onChange={(event) => { setProviderListing((current) => ({ ...current, business_name: event.target.value })); setListingSuccess(null); }} className="min-h-11 read-only:border-transparent read-only:bg-muted/40 read-only:px-0" />
              </div>
              <div>
                <label htmlFor="provider-headline" className="mb-1 block text-sm font-medium">Headline</label>
                <Input id="provider-headline" value={providerListing.headline} maxLength={150} readOnly={!isEditingProvider} onChange={(event) => { setProviderListing((current) => ({ ...current, headline: event.target.value })); setListingSuccess(null); }} className="min-h-11 read-only:border-transparent read-only:bg-muted/40 read-only:px-0" />
                {isEditingProvider && providerListing.headline.length > 120 && <p className="mt-1 text-right text-xs text-muted-foreground">{providerListing.headline.length}/150</p>}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="provider-bio" className="mb-1 block text-sm font-medium">Bio</label>
                <Textarea id="provider-bio" value={providerListing.bio} maxLength={2000} rows={4} readOnly={!isEditingProvider} onChange={(event) => { setProviderListing((current) => ({ ...current, bio: event.target.value })); setListingSuccess(null); }} className="read-only:resize-none read-only:border-transparent read-only:bg-muted/40 read-only:px-0" />
                {isEditingProvider && providerListing.bio.length > 1600 && <p className="mt-1 text-right text-xs text-muted-foreground">{providerListing.bio.length}/2000</p>}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="provider-locality" className="mb-1 block text-sm font-medium">Based at (area or landmark)</label>
                <Input id="provider-locality" value={providerListing.locality} maxLength={150} placeholder="Beach Road, Cuddalore" readOnly={!isEditingProvider} onChange={(event) => { setProviderListing((current) => ({ ...current, locality: event.target.value })); setListingSuccess(null); }} className="min-h-11 read-only:border-transparent read-only:bg-muted/40 read-only:px-0" />
              </div>
            </div>
            {isEditingProvider && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button type="submit" className="min-h-11" disabled={isSavingListing}>{isSavingListing ? "Saving…" : "Save listing"}</Button>
                <Button type="button" variant="outline" className="min-h-11" onClick={handleCancelProviderEdit} disabled={isSavingListing}>Cancel</Button>
              </div>
            )}
            {listingError && <p className="text-sm text-destructive" role="alert">{listingError}</p>}
            {listingSuccess && <p className="text-sm text-primary" role="status">{listingSuccess}</p>}
          </form>
        </section>

        <section aria-labelledby="business-location-heading" className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="business-location-heading" className="font-display text-xl">Business location</h2>
              <p className="mt-1 text-xs font-medium text-muted-foreground">Your business pin is public on your profile.</p>
            </div>
            <Button type="button" variant="outline" className="min-h-11" disabled={activeEditor !== null} onClick={() => setIsLocationPickerOpen(true)}>{hasLocation ? "Change location" : "Set location"}</Button>
          </div>
          {providerLocationLabel?.coordinates === `${providerListing.lat},${providerListing.lng}` && <p className="mb-2 truncate text-sm text-muted-foreground" title={providerLocationLabel.label}>{providerLocationLabel.label}</p>}
          {hasLocation ? (
            <LocationMap lat={providerListing.lat!} lng={providerListing.lng!} height={240} />
          ) : (
            <>
              <LocationMap lat={cityCenter.lat} lng={cityCenter.lng} height={240} />
              <p className="mt-2 text-sm text-muted-foreground">No business location set yet.</p>
            </>
          )}
          <p className="mt-3 text-xs text-muted-foreground">For privacy, place a public pin at your shop or office rather than your home.</p>
          <LocationPicker
            open={isLocationPickerOpen}
            onOpenChange={setIsLocationPickerOpen}
            initial={hasLocation ? { lat: providerListing.lat!, lng: providerListing.lng! } : null}
            title="Business location"
            confirmLabel="Confirm"
            onConfirm={saveProviderLocation}
          />
        </section>

        <section aria-labelledby="provider-categories-heading" className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="provider-categories-heading" className="font-display text-xl">Categories &amp; services</h2>
              <p className="mt-1 text-sm text-muted-foreground">These help customers find you for the right work.</p>
            </div>
            <Link href="/profile/services" className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Manage categories &amp; services</Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {providerListing.categories.length ? providerListing.categories.map((category) => (
              <span key={category} className="inline-flex min-h-8 items-center rounded-full border border-border bg-muted/50 px-3 text-sm font-medium">{category}</span>
            )) : <p className="text-sm text-muted-foreground">No categories selected.</p>}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {providerListing.service_edit_credits > 0
              ? `You have ${providerListing.service_edit_credits} service edit${providerListing.service_edit_credits === 1 ? "" : "s"} remaining.`
              : "No service edits remaining. Contact support if you need to change your selections."}
          </p>
        </section>

        <PhoneGateDialog
          isOpen={isPhoneGateOpen}
          onClose={() => setIsPhoneGateOpen(false)}
          onVerified={() => { setIsPhoneGateOpen(false); void refreshPhoneDetails(); }}
          initialPhone={phoneNumber || undefined}
          bypassWhenVerificationDisabled={false}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-0 pb-[calc(var(--bottom-nav-height)+2rem+env(safe-area-inset-bottom))] md:px-6">
      <PageHeading
        title="Your profile"
        description="Manage your public details and private address."
        action={<div className="flex flex-wrap gap-2">{isAdmin && <Badge variant="secondary">Admin</Badge>}{isProvider && <Badge>Provider</Badge>}</div>}
        className="sm:mb-8"
      />

      <div className="grid items-start gap-4 md:grid-cols-2 md:gap-5">
        <section aria-labelledby="identity-heading" className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 id="identity-heading" className="font-display text-xl">Identity</h2>
              <p className="mt-1 text-xs font-medium text-muted-foreground">Public details</p>
            </div>
            {!isEditing && <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label="Edit identity" title="Edit identity" disabled={activeEditor !== null} onClick={() => {
              form.reset(savedFormValues);
              setError(null);
              setActiveEditor("identity");
            }}><Pencil aria-hidden="true" className="size-4" /></Button>}
          </div>

          <div className="mb-5 flex items-center gap-4">
            <Avatar
              src={avatarPreviewUrl ?? avatarUrl}
              name={profile?.full_name || savedFormValues.full_name || "Profile"}
              size={80}
              className="size-20 rounded-full border border-border bg-muted object-cover text-2xl text-muted-foreground"
            />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-foreground">{profile?.full_name || savedFormValues.full_name || "Name not provided"}</p>
              <input key="profile-avatar-file" id="profile-avatar-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={isUploading} className="sr-only" aria-label="Choose a profile photo" />
              <label htmlFor="profile-avatar-file" aria-disabled={isUploading} className={`mt-2 inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors ${isUploading ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-accent hover:text-accent-foreground"}`}>
                {isUploading ? "Uploading…" : "Change photo"}
              </label>
              {avatarError && <p role="alert" className="mt-2 text-xs text-destructive">{avatarError}</p>}
              {avatarStatus && <p role="status" aria-live="polite" className="mt-2 text-xs text-muted-foreground">{avatarStatus}</p>}
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
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">ID</span><span className="font-medium">{profile?.user_code || "Not provided"}</span></div>
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

        {isProvider && (
          <Link href="/profile/provider" className="md:col-span-2 flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-3 text-card-foreground shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="font-medium">Provider hub</span>
            <span aria-hidden="true" className="text-muted-foreground">→</span>
          </Link>
        )}

        {isProvider && isProviderHubRoute && (() => {
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
                  {!isEditingProvider && <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label="Edit provider listing" title="Edit provider listing" disabled={activeEditor !== null} onClick={() => { setProviderListing(savedProviderListing); setListingError(null); setListingSuccess(null); setActiveEditor("provider"); }}><Pencil aria-hidden="true" className="size-4" /></Button>}
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
                title="Business location"
                confirmLabel="Confirm"
                onConfirm={saveProviderLocation}
              />
            </section>
          );
        })()}
      </div>

      <section aria-labelledby="settings" className="mt-8 space-y-5 border-t border-border pt-6">
        <h2 id="settings" className="font-display text-2xl font-medium text-foreground">Settings</h2>

        <section aria-labelledby="appearance-heading" className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
          <h3 id="appearance-heading" className="mb-2 text-lg font-semibold text-foreground">Appearance</h3>
          <p className="mb-5 text-sm text-muted-foreground">Choose a light or dark theme, or follow your device setting.</p>
          <ThemeToggle />
        </section>

        <section aria-labelledby="account-heading" className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
          <h3 id="account-heading" className="mb-4 text-lg font-semibold text-foreground">Account</h3>
          <div className="mb-5 flex min-w-0 items-center gap-4 rounded-xl border border-border bg-background p-4">
            <Avatar src={avatarUrl} name={profile?.full_name?.trim() || accountEmail || "Your account"} size={56} className="size-14 shrink-0 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{profile?.full_name?.trim() || accountEmail || "Your account"}</p>
              <p className="truncate text-sm text-muted-foreground">{accountEmail || "Email unavailable"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="#identity-heading" className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Edit profile</Link>
            <SettingsLogOutButton />
            <AdminLink />
          </div>
        </section>
      </section>

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
      {isProvider && isProviderHubRoute && (
        <section className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-2 font-medium text-blue-900">Categories &amp; services</h2>
          <p className="mb-4 text-sm text-blue-800">Manage which categories and services you offer so customers can find you for the right work.</p>
          <a href="/profile/services" className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Manage services
          </a>
        </section>
      )}
      {isProvider && isProviderHubRoute && (() => {
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

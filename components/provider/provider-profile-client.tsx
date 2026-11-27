"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, BadgeCheck, BriefcaseBusiness, PencilLine } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ContactUnlock } from "@/components/contact-unlock";
import { PhoneGateDialog } from "@/components/phone-gate-dialog";
import { usePhoneVerificationRequired } from "@/components/phone-verification-required-context";
import { ReportDialog } from "@/components/report-dialog";
import { ReviewModal } from "@/components/review-modal";
import { friendlyDbError } from "@/lib/db-errors";
import { getEligibleEnquiriesForReview, type EligibleReviewEnquiry } from "@/lib/reviews";
import { useAuthGate } from "@/components/auth/auth-sheet";
import ProviderProfileSkeleton from "@/components/provider/provider-profile-skeleton";
import ProviderProfileHeader from "@/components/provider/provider-profile-header";
import { PageHeading } from "@/components/page-heading";
import ProviderActionBar from "@/components/provider/provider-action-bar";
import ProviderWorkSection from "@/components/provider/provider-work-section";
import ProviderLocationSection from "@/components/provider/provider-location-section";
import ProviderReviewsSection from "@/components/provider/provider-reviews-section";
import { EnquiryDetailsFields, type EnquiryDetailsValue } from "@/components/enquiries/enquiry-details-fields";
import { useLocation } from "@/lib/location/provider";
import { saveEnquiryLocation } from "@/lib/enquiry-location";

type Props = { id: string };

const enquirySchema = z.object({
  message: z.string().trim().min(1, "Add a short message to send with your enquiry"),
});

type EnquiryFormValues = z.infer<typeof enquirySchema>;

type ProviderRecord = {
  id: string;
  business_name: string | null;
  headline: string | null;
  bio: string | null;
  years_experience: number | null;
  city: string | null;
  locality: string | null;
  is_verified: boolean | null;
  avg_rating: number | null;
  review_count: number | null;
  profiles?:
    | Array<{ full_name?: string | null; avatar_url?: string | null }>
    | { full_name?: string | null; avatar_url?: string | null }
    | null;
  provider_categories?: Array<{
    service_categories?:
      | { id: number; name: string }
      | Array<{ id: number; name: string }>
      | null;
  }>;
  provider_portfolio_items?: Array<{
    id: string;
    image_url: string;
    caption?: string | null;
    description?: string | null;
    media_type: string;
    sort_order?: number | null;
    created_at?: string | null;
  }>;
};

type ProviderReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string | null;
  profiles?: { full_name?: string | null } | null;
};

type VerifiedCredential = {
  type_label: string;
  issuing_body: string;
  verified_at: string;
};

function VerifiedCredentialsSection({ credentials, className }: { credentials: VerifiedCredential[]; className?: string }) {
  if (credentials.length === 0) return null;
  return (
    <section className={`mb-[var(--section-gap)] rounded-2xl border border-border bg-card p-4 text-card-foreground ${className ?? ""}`}>
      <h2 className="mb-4 flex items-center gap-2 font-display text-xl text-foreground">
        <BadgeCheck aria-hidden="true" className="size-5 text-primary" />
        Verified credentials
      </h2>
      <ul className="space-y-3">
        {credentials.map((credential, index) => (
          <li key={`${credential.type_label}-${credential.verified_at}-${index}`} className="rounded-xl border border-border bg-background/70 p-3 text-sm">
            <p className="font-medium">{credential.type_label} — {credential.issuing_body}</p>
            <p className="text-xs text-muted-foreground">Document checked by Assisto on {formatDateTime(credential.verified_at)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">Assisto checks that a document was issued to this person. It does not guarantee the quality of their work.</p>
    </section>
  );
}

function logSupabaseError(context: string, error: { message: string; details?: string; hint?: string; code?: string }) {
  console.error(context, error.message, error.details, error.hint, error.code);
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function ProviderBio({ bio }: { bio: string }) {
  const measurementRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const paragraph = measurementRef.current;
    if (!paragraph) return;
    const measure = () => setHasOverflow(paragraph.scrollHeight > paragraph.clientHeight + 1);
    const frame = window.requestAnimationFrame(measure);
    let observer: ResizeObserver | null = null;
    try {
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(measure);
        observer.observe(paragraph);
      }
    } catch {
      observer?.disconnect();
      observer = null;
    }
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [bio]);

  return (
    <section className="relative mb-8">
      <h2 className="mb-1 font-medium">About</h2>
      <p className={`whitespace-pre-line text-muted-foreground ${expanded ? "" : "line-clamp-4"} sm:line-clamp-none`}>{bio}</p>
      <p ref={measurementRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-6 -z-10 line-clamp-4 whitespace-pre-line opacity-0">{bio}</p>
      {hasOverflow && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </section>
  );
}

function EnquiryWidget({
  providerId,
  providerName,
  requirementId,
  initialMessage,
  isSelf,
  onFormOpenChange,
  onActionBarDismiss,
}: {
  providerId: string;
  providerName: string;
  requirementId?: string;
  initialMessage?: string;
  isSelf: boolean;
  onFormOpenChange: (open: boolean) => void;
  onActionBarDismiss: () => void;
}) {
  const router = useRouter();
  const { requireAuth } = useAuthGate();
  const phoneVerificationRequired = usePhoneVerificationRequired();
  const supabase = useMemo(() => createClient(), []);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPhoneGateOpen, setIsPhoneGateOpen] = useState(false);
  const submitInFlightRef = useRef(false);
  const phoneStatusRef = useRef<{ userId: string; verified: boolean } | null>(null);
  const pendingPhoneUserIdRef = useRef<string | null>(null);
  const pendingValuesRef = useRef<EnquiryFormValues | null>(null);
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);
  const focusMessageWhenOpenRef = useRef(false);
  const [details, setDetails] = useState<EnquiryDetailsValue>({
    isAsap: true, scheduledStartAt: null, addressText: "", lat: null, lng: null, place: "home", isValid: false,
  });
  const [homeAddress, setHomeAddress] = useState("");
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [homePin, setHomePin] = useState<{ lat: number; lng: number } | null>(null);
  const [today] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  });
  const { location: selectedLocation } = useLocation();
  const onDetailsChange = useCallback((value: EnquiryDetailsValue) => setDetails(value), []);

  useEffect(() => {
    let active = true;
    async function loadHomeLocation() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user || !active) return;
      const [addressResult, profileResult] = await Promise.all([
        supabase.from("profile_private_addresses").select("street,house_number,area,city,pincode,lat,lng").eq("profile_id", user.id).maybeSingle(),
        supabase.from("profiles").select("city").eq("id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      const address = addressResult.data;
      const city = typeof address?.city === "string" && address.city.trim()
        ? address.city.trim()
        : typeof profileResult.data?.city === "string" && profileResult.data.city.trim()
          ? profileResult.data.city.trim()
          : selectedLocation.city || selectedLocation.locality || null;
      const parts = [address?.house_number, address?.street, address?.area, address?.city || city, address?.pincode]
        .map((part) => typeof part === "string" ? part.trim() : "")
        .filter(Boolean);
      setHomeAddress(parts.filter((part, index) => parts.findIndex((other) => other.toLocaleLowerCase() === part.toLocaleLowerCase()) === index).join(", "));
      setHomeCity(city);
      setHomePin(typeof address?.lat === "number" && typeof address.lng === "number" ? { lat: address.lat, lng: address.lng } : null);
    }
    void loadHomeLocation();
    return () => { active = false; };
  }, [selectedLocation.city, selectedLocation.locality, supabase]);

  useEffect(() => {
    onFormOpenChange(isOpen);
  }, [isOpen, onFormOpenChange]);

  const form = useForm<EnquiryFormValues>({
    resolver: zodResolver(enquirySchema),
    defaultValues: { message: initialMessage ?? "" },
  });
  const resetForm = form.reset;

  useEffect(() => {
    if (initialMessage) {
      resetForm({ message: initialMessage });
    }
  }, [initialMessage, resetForm]);

  useEffect(() => {
    const handleActionBarEnquiry = () => {
      const enquiry = document.getElementById("provider-enquiry");
      const textarea = enquiry?.querySelector<HTMLTextAreaElement>("textarea");
      if (textarea) {
        focusMessageWhenOpenRef.current = false;
        textarea.focus();
        return;
      }
      focusMessageWhenOpenRef.current = true;
      enquiry?.querySelector<HTMLButtonElement>("[data-enquiry-start]")?.click();
    };
    window.addEventListener("provider-profile:enquiry", handleActionBarEnquiry);
    return () => window.removeEventListener("provider-profile:enquiry", handleActionBarEnquiry);
  }, []);

  useEffect(() => {
    if (!isOpen || !focusMessageWhenOpenRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      messageTextareaRef.current?.focus();
      focusMessageWhenOpenRef.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  async function handleStart() {
    if (isSelf) return;
    setErrorMessage(null);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError && !isAuthSessionMissingError(userError)) logSupabaseError("provider enquiry auth lookup failed:", userError);

    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(requirementId ? `/providers/${providerId}?requirement=${requirementId}` : `/providers/${providerId}`)}`);
      return;
    }

    const { data: existing, error: existingError } = await supabase
      .from("enquiries")
      .select("id")
      .eq("customer_id", user.id)
      .eq("provider_id", providerId)
      .eq("status", "sent")
      .limit(1);

    if (existingError) logSupabaseError("existing provider enquiry lookup failed:", existingError);

    if (existing && existing.length > 0) {
      setIsPending(true);
      setIsOpen(false);
      return;
    }

    setIsPending(false);
    setIsOpen(true);
  }

  const onSubmit = useCallback(async (values: EnquiryFormValues) => {
    if (isSelf) return;
    if (!details.isValid) {
      setErrorMessage("Choose a future time and enter a work location before sending.");
      return;
    }
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError && !isAuthSessionMissingError(userError)) logSupabaseError("provider enquiry submit auth lookup failed:", userError);

      if (!user) {
        router.push(`/login?redirect=${encodeURIComponent(requirementId ? `/providers/${providerId}?requirement=${requirementId}` : `/providers/${providerId}`)}`);
        return;
      }

      if (phoneVerificationRequired) {
        let phoneVerified = phoneStatusRef.current?.userId === user.id
          ? phoneStatusRef.current.verified
          : null;
        if (phoneVerified === null) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("phone_verified_at")
            .eq("id", user.id)
            .maybeSingle();
          if (profileError) logSupabaseError("provider enquiry phone verification lookup failed:", profileError);
          phoneVerified = Boolean(profile?.phone_verified_at);
          phoneStatusRef.current = { userId: user.id, verified: phoneVerified };
        }
        if (!phoneVerified) {
          pendingPhoneUserIdRef.current = user.id;
          pendingValuesRef.current = values;
          setIsPhoneGateOpen(true);
          return;
        }
      }

      const { data: existing, error: existingError } = await supabase
        .from("enquiries")
        .select("id")
        .eq("customer_id", user.id)
        .eq("provider_id", providerId)
        .eq("status", "sent")
        .limit(1);

      if (existingError) logSupabaseError("existing provider enquiry lookup failed:", existingError);

      if (existing && existing.length > 0) {
        setIsPending(true);
        setIsOpen(false);
        return;
      }

      const { data: inserted, error } = await supabase.from("enquiries").insert({
        customer_id: user.id,
        provider_id: providerId,
        requirement_id: requirementId || null,
        message: values.message,
        status: "sent",
        is_asap: details.isAsap,
        scheduled_start_at: details.isAsap ? null : details.scheduledStartAt,
      }).select("id").single();
      if (error) {
        logSupabaseError("provider enquiry insert failed:", error);
        if (error.code === "23505") {
          setIsPending(true);
          setIsOpen(false);
          return;
        }

        if (error.message === "PHONE_NOT_VERIFIED" && phoneVerificationRequired) {
          phoneStatusRef.current = { userId: user.id, verified: false };
          pendingPhoneUserIdRef.current = user.id;
          pendingValuesRef.current = values;
          setIsPhoneGateOpen(true);
          return;
        }

        setErrorMessage(friendlyDbError(error, "Unable to send your enquiry right now."));
        return;
      }

      if (!inserted) {
        setErrorMessage("Unable to send your enquiry right now. Please try again.");
        return;
      }

      const locationError = await saveEnquiryLocation(supabase, {
        enquiryId: inserted.id,
        customerId: user.id,
        addressText: details.addressText,
        lat: details.lat,
        lng: details.lng,
      });
      if (locationError) {
        logSupabaseError("provider enquiry location insert failed:", locationError);
        setErrorMessage("Enquiry sent, but the location couldn't be saved. Edit it from Requests.");
      }

      setIsSuccess(true);
      setIsOpen(false);
    } catch (error) {
      logSupabaseError("provider enquiry submit failed:", { message: error instanceof Error ? error.message : String(error) });
      setErrorMessage("Unable to send your enquiry right now. Please try again.");
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }, [details, isSelf, phoneVerificationRequired, providerId, requirementId, router, supabase]);

  const handlePhoneVerified = useCallback(() => {
    setIsPhoneGateOpen(false);
    if (pendingPhoneUserIdRef.current) {
      phoneStatusRef.current = { userId: pendingPhoneUserIdRef.current, verified: true };
    }
    pendingPhoneUserIdRef.current = null;
    const values = pendingValuesRef.current;
    pendingValuesRef.current = null;
    if (values) void onSubmit(values);
  }, [onSubmit]);

  const closePhoneGate = useCallback(() => setIsPhoneGateOpen(false), []);

  function startEnquiry() {
    if (isSelf) return;
    requireAuth(() => void handleStart(), "to send an enquiry");
  }

  const submitEnquiry = useCallback((values: EnquiryFormValues) => {
    if (isSelf) return;
    requireAuth(() => void onSubmit(values), "to send an enquiry");
  }, [isSelf, onSubmit, requireAuth]);

  async function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valid = await form.trigger();
    if (valid) await submitEnquiry(form.getValues());
  }

  if (isSelf) return null;

  if (isSuccess) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-foreground">Your enquiry has been sent to {providerName}. They&apos;ll respond soon.</p>
        {errorMessage && <p role="status" className="text-sm text-amber-700">{errorMessage}</p>}
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-foreground">You already have a pending enquiry with this provider</p>
        <Link href="/enquiries" className="text-sm font-medium underline">
          View my enquiries
        </Link>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <Button data-enquiry-start="true" className="w-full" onClick={startEnquiry}>
        Send enquiry
      </Button>
    );
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={handleFormSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea
                  rows={6}
                  maxLength={2000}
                  placeholder="Tell the provider what you need and what you&apos;re looking for."
                  {...field}
                  ref={(element) => {
                    field.ref(element);
                    messageTextareaRef.current = element;
                  }}
                />
              </FormControl>
              {(field.value?.length ?? 0) > 1600 && (
                <p className="text-right text-xs text-muted-foreground">{field.value.length}/2000</p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <EnquiryDetailsFields
          homeAddress={homeAddress}
          homeCity={homeCity}
          homePin={homePin}
          today={today}
          onChange={onDetailsChange}
        />

        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => { setIsOpen(false); onActionBarDismiss(); }}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Send enquiry"}
          </Button>
        </div>
        </form>
      </Form>
      <PhoneGateDialog
        isOpen={isPhoneGateOpen}
        onClose={closePhoneGate}
        onVerified={handlePhoneVerified}
        bypassWhenVerificationDisabled={false}
      />
    </>
  );
}

export default function ProviderProfileClient({ id }: Props) {
  const { isAuthenticated, requireAuth } = useAuthGate();
  const searchParams = useSearchParams();
  const requirementId = searchParams.get("requirement") || undefined;
  const supabase = useMemo(() => createClient(), []);

  const [provider, setProvider] = useState<ProviderRecord | null>(null);
  const [reviews, setReviews] = useState<ProviderReview[]>([]);
  const [verifiedCredentials, setVerifiedCredentials] = useState<VerifiedCredential[]>([]);
  const [initialRequirementMessage, setInitialRequirementMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [providerLoadError, setProviderLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [mediaFilter, setMediaFilter] = useState<"all" | "photos" | "videos">("all");
  const [sortDirection, setSortDirection] = useState<"latest" | "oldest">("latest");
  const [profileReported, setProfileReported] = useState(false);
  const [reportedReviews, setReportedReviews] = useState<Set<string>>(new Set());
  const [eligibleReviewEnquiries, setEligibleReviewEnquiries] = useState<EligibleReviewEnquiry[]>([]);
  const [reviewPickerOpen, setReviewPickerOpen] = useState(false);
  const [reviewModalEnquiryId, setReviewModalEnquiryId] = useState<number | null>(null);
  const [isCurrentUserProvider, setIsCurrentUserProvider] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [enquiryFormOpen, setEnquiryFormOpen] = useState(false);
  const [actionBarDismissed, setActionBarDismissed] = useState(false);

  const refreshProfileReviews = useCallback(async () => {
    const { data: reviewsData, error: reviewsError } = await supabase
      .from("reviews")
      .select("id,rating,comment,created_at,customer_id,profiles!reviews_customer_id_fkey(full_name)")
      .eq("provider_id", id)
      .order("created_at", { ascending: false });

    if (reviewsError) logSupabaseError("provider reviews query failed:", reviewsError);

    setReviews((reviewsData as ProviderReview[]) ?? []);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError && !isAuthSessionMissingError(userError)) logSupabaseError("provider profile viewer auth lookup failed:", userError);
    const userId = userData.user?.id ?? null;
    setCurrentUserId(userId);

    if (!userId || isCurrentUserProvider) {
      setEligibleReviewEnquiries([]);
      return;
    }

    const eligible = await getEligibleEnquiriesForReview(supabase, userId, id);
    setEligibleReviewEnquiries(eligible);
  }, [id, isCurrentUserProvider, supabase]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setProviderLoadError(false);

      const { data: providerData, error: providerError } = await supabase
        .from("providers")
        .select(
          `id, business_name, headline, bio, years_experience, city, locality, is_verified,
           avg_rating, review_count,
           profiles!providers_id_fkey ( full_name, avatar_url ),
           provider_categories ( service_categories ( id, name ) ),
           provider_portfolio_items ( id, image_url, caption, description, media_type, sort_order, created_at )`
        )
        .eq("id", id)
        .eq("is_active", true)
        .order("sort_order", { foreignTable: "provider_portfolio_items", ascending: true })
        .maybeSingle();

      if (providerError) logSupabaseError("public provider profile query failed:", providerError);

      if (!isMounted) return;

      const orderedPortfolio = [...((providerData?.provider_portfolio_items as ProviderRecord["provider_portfolio_items"]) ?? [])].sort(
        (a, b) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0)
      );

      setProvider(providerData ? { ...providerData, provider_portfolio_items: orderedPortfolio } : null);
      setProviderLoadError(Boolean(providerError));

      if (providerData) {
        const { data: credentialData, error: credentialError } = await supabase.rpc("get_provider_verified_credentials", {
          p_provider_id: providerData.id,
        });
        if (credentialError) {
          logSupabaseError("verified provider credentials RPC failed:", credentialError);
          if (isMounted) setVerifiedCredentials([]);
        } else if (isMounted) {
          setVerifiedCredentials((credentialData ?? []) as VerifiedCredential[]);
        }
      } else if (isMounted) {
        setVerifiedCredentials([]);
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError && !isAuthSessionMissingError(userError)) logSupabaseError("provider profile viewer auth lookup failed:", userError);
      const userId = userData.user?.id ?? null;
      if (userId) {
        const { data: providerRow, error: providerRowError } = await supabase.from("providers").select("id").eq("id", userId).maybeSingle();
        if (providerRowError) logSupabaseError("viewer provider lookup failed:", providerRowError);
        if (isMounted) {
          setCurrentUserId(userId);
          setIsCurrentUserProvider(Boolean(providerRow));
        }
      } else if (isMounted) {
        setCurrentUserId(null);
        setIsCurrentUserProvider(false);
      }

      if (isMounted) {
        await refreshProfileReviews();
      }

      if (requirementId) {
        const { data: requirementRow, error: requirementError } = await supabase
          .from("customer_requirements")
          .select("id, description")
          .eq("id", requirementId)
          .maybeSingle();

        if (requirementError) logSupabaseError("requirement details lookup failed:", requirementError);

        if (isMounted) {
          setInitialRequirementMessage(requirementRow?.description ?? "");
        }
      } else if (isMounted) {
        setInitialRequirementMessage("");
      }

      if (isMounted) {
        setLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [id, refreshProfileReviews, requirementId, supabase, loadAttempt]);

  if (loading) {
    return <ProviderProfileSkeleton />;
  }

  if (providerLoadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div role="alert" className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-soft">
          <p className="font-medium">We couldn&apos;t load this provider profile right now.</p>
          <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
            Try again
          </Button>
          <Link href="/discover" className="ml-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to discover
          </Link>
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-0 pb-10">
        <PageHeading title="Provider not found" className="mb-0" />
        <Link href="/discover" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to discover
        </Link>
      </div>
    );
  }

  const profile = Array.isArray(provider.profiles) ? provider.profiles[0] : provider.profiles;
  const name = provider.business_name || profile?.full_name || "Provider";
  const categories = (provider.provider_categories ?? []).flatMap((providerCategory) => {
    const category = Array.isArray(providerCategory.service_categories)
      ? providerCategory.service_categories[0]
      : providerCategory.service_categories;
    return category ? [category.name] : [];
  });
  const showMobileActionBar = currentUserId !== provider.id && !enquiryFormOpen && !actionBarDismissed;

  function activateMobileEnquiry() {
    setActionBarDismissed(true);
    const enquiry = document.getElementById("provider-enquiry");
    if (!enquiry) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    enquiry.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    window.dispatchEvent(new Event("provider-profile:enquiry"));
  }

  function renderReviewReport(review: ProviderReview) {
    if (currentUserId === provider?.id) return null;
    return (
      <span
        onClickCapture={(event) => {
          if (isAuthenticated) return;
          const target = event.target;
          const reportButton = target instanceof Element ? target.closest<HTMLButtonElement>("button") : null;
          if (!reportButton) return;
          event.preventDefault();
          event.stopPropagation();
          requireAuth(() => reportButton.click(), "to report a review");
        }}
      >
        <ReportDialog
          reportableType="review"
          reportableId={review.id}
          triggerLabel="Report"
          onSuccess={() => setReportedReviews((previous) => new Set([...previous, review.id]))}
        />
      </span>
    );
  }

  const reviewAction = currentUserId && !isCurrentUserProvider && eligibleReviewEnquiries.length > 0 ? (
    <div className="w-full max-w-xs">
      {eligibleReviewEnquiries.length === 1 ? (
        <Button type="button" className="w-full" onClick={() => setReviewModalEnquiryId(eligibleReviewEnquiries[0].id)}>
          Leave a review
        </Button>
      ) : (
        <div className="space-y-2">
          <Button type="button" className="w-full" onClick={() => setReviewPickerOpen((current) => !current)}>
            Leave a review
          </Button>
          {reviewPickerOpen && (
            <div className="rounded-md border border-border bg-background p-3 text-left shadow-soft">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Choose the completed job</p>
              <div className="space-y-2">
                {eligibleReviewEnquiries.map((enquiry) => (
                  <button
                    key={enquiry.id}
                    type="button"
                    onClick={() => {
                      setReviewPickerOpen(false);
                      setReviewModalEnquiryId(enquiry.id);
                    }}
                    className="w-full rounded-md border border-border bg-muted/30 p-2 text-left transition hover:bg-muted/50"
                  >
                    <div className="text-sm font-medium">{enquiry.customer_requirements?.description || "Completed project"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Completed {formatDateTime(enquiry.customer_completed_at ?? enquiry.updated_at)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className={`mx-auto max-w-2xl px-4 pt-[calc(env(safe-area-inset-top)_+_1.5rem)] ${showMobileActionBar ? "pb-[calc(5rem+env(safe-area-inset-bottom))]" : "pb-10"} sm:pb-10`}>
      <ProviderProfileHeader
        name={name}
        avatarUrl={profile?.avatar_url}
        isVerified={provider.is_verified}
        locality={provider.locality}
        city={provider.city}
        yearsExperience={provider.years_experience}
        headline={provider.headline}
        categories={categories}
        avgRating={provider.avg_rating}
        reviewCount={provider.review_count}
      />

      <VerifiedCredentialsSection credentials={verifiedCredentials} className="hidden sm:block" />

      {provider.bio && <ProviderBio bio={provider.bio} />}

      <ProviderWorkSection
        items={provider.provider_portfolio_items ?? []}
        providerName={name}
        mediaFilter={mediaFilter}
        setMediaFilter={setMediaFilter}
        sortDirection={sortDirection}
        setSortDirection={setSortDirection}
        isOwner={currentUserId === provider.id}
      />

      <ProviderLocationSection locality={provider.locality} city={provider.city} businessName={name} />
      <VerifiedCredentialsSection credentials={verifiedCredentials} className="sm:hidden" />

      <ProviderReviewsSection
        reviews={reviews}
        avgRating={provider.avg_rating}
        reviewCount={provider.review_count}
        reviewAction={reviewAction}
        renderReport={renderReviewReport}
      />

      <div className="mb-8 max-sm:hidden">
        <h2 className="mb-2 font-medium">Reviews</h2>
        {provider.review_count && provider.review_count > 0 ? (
          <>
            <div className="mb-4 text-sm">
              <span className="text-primary">★</span>
              <span className="ml-1 font-medium">{(provider.avg_rating ?? 0).toFixed(1)}</span>
              <span className="ml-2 text-muted-foreground">({provider.review_count} {provider.review_count === 1 ? "review" : "reviews"})</span>
            </div>

            <div className="space-y-3">
              {reviews.map((review) => {
                const profile = Array.isArray(review.profiles) ? review.profiles[0] : review.profiles;
                const isReported = reportedReviews.has(review.id);
                return (
                  <div key={review.id} className="rounded-md border border-muted p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="text-primary">{"★".repeat(review.rating)}<span className="text-muted-foreground/50">{"☆".repeat(5 - review.rating)}</span></div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground">{formatDateTime(review.created_at)}</div>
                        {isReported ? (
                          <button disabled className="text-xs text-muted-foreground">
                            Reported
                          </button>
                        ) : (
                          renderReviewReport(review)
                        )}
                      </div>
                    </div>
                    {review.comment && <p className="mb-2 whitespace-pre-line text-sm text-muted-foreground">{review.comment}</p>}
                    <div className="text-xs text-muted-foreground">{profile?.full_name || "Customer"}</div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        )}
      </div>

      {currentUserId === provider.id ? (
        <section className="rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
          <h2 className="font-display text-lg">This is your public profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">Customers see this page when they find you.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/profile" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <PencilLine aria-hidden="true" className="size-4" />Edit profile
            </Link>
            <Link href="/your-work" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <BriefcaseBusiness aria-hidden="true" className="size-4" />Manage your work
            </Link>
          </div>
        </section>
      ) : (
        <>
          <div id="provider-enquiry" className="rounded-lg border p-4">
            <p className="mb-3 text-sm text-muted-foreground">
              Contact details unlock once you send an enquiry and the provider confirms.
            </p>
            {profileReported ? (
              <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
                Thank you for reporting. We&apos;ll review your report and take appropriate action if needed.
              </div>
            ) : (
              <EnquiryWidget
                providerId={provider.id}
                providerName={name}
                requirementId={requirementId}
                initialMessage={initialRequirementMessage}
                isSelf={false}
                onFormOpenChange={(open) => {
                  setEnquiryFormOpen(open);
                  if (open) setActionBarDismissed(true);
                }}
                onActionBarDismiss={() => setActionBarDismissed(false)}
              />
            )}
          </div>

          <div className="mt-4 flex flex-col items-center gap-3 max-sm:hidden">
            {reviewAction}
            {profileReported ? (
              <button disabled className="text-xs text-muted-foreground">Reported</button>
            ) : (
              <ReportDialog
                reportableType="provider"
                reportableId={provider.id}
                triggerLabel="Report this profile"
                onSuccess={() => setProfileReported(true)}
              />
            )}
          </div>
        </>
      )}

      {reviewModalEnquiryId !== null && (
        <ReviewModal
          enquiryId={reviewModalEnquiryId}
          providerName={name}
          onClose={() => setReviewModalEnquiryId(null)}
          onSubmitted={async () => {
            setReviewPickerOpen(false);
            setReviewModalEnquiryId(null);
            await refreshProfileReviews();
          }}
        />
      )}

      {/* Your history with this provider (only for authenticated users) */}
      {currentUserId !== provider.id && <ProviderEnquiryHistory providerId={provider.id} />}
      {showMobileActionBar && <ProviderActionBar onActivate={activateMobileEnquiry} />}
    </div>
  );
}

function ProviderEnquiryHistory({ providerId }: { providerId: string }) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<Array<{ id: number; message: string | null; status: string; created_at: string | null; customer_id: string }>>([]);
  const [pendingMap, setPendingMap] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string | null>>({});

  useEffect(() => {
    let mounted = true;
    async function load() {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError && !isAuthSessionMissingError(userError)) logSupabaseError("provider history auth lookup failed:", userError);
      if (!userData.user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("enquiries")
        .select("id,message,status,created_at,customer_id")
        .eq("customer_id", userData.user.id)
        .eq("provider_id", providerId)
        .order("created_at", { ascending: false });

      if (!mounted) return;
      if (error) logSupabaseError("provider enquiry history query failed:", error);
      if (!error && data) {
        const rows = data as Array<{ id: number; message: string | null; status: string; created_at: string | null; customer_id: string }>;
        if (rows.length > 0) {
          setHistory(rows);
        }
      }
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [providerId]);

  function setPending(id: number, v: boolean) {
    setPendingMap((s) => ({ ...s, [id]: v }));
  }

  function setCardError(id: number, msg: string | null) {
    setErrors((s) => ({ ...s, [id]: msg }));
  }

  async function updateStatus(id: number, status: string) {
    setPending(id, true);
    setCardError(id, null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("enquiries").update({ status }).eq("id", id);
      if (error) {
        logSupabaseError("provider enquiry status update failed:", error);
        throw error;
      }
      setHistory((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    } catch (err: unknown) {
      setCardError(id, err instanceof Error ? err.message : "Update failed");
    } finally {
      setPending(id, false);
    }
  }

  if (loading || history.length === 0) return null;

  return (
    <div className="mt-6 rounded-lg border p-4">
      <h3 className="mb-2 font-medium">Your history with this provider</h3>
      <div className="space-y-3">
        {history.map((h) => (
          <div key={h.id} className="flex flex-col text-sm">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground">{h.created_at ? new Date(h.created_at).toLocaleDateString() : ""}</div>
              <div className="mx-4 flex-1 truncate">{h.message}</div>
              <div>
                <Badge variant={
                  h.status === "accepted" || h.status === "confirmed"
                    ? "secondary"
                    : h.status === "declined" || h.status === "cancelled"
                    ? "destructive"
                    : h.status === "completed"
                    ? "default"
                    : "outline"
                }>{h.status}</Badge>
              </div>
            </div>
            {h.status === "accepted" && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => updateStatus(h.id, "confirmed")}
                  disabled={!!pendingMap[h.id]}
                  className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-60"
                >
                  {pendingMap[h.id] ? "Confirming…" : "Confirm"}
                </button>
              </div>
            )}
            {h.status === "confirmed" && (
              <ContactUnlock profileId={providerId} />
            )}
            {errors[h.id] && <p className="mt-2 text-sm text-destructive">{errors[h.id]}</p>}
          </div>
        ))}
      </div>
      <div className="mt-3">
        <Link href="/enquiries" className="text-sm text-primary underline">
          View all my enquiries
        </Link>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ContactUnlock } from "@/components/contact-unlock";
import { ReportDialog } from "@/components/report-dialog";
import { ReviewModal } from "@/components/review-modal";
import { getEligibleEnquiriesForReview, type EligibleReviewEnquiry } from "@/lib/reviews";

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
  is_verified: boolean | null;
  avg_rating: number | null;
  review_count: number | null;
  profiles?:
    | Array<{ full_name?: string | null; avatar_url?: string | null; email?: string | null }>
    | { full_name?: string | null; avatar_url?: string | null; email?: string | null }
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

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function buildLoginRedirect(providerId: string, requirementId?: string) {
  const target = requirementId ? `/providers/${providerId}?requirement=${requirementId}` : `/providers/${providerId}`;
  return `/login?redirect=${encodeURIComponent(target)}`;
}

function EnquiryWidget({
  providerId,
  providerName,
  requirementId,
  initialMessage,
}: {
  providerId: string;
  providerName: string;
  requirementId?: string;
  initialMessage?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<EnquiryFormValues>({
    resolver: zodResolver(enquirySchema),
    defaultValues: { message: initialMessage ?? "" },
  });

  useEffect(() => {
    if (initialMessage) {
      form.reset({ message: initialMessage });
    }
  }, [form, initialMessage]);

  async function handleStart() {
    setErrorMessage(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(buildLoginRedirect(providerId, requirementId));
      return;
    }

    const { data: existing } = await supabase
      .from("enquiries")
      .select("id")
      .eq("customer_id", user.id)
      .eq("provider_id", providerId)
      .eq("status", "sent")
      .limit(1);

    if (existing && existing.length > 0) {
      setIsPending(true);
      setIsOpen(false);
      return;
    }

    setIsPending(false);
    setIsOpen(true);
  }

  async function onSubmit(values: EnquiryFormValues) {
    setErrorMessage(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(buildLoginRedirect(providerId, requirementId));
      return;
    }

    const { data: existing } = await supabase
      .from("enquiries")
      .select("id")
      .eq("customer_id", user.id)
      .eq("provider_id", providerId)
      .eq("status", "sent")
      .limit(1);

    if (existing && existing.length > 0) {
      setIsPending(true);
      setIsOpen(false);
      return;
    }

    const { error } = await supabase.from("enquiries").insert({
      customer_id: user.id,
      provider_id: providerId,
      requirement_id: requirementId || null,
      message: values.message,
      status: "sent",
    });

    if (error) {
      if (error.code === "23505") {
        setIsPending(true);
        setIsOpen(false);
        return;
      }

      setErrorMessage(error.message || "Unable to send your enquiry right now.");
      return;
    }

    setIsSuccess(true);
    setIsOpen(false);
  }

  if (isSuccess) {
    return (
      <p className="text-sm text-foreground">
        Your enquiry has been sent to {providerName}. They&apos;ll respond soon.
      </p>
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
      <Button className="w-full" onClick={handleStart}>
        Send enquiry
      </Button>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea
                  rows={6}
                  placeholder="Tell the provider what you need and what you&apos;re looking for."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
            Send enquiry
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function ProviderProfilePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const requirementId = searchParams.get("requirement") || undefined;
  const supabase = useMemo(() => createClient(), []);

  const [provider, setProvider] = useState<ProviderRecord | null>(null);
  const [reviews, setReviews] = useState<ProviderReview[]>([]);
  const [initialRequirementMessage, setInitialRequirementMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAllWork, setShowAllWork] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<"all" | "photos" | "videos">("all");
  const [sortDirection, setSortDirection] = useState<"latest" | "oldest">("latest");
  const [profileReported, setProfileReported] = useState(false);
  const [reportedReviews, setReportedReviews] = useState<Set<string>>(new Set());
  const [eligibleReviewEnquiries, setEligibleReviewEnquiries] = useState<EligibleReviewEnquiry[]>([]);
  const [reviewPickerOpen, setReviewPickerOpen] = useState(false);
  const [reviewModalEnquiryId, setReviewModalEnquiryId] = useState<number | null>(null);
  const [isCurrentUserProvider, setIsCurrentUserProvider] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const refreshProfileReviews = useCallback(async () => {
    const { data: reviewsData } = await supabase
      .from("reviews")
      .select("id,rating,comment,created_at,customer_id,profiles!reviews_customer_id_fkey(full_name)")
      .eq("provider_id", id)
      .order("created_at", { ascending: false });

    setReviews((reviewsData as ProviderReview[]) ?? []);

    const { data: userData } = await supabase.auth.getUser();
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

      const { data: providerData } = await supabase
        .from("providers")
        .select(
          `id, business_name, headline, bio, years_experience, city, is_verified,
           avg_rating, review_count,
           profiles ( full_name, email, avatar_url ),
           provider_categories ( service_categories ( id, name ) ),
           provider_portfolio_items ( id, image_url, caption, description, media_type, sort_order, created_at )`
        )
        .eq("id", id)
        .eq("is_active", true)
        .order("sort_order", { foreignTable: "provider_portfolio_items", ascending: true })
        .maybeSingle();

      if (!isMounted) return;

      const orderedPortfolio = [...((providerData?.provider_portfolio_items as ProviderRecord["provider_portfolio_items"]) ?? [])].sort(
        (a, b) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0)
      );

      setProvider(providerData ? { ...providerData, provider_portfolio_items: orderedPortfolio } : null);

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      if (userId) {
        const { data: providerRow } = await supabase.from("providers").select("id").eq("id", userId).maybeSingle();
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
        const { data: requirementRow } = await supabase
          .from("customer_requirements")
          .select("id, description")
          .eq("id", requirementId)
          .maybeSingle();

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

    load();

    return () => {
      isMounted = false;
    };
  }, [id, refreshProfileReviews, requirementId, supabase]);

  if (loading) {
    return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted-foreground">Loading profile…</div>;
  }

  if (!provider) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Provider not found</h1>
        <Link href="/discover" className="mt-4 inline-block underline">
          Back to discover
        </Link>
      </div>
    );
  }

  const profile = Array.isArray(provider.profiles) ? provider.profiles[0] : provider.profiles;
  const name = provider.business_name || profile?.full_name || "Provider";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-start gap-4">
        <img
          src={profile?.avatar_url || "/placeholder-avatar.png"}
          alt={name}
          className="h-16 w-16 shrink-0 rounded-full object-cover bg-muted"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{name}</h1>
            {provider.is_verified && <Badge variant="secondary">Verified</Badge>}
          </div>
          <p className="text-muted-foreground">
            {provider.city} · {provider.years_experience ?? 0} yrs experience
          </p>
          {provider.review_count && provider.review_count > 0 ? (
            <p className="mt-1 text-sm">
              ★ {(provider.avg_rating ?? 0).toFixed(1)}{" "}
              <span className="text-muted-foreground">({provider.review_count} reviews)</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">New on Assisto — no reviews yet</p>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-1">
        {(provider.provider_categories ?? []).map((pc) => {
          const category = Array.isArray(pc.service_categories)
            ? pc.service_categories[0]
            : pc.service_categories;

          if (!category) return null;

          return (
            <Badge key={category.id} variant="outline">
              {category.name}
            </Badge>
          );
        })}
      </div>

      {provider.bio && (
        <div className="mb-8">
          <h2 className="mb-1 font-medium">About</h2>
          <p className="whitespace-pre-line text-muted-foreground">{provider.bio}</p>
        </div>
      )}

      {(provider.provider_portfolio_items ?? []).length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 font-medium">Work</h2>

          {(() => {
            const items = (provider.provider_portfolio_items ?? []) as ProviderRecord["provider_portfolio_items"];
            const filteredSortedItems = [...items]
              .filter((item) => {
                if (mediaFilter === "photos") return item.media_type !== "video";
                if (mediaFilter === "videos") return item.media_type === "video";
                return true;
              })
              .sort((a, b) => {
                const aTime = new Date(a.created_at ?? "1970-01-01T00:00:00Z").getTime();
                const bTime = new Date(b.created_at ?? "1970-01-01T00:00:00Z").getTime();
                return sortDirection === "latest" ? bTime - aTime : aTime - bTime;
              });

            const total = filteredSortedItems.length;
            const shouldCollapse = total > 6;
            const visible = shouldCollapse && !showAllWork ? filteredSortedItems.slice(0, 6) : filteredSortedItems;
            const hidden = shouldCollapse && !showAllWork ? filteredSortedItems.slice(6) : [];

            return (
              <div className="space-y-3">
                <div className="mb-3 flex flex-wrap gap-2">
                  {[
                    { value: "all", label: "All" },
                    { value: "photos", label: "Photos" },
                    { value: "videos", label: "Videos" },
                  ].map((option) => {
                    const isActive = mediaFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setMediaFilter(option.value as "all" | "photos" | "videos")}
                        className={`rounded-full border px-3 py-1 text-sm ${isActive ? "bg-foreground text-background" : ""}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}

                  {[
                    { value: "latest", label: "Latest" },
                    { value: "oldest", label: "Oldest" },
                  ].map((option) => {
                    const isActive = sortDirection === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSortDirection(option.value as "latest" | "oldest")}
                        className={`rounded-full border px-3 py-1 text-sm ${isActive ? "bg-foreground text-background" : ""}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {visible.map((item) => {
                    const captionText = item.caption ?? item.description;

                    return (
                      <div key={item.id} className="overflow-hidden rounded-md bg-muted">
                        {item.media_type === "video" ? (
                          <video src={item.image_url} controls className="aspect-square w-full object-cover" />
                        ) : (
                          <img src={item.image_url} alt={captionText || "Portfolio item"} className="aspect-square w-full object-cover" />
                        )}

                        {captionText && (
                          <div className="border-t bg-background p-2">
                            <p className="text-xs text-foreground">{captionText}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {shouldCollapse && (
                  <button
                    type="button"
                    onClick={() => setShowAllWork((current) => !current)}
                    className="relative w-full overflow-hidden rounded-md border bg-muted text-left"
                  >
                    {!showAllWork ? (
                      <>
                        <div className="grid grid-cols-3 gap-3 p-1 opacity-95 blur-[6px]">
                          {hidden.map((item) => {
                            const captionText = item.caption ?? item.description;
                            return (
                              <div key={item.id} className="overflow-hidden rounded-md bg-background">
                                {item.media_type === "video" ? (
                                  <video src={item.image_url} controls className="aspect-square w-full object-cover" />
                                ) : (
                                  <img src={item.image_url} alt={captionText || "Portfolio item"} className="aspect-square w-full object-cover" />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-foreground">
                          <span className="rounded-full bg-background/80 p-2 shadow-sm backdrop-blur-sm">
                            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[2]" aria-hidden="true">
                              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                          <span className="text-sm font-medium">View all work ({total})</span>
                        </div>
                      </>
                    ) : (
                      <div className="relative">
                        <div className="max-h-[calc(6*150px+5*0.75rem)] overflow-y-auto pr-1 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/40 [&::-webkit-scrollbar-track]:bg-transparent">
                          <div className="grid grid-cols-3 gap-3 p-1">
                            {hidden.map((item) => {
                              const captionText = item.caption ?? item.description;
                              return (
                                <div key={item.id} className="overflow-hidden rounded-md bg-background">
                                  {item.media_type === "video" ? (
                                    <video src={item.image_url} controls className="aspect-square w-full object-cover" />
                                  ) : (
                                    <img src={item.image_url} alt={captionText || "Portfolio item"} className="aspect-square w-full object-cover" />
                                  )}
                                  {captionText && (
                                    <div className="border-t bg-background p-2">
                                      <p className="text-xs text-foreground">{captionText}</p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background via-background/70 to-transparent" />
                      </div>
                    )}
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}

      <div className="mb-8">
        <h2 className="mb-2 font-medium">Reviews</h2>
        {provider.review_count && provider.review_count > 0 ? (
          <>
            <div className="mb-4 text-sm">
              <span className="text-yellow-500">★</span>
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
                      <div className="text-yellow-500">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground">{formatDateTime(review.created_at)}</div>
                        {isReported ? (
                          <button disabled className="text-xs text-muted-foreground">
                            Reported
                          </button>
                        ) : (
                          <ReportDialog
                            reportableType="review"
                            reportableId={review.id}
                            triggerLabel="Report"
                            onSuccess={() => setReportedReviews((prev) => new Set([...prev, review.id]))}
                          />
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

      <div className="rounded-lg border p-4">
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
          />
        )}
      </div>

      <div className="mt-4 flex flex-col items-center gap-3">
        {currentUserId && !isCurrentUserProvider && eligibleReviewEnquiries.length > 0 && (
          <div className="w-full max-w-xs">
            {eligibleReviewEnquiries.length === 1 ? (
              <Button
                type="button"
                className="w-full"
                onClick={() => setReviewModalEnquiryId(eligibleReviewEnquiries[0].id)}
              >
                Leave a review
              </Button>
            ) : (
              <div className="space-y-2">
                <Button type="button" className="w-full" onClick={() => setReviewPickerOpen((current) => !current)}>
                  Leave a review
                </Button>
                {reviewPickerOpen && (
                  <div className="rounded-md border border-muted bg-background p-3 text-left shadow-sm">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Choose the completed job
                    </p>
                    <div className="space-y-2">
                      {eligibleReviewEnquiries.map((enquiry) => (
                        <button
                          key={enquiry.id}
                          type="button"
                          onClick={() => {
                            setReviewPickerOpen(false);
                            setReviewModalEnquiryId(enquiry.id);
                          }}
                          className="w-full rounded-md border border-muted bg-muted/30 p-2 text-left transition hover:bg-muted/50"
                        >
                          <div className="text-sm font-medium">
                            {enquiry.customer_requirements?.description || "Completed project"}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Completed {formatDateTime(enquiry.customer_completed_at ?? enquiry.updated_at)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {profileReported ? (
          <button disabled className="text-xs text-muted-foreground">
            Reported
          </button>
        ) : (
          <ReportDialog
            reportableType="provider"
            reportableId={provider.id}
            triggerLabel="Report this profile"
            onSuccess={() => setProfileReported(true)}
          />
        )}
      </div>

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
      <ProviderEnquiryHistory providerId={provider.id} />
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
      const { data: userData } = await supabase.auth.getUser();
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
      if (error) throw error;
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
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  h.status === "accepted" || h.status === "confirmed"
                    ? "bg-green-100 text-green-800"
                    : h.status === "declined" || h.status === "cancelled"
                    ? "bg-red-100 text-red-800"
                    : h.status === "completed"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-800"
                }`}>{h.status}</span>
              </div>
            </div>
            {h.status === "accepted" && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => updateStatus(h.id, "confirmed")}
                  disabled={!!pendingMap[h.id]}
                  className="rounded-md bg-green-600 px-3 py-1 text-sm text-white disabled:opacity-60"
                >
                  {pendingMap[h.id] ? "Confirming…" : "Confirm"}
                </button>
              </div>
            )}
            {(h.status === "confirmed" || h.status === "completed") && (
              <ContactUnlock profileId={providerId} />
            )}
            {errors[h.id] && <p className="mt-2 text-sm text-destructive">{errors[h.id]}</p>}
          </div>
        ))}
      </div>
      <div className="mt-3">
        <Link href="/enquiries" className="text-sm text-blue-600 underline">
          View all my enquiries
        </Link>
      </div>
    </div>
  );
}

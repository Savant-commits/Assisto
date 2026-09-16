"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

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
    description: string | null;
    media_type: string;
  }>;
};

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
        <Link href="/my-enquiries" className="text-sm font-medium underline">
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
  const [initialRequirementMessage, setInitialRequirementMessage] = useState("");
  const [loading, setLoading] = useState(true);

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
           provider_portfolio_items ( id, image_url, description, media_type )`
        )
        .eq("id", id)
        .eq("is_active", true)
        .single();

      if (!isMounted) return;

      setProvider(providerData ?? null);

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
  }, [id, requirementId, supabase]);

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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(provider.provider_portfolio_items ?? []).map((item) => (
              <div key={item.id} className="group relative rounded-md overflow-hidden bg-muted">
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
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="text-xs text-white line-clamp-3">{item.description}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border p-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Contact details unlock once you send an enquiry and the provider confirms.
        </p>
        <EnquiryWidget
          providerId={provider.id}
          providerName={name}
          requirementId={requirementId}
          initialMessage={initialRequirementMessage}
        />
      </div>

      {/* Your history with this provider (only for authenticated users) */}
      <ProviderEnquiryHistory providerId={provider.id} />
    </div>
  );
}

function ProviderEnquiryHistory({ providerId }: { providerId: string }) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<Array<{ id: number; message: string | null; status: string; created_at: string | null }>>([]);
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
        .select("id,message,status,created_at")
        .eq("customer_id", userData.user.id)
        .eq("provider_id", providerId)
        .order("created_at", { ascending: false });

      if (!mounted) return;
      if (!error && data && (data as any).length > 0) {
        setHistory(data as any);
      }
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [providerId]);

  if (loading || history.length === 0) return null;

  return (
    <div className="mt-6 rounded-lg border p-4">
      <h3 className="mb-2 font-medium">Your history with this provider</h3>
      <div className="space-y-2">
        {history.map((h) => (
          <div key={h.id} className="flex items-center justify-between text-sm">
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
        ))}
      </div>
      <div className="mt-3">
        <Link href="/my-enquiries" className="text-sm text-blue-600 underline">
          View all my enquiries
        </Link>
      </div>
    </div>
  );
}

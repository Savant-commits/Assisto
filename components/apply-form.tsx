"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/db-errors";
import { useAuthGate } from "@/components/auth/auth-sheet";
import { PhoneGateDialog } from "@/components/phone-gate-dialog";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import LoadingSpinner from "@/components/loading-spinner";
import { usePhoneVerificationRequired } from "@/components/phone-verification-required-context";

const schema = z.object({
  business_name: z.string().optional(),
  professional_type: z.string().min(2, "e.g. Electrician, Civil Engineer, Interior Designer"),
  years_experience: z.coerce.number().min(0).max(60),
  bio: z.string().min(30, "Tell customers who you are and what you do — at least a few sentences"),
  city: z.enum(["Cuddalore", "Chidambaram"]),
  areas_covered: z.string().optional(),
  service_ids: z.array(z.string().uuid()).min(1, "Select at least one service"),
});

type FormValues = z.output<typeof schema>;
type FormInput = z.input<typeof schema>;

type ExistingApplication = {
  status: string;
  rejection_reason?: string | null;
};

type ServiceCategory = { id: string; name: string; sort_order: number | null };
type Service = { id: string; name: string; category_id: string | null };

function logLookupError(label: string, error: { message: string; code?: string; details?: string; hint?: string }) {
  console.error(label, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

export default function ApplyForm() {
  const phoneVerificationRequired = usePhoneVerificationRequired();
  const router = useRouter();
  const { isAuthenticated, requireAuth } = useAuthGate();
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      business_name: "",
      professional_type: "",
      years_experience: 0,
      bio: "",
      city: "Cuddalore",
      areas_covered: "",
      service_ids: [],
    },
  });

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPhoneGateOpen, setIsPhoneGateOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);

  const [existingApp, setExistingApp] = useState<ExistingApplication | null>(null);
  const [isProvider, setIsProvider] = useState(false);
  const [loading, setLoading] = useState(true);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [servicesRetry, setServicesRetry] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (mounted) setLoading(false);
        return;
      }

      const userId = userData.user.id;

      // Check existing application
      const { data: app, error: appError } = await supabase
        .from("provider_applications")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (appError) logLookupError("apply: existing application lookup failed", appError);

      // Check if already a provider
      const { data: provider, error: providerError } = await supabase.from("providers").select("id").eq("id", userId).maybeSingle();
      if (providerError) logLookupError("apply: existing provider lookup failed", providerError);

      if (!mounted) return;
      setExistingApp(app);
      setIsProvider(!!provider);
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadServices() {
      setServicesLoading(true);
      setServicesError(null);
      try {
        const supabase = createClient();
        const [serviceResult, categoryResult] = await Promise.all([
          supabase.from("services").select("id,name,category_id").order("name"),
          supabase.from("service_categories").select("id,name,sort_order").order("sort_order").order("name"),
        ]);

        if (!mounted) return;
        if (serviceResult.error || categoryResult.error) {
          const error = serviceResult.error ?? categoryResult.error;
          if (error) logLookupError("apply: service list lookup failed", error);
          setServicesError("Could not load services. Please try again.");
          setServicesLoading(false);
          return;
        }

        setServices((serviceResult.data ?? []) as Service[]);
        setServiceCategories((categoryResult.data ?? []) as ServiceCategory[]);
        setServicesLoading(false);
      } catch (error: unknown) {
        if (!mounted) return;
        const lookupError = error instanceof Error ? error : { message: String(error) };
        logLookupError("apply: service list lookup failed", lookupError);
        setServicesError("Could not load services. Please try again.");
        setServicesLoading(false);
      }
    }

    void loadServices();
    return () => {
      mounted = false;
    };
  }, [servicesRetry]);

  async function submitApplication(values: FormValues) {
    if (isSubmitting) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push(`/login?redirect=/apply`);
        return;
      }

      const userId = userData.user.id;
      let phoneVerified = false;
      if (phoneVerificationRequired) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone_verified_at")
          .eq("id", userId)
          .single();
        phoneVerified = !!profile?.phone_verified_at;
        if (!phoneVerified) {
          setPendingValues(values);
          setIsPhoneGateOpen(true);
          return;
        }
      }

      // Prevent duplicates: check existing application or provider
      const { data: existing, error: existingError } = await supabase.from("provider_applications").select("id,status").eq("user_id", userId).maybeSingle();
      if (existingError) logLookupError("apply: duplicate application lookup failed", existingError);
      const { data: provider, error: providerError } = await supabase.from("providers").select("id").eq("id", userId).maybeSingle();
      if (providerError) logLookupError("apply: duplicate provider lookup failed", providerError);
      if (existing) {
        setSubmitError("You have already submitted an application. Check its status.");
        setExistingApp(existing);
        return;
      }
      if (provider) {
        setSubmitError("Your account is already a provider.");
        setIsProvider(true);
        return;
      }

      const { error } = await supabase
        .from("provider_applications")
        .insert({
          ...values,
          user_id: userId,
          status: "pending",
          service_ids: values.service_ids,
          areas_covered: values.areas_covered?.trim() || null,
          service_area_notes: null,
        })
        .select("id,status")
        .single();

      if (error) {
        if (error.message === "PHONE_NOT_VERIFIED" && phoneVerificationRequired && !phoneVerified) {
          setPendingValues(values);
          setIsPhoneGateOpen(true);
          return;
        }
        console.error("apply: insert error", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        setSubmitError(friendlyDbError(error, "An unexpected error occurred"));
      } else {
        router.push("/apply/submitted");
      }
    } catch (error) {
      console.error("apply: submission failed", error);
      const friendlyError = error instanceof Error ? error : { message: String(error) };
      setSubmitError(friendlyDbError(friendlyError, "An unexpected error occurred"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSubmit(values: FormValues) {
    if (isAuthenticated) {
      await submitApplication(values);
      return;
    }
    requireAuth(() => void submitApplication(values), "to apply as a professional");
  }

  function handlePhoneVerified() {
    setIsPhoneGateOpen(false);
    const values = pendingValues;
    setPendingValues(null);
    if (values) void onSubmit(values);
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-0 pb-10">
      <PageHeading title="Apply to join Assisto" description="Tell us about your work. Applications are reviewed before your profile goes live — this keeps the platform trustworthy for customers." />

      {loading ? (
        <div className="py-20">
          <LoadingSpinner size={8} />
        </div>
      ) : isProvider ? (
        <div className="rounded-md border p-6">
          <p className="font-medium">Your account is already a provider.</p>
          <p className="text-sm text-muted-foreground">Your profile is live on the platform.</p>
        </div>
      ) : existingApp ? (
        <div className="rounded-md border p-6">
          <p className="font-medium">Application status: {existingApp.status}</p>
          {existingApp.status === "rejected" && (
            <div className="mt-2 text-sm text-destructive">{existingApp.rejection_reason || "No reason provided."}</div>
          )}
          {existingApp.status === "pending" && (
            <div className="mt-2 text-sm text-muted-foreground">Your application is under review (usually within 24 hours).</div>
          )}
        </div>
      ) : (
        <>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="professional_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What do you do?</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Electrician, Civil Engineer, Interior Designer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="business_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business name (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="If you operate under a business name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="years_experience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Years of experience</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      {...field}
                      value={typeof field.value === "number" || typeof field.value === "string" ? field.value : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>About you / your work</FormLabel>
                  <FormControl>
                    <Textarea rows={5} placeholder="What you do, the kind of work you take on, notable projects" {...field} />
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
                  <FormLabel>Primary location</FormLabel>
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

            <FormField
              control={form.control}
              name="areas_covered"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Areas you cover (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Also travel to nearby villages within 15km" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="service_ids"
              render={({ field }) => {
                const selectedIds = field.value ?? [];
                const uncategorizedServices = services.filter(
                  (service) => !service.category_id || !serviceCategories.some((category) => category.id === service.category_id)
                );

                return (
                  <FormItem>
                    <FormLabel>Services (select all that apply)</FormLabel>
                    {servicesLoading ? (
                      <p className="text-sm text-muted-foreground">Loading services…</p>
                    ) : servicesError ? (
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-destructive" role="alert">{servicesError}</p>
                        <Button type="button" variant="outline" size="sm" onClick={() => setServicesRetry((attempt) => attempt + 1)}>
                          Retry
                        </Button>
                      </div>
                    ) : services.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No services are available right now.</p>
                    ) : (
                      <FormControl>
                        <div className="max-h-64 space-y-3 overflow-auto rounded-md border p-3">
                          {serviceCategories.map((category) => {
                            const categoryServices = services.filter((service) => service.category_id === category.id);
                            if (!categoryServices.length) return null;
                            return (
                              <fieldset key={category.id}>
                                <legend className="mb-1 text-sm font-medium">{category.name}</legend>
                                <div className="grid grid-cols-2 gap-2">
                                  {categoryServices.map((service) => (
                                    <label key={service.id} className="flex items-center gap-2 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.includes(service.id)}
                                        onChange={(event) => field.onChange(
                                          event.target.checked
                                            ? [...selectedIds, service.id]
                                            : selectedIds.filter((id) => id !== service.id)
                                        )}
                                      />
                                      <span>{service.name}</span>
                                    </label>
                                  ))}
                                </div>
                              </fieldset>
                            );
                          })}
                          {uncategorizedServices.length > 0 && (
                            <fieldset>
                              <legend className="mb-1 text-sm font-medium">Other services</legend>
                              <div className="grid grid-cols-2 gap-2">
                                {uncategorizedServices.map((service) => (
                                  <label key={service.id} className="flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.includes(service.id)}
                                      onChange={(event) => field.onChange(
                                        event.target.checked
                                          ? [...selectedIds, service.id]
                                          : selectedIds.filter((id) => id !== service.id)
                                      )}
                                    />
                                    <span>{service.name}</span>
                                  </label>
                                ))}
                              </div>
                            </fieldset>
                          )}
                        </div>
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {submitError && <p className="text-sm text-destructive">{submitError}</p>}

            <p className="text-sm text-muted-foreground">
              {phoneVerificationRequired
                ? "After you apply, someone from Assisto will call you on your verified number to confirm your details."
                : "After you apply, someone from Assisto will call you to confirm your details."}
            </p>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || isSubmitting || servicesLoading || !!servicesError || services.length === 0}>
              {isSubmitting ? "Submitting…" : "Submit application"}
            </Button>
            </form>
          </Form>
          <PhoneGateDialog
            isOpen={isPhoneGateOpen}
            onClose={() => setIsPhoneGateOpen(false)}
            onVerified={handlePhoneVerified}
          />
        </>
      )}
    </div>
  );
}

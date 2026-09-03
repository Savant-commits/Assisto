"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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

const schema = z.object({
  business_name: z.string().optional(),
  professional_type: z.string().min(2, "e.g. Electrician, Civil Engineer, Interior Designer"),
  years_experience: z.coerce.number().min(0).max(60),
  bio: z.string().min(30, "Tell customers who you are and what you do — at least a few sentences"),
  city: z.enum(["Cuddalore", "Chidambaram"]),
  service_area_notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function ApplyPage() {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      business_name: "",
      professional_type: "",
      years_experience: 0,
      bio: "",
      city: "Cuddalore",
      service_area_notes: "",
    },
  });

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [existingApp, setExistingApp] = useState<any | null>(null);
  const [isProvider, setIsProvider] = useState(false);
  const [loading, setLoading] = useState(true);
  const servicesList = [
    "Architecture",
    "Interior Design",
    "Home Design",
    "Commercial Design",
    "Landscape Design",
    "Construction",
    "Renovation",
    "Structural Engineering",
    "Electrical Work",
    "Plumbing",
    "Painting",
    "Flooring",
    "Waterproofing",
    "Carpentry",
    "Furniture",
    "3D Visualization",
    "Project Management",
    "Site Supervision",
    "Cost Estimation",
    "Building Approval",
    "Property Consultation",
    "Vastu Consultation",
    "Electonics assistance",
    "Tech assistance",
    "Home Automation",
  ];
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

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
      const { data: app } = await supabase
        .from("provider_applications")
        .select("*")
        .eq("user_id", userId)
        .single();

      // Check if already a provider
      const { data: provider } = await supabase.from("providers").select("id").eq("id", userId).single();

      if (!mounted) return;
      setExistingApp(app || null);
      setIsProvider(!!provider);
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function onSubmit(values: FormValues) {
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

      // Prevent duplicates: check existing application or provider
      const { data: existing } = await supabase.from("provider_applications").select("id,status").eq("user_id", userId).single();
      const { data: provider } = await supabase.from("providers").select("id").eq("id", userId).single();
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

      // Store selected services as a comma-separated list inside `service_area_notes`.
      const servicesText = selectedServices.join(", ");

      const { data, error } = await supabase
        .from("provider_applications")
        .insert({ ...values, user_id: userId, status: "pending", service_area_notes: servicesText })
        .select("id,status")
        .single();

      if (error) {
        console.error("apply: insert error", error);
        setSubmitError(error.message || "An unexpected error occurred");
      } else {
        router.push("/apply/submitted");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Apply to join Assisto</h1>
      <p className="mb-6 text-muted-foreground">
        Tell us about your work. Applications are reviewed before your profile
        goes live — this keeps the platform trustworthy for customers.
      </p>

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
                    <Input type="number" min={0} max={60} {...field} />
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
              name="service_area_notes"
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

            <div>
              <p className="mb-2 font-medium">Services (select all that apply)</p>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-auto border rounded-md p-2">
                {servicesList.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedServices.includes(s)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedServices((p) => [...p, s]);
                        else setSelectedServices((p) => p.filter((x) => x !== s));
                      }}
                    />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
            </div>

            {submitError && <p className="text-sm text-destructive">{submitError}</p>}

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || isSubmitting}>
              {isSubmitting ? "Submitting…" : "Submit application"}
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}

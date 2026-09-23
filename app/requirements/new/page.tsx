"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ServiceCombobox from "@/components/service-combobox";
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

const schema = z.object({
  title: z.string().min(5, "Give it a short, clear title"),
  description: z.string().min(20, "Add a bit more detail so professionals understand the job"),
  city: z.enum(["Cuddalore", "Chidambaram"]),
  budget_range: z.string().optional(),
  // `service` holds a selected service slug when chosen; free text allowed.
  service: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewRequirementPage() {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", city: "Cuddalore", budget_range: "", service: "" },
  });

  // no client-side category list needed — ServiceCombobox handles services

  async function onSubmit(values: FormValues) {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push(`/login?redirect=/requirements/new`);
      return;
    }

    // Resolve service -> category_id if possible
    let categoryId: number | null = null;
    let serviceSlug: string | undefined = undefined;
    if (values.service) {
      const { data: svc } = await supabase
        .from("services")
        .select("id,slug,name,category_id, service_categories ( slug )")
        .eq("slug", values.service)
        .maybeSingle();
      if (svc) {
        categoryId = svc.category_id || null;
        serviceSlug = svc.slug;
      } else {
        // typed free text, leave categoryId null
        serviceSlug = values.service;
      }
    }

    const { data, error } = await supabase
      .from("customer_requirements")
      .insert({
        title: values.title,
        description: values.description,
        city: values.city,
        budget_range: values.budget_range,
        category_id: categoryId,
        customer_id: userData.user.id,
      })
      .select("id")
      .single();
      
    if (error) {
      console.error("requirements insert error", error);
      // Show a basic client-side message if insert failed
      // (could be improved with a UI component)
      alert(error.message || "Failed to post requirement");
      return;
    }

    if (data) {
      // Build redirect URL: include service, category (resolved), and city if present
      const params = new URLSearchParams();
      if (serviceSlug) params.set("service", serviceSlug);
      if (values.city) params.set("city", values.city);
      // If we resolved a category via the service, include its slug if available
      if (values.service && categoryId) {
        // Attempt to resolve the category slug server-side by fetching it
        const { data: catRow } = await supabase.from("service_categories").select("slug").eq("id", categoryId).maybeSingle();
        if (catRow?.slug) params.set("category", catRow.slug);
      }
      params.set("requirement", data.id);
      router.push(`/discover?${params.toString()}`);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold">What do you need done?</h1>
      <p className="mb-6 text-muted-foreground">
        Describe the job in your own words. We&apos;ll show you professionals who match.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>What do you need?</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Interior work for a 2BHK flat" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tell us more</FormLabel>
                <FormControl>
                  <Textarea rows={5} placeholder="Rooms, timeline, style, anything relevant" {...field} />
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
                <FormLabel>Location</FormLabel>
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
            name="service"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service (optional)</FormLabel>
                <FormControl>
                  <ServiceCombobox
                    value={field.value}
                    onChange={(v) => field.onChange(v)}
                    initialSlug={field.value}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="budget_range"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Budget range (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. ₹1L - ₹2L" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            Find professionals
          </Button>
        </form>
      </Form>
    </div>
  );
}

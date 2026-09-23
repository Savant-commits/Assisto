"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const schema = z.object({
  full_name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
  phone: z.string().min(6, "Enter a phone number"),
  city: z.enum(["Cuddalore", "Chidambaram"]),
});

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "", password: "", phone: "", city: "Cuddalore" },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { full_name: values.full_name } },
    });

    if (error) {
      setFormError(error.message);
      return;
    }

    if (!data.user) {
      setFormError("Something went wrong. Please try again.");
      return;
    }

    // Create the profile row. Safe even if a trigger already created one
    // elsewhere later — upsert avoids a duplicate-key error either way.
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: data.user.id,
      full_name: values.full_name,
      role: "customer",
      phone: values.phone,
      city: values.city,
      email: values.email,
    });

    if (profileError) {
      setFormError(profileError.message);
      return;
    }

    if (data.session) {
      // Email confirmation is off (or already satisfied) — session is live.
      // Use full reload so server components see the session immediately.
      window.location.href = redirectTo;
    } else {
      // Project has "Confirm email" enabled — no session until they click
      // the email link. Show a clear next step instead of a silent stall.
      setNeedsConfirmation(true);
    }
  }

  if (needsConfirmation) {
    return (
      <div className="mx-auto max-w-sm px-4 py-20 text-center">
        <h1 className="mb-2 text-2xl font-semibold">Check your email</h1>
        <p className="text-muted-foreground">
          We sent a confirmation link to your inbox. Click it, then come back
          and <Link href={`/login?redirect=${encodeURIComponent(redirectTo)}`} className="underline">log in</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-1 text-2xl font-semibold">Create your account</h1>
      <p className="mb-6 text-muted-foreground">
        Takes a minute. You&apos;ll need this to post a requirement or apply as a professional.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input placeholder="Your name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="you@example.com" {...field} />
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
                  <Input placeholder="Mobile number" {...field} />
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
                <FormLabel>City / area</FormLabel>
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
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="At least 8 characters" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            Create account
          </Button>
        </form>
      </Form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={`/login?redirect=${encodeURIComponent(redirectTo)}`} className="underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

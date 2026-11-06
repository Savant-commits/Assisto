"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/safe-redirect";
import ResendConfirmation from "@/components/resend-confirmation";
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
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectPath(searchParams.get("redirect"));
  const [formError, setFormError] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setUnconfirmedEmail(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      const lowerMessage = (error.message ?? "").toLowerCase();
      if (error.code === "user_banned" || lowerMessage.includes("banned")) {
        setFormError("This account has been suspended. If you think this is a mistake, contact support.");
        return;
      }

      if (error.code === "email_not_confirmed" || lowerMessage.includes("email not confirmed")) {
        setFormError("Please confirm your email before logging in. You can resend the confirmation link below.");
        setUnconfirmedEmail(values.email);
        return;
      }

      setFormError(
        error.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : error.message
      );
      return;
    }

    // Force a full reload so Server Components (which read cookies) see the
    // new session immediately. router.refresh() alone may not update cookies.
    window.location.assign(redirectTo);
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-1 text-2xl font-semibold">Log in</h1>
      <p className="mb-6 text-muted-foreground">Welcome back to Assisto.</p>
      {searchParams.get("error") === "link_expired" && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          This confirmation link is invalid or has expired. Enter your email below and sign in to request another link.
        </p>
      )}
      {searchParams.get("error") === "profile_setup" && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          Your email was confirmed, but we couldn’t finish setting up your profile. Please contact support.
        </p>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {formError && <p className="text-sm text-destructive">{formError}</p>}
          {unconfirmedEmail && <ResendConfirmation email={unconfirmedEmail} />}

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            Log in
          </Button>
        </form>
      </Form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href={`/signup?redirect=${encodeURIComponent(redirectTo)}`} className="underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

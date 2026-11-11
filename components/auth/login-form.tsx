"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { emailSchema } from "@/lib/email-validation";
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
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

type FormValues = z.infer<typeof schema>;

type LoginFormProps = {
  redirectTo: string;
  onSuccess: () => void;
  onCreateAccount?: () => void;
  autoFocusEmail?: boolean;
  showCreateAccount?: boolean;
};

export default function LoginForm({ redirectTo, onSuccess, onCreateAccount, autoFocusEmail = false, showCreateAccount = true }: LoginFormProps) {
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
    const email = values.email.trim().toLowerCase();

    const { error } = await supabase.auth.signInWithPassword({
      email,
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
        setUnconfirmedEmail(email);
        return;
      }

      setFormError(
        error.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : error.message
      );
      return;
    }

    onSuccess();
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" autoFocus={autoFocusEmail} placeholder="you@example.com" {...field} />
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
                  <Input type="password" autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}
          {unconfirmedEmail && <ResendConfirmation email={unconfirmedEmail} />}

          <Button type="submit" className="min-h-11 w-full" disabled={form.formState.isSubmitting}>
            Log in
          </Button>
        </form>
      </Form>

      {showCreateAccount && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href={`/signup?redirect=${encodeURIComponent(redirectTo)}`} onClick={onCreateAccount} className="rounded-sm underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Create account
          </Link>
        </p>
      )}
    </>
  );
}

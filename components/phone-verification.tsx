"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  initialPhone?: string;
  onVerified: () => void;
  onCancel?: () => void;
};

type Step = "number" | "code";

type AuthErrorInfo = {
  message?: string;
  code?: string;
  status?: number | string;
};

function initialDigits(phone?: string): string | null {
  if (!phone) return null;
  const compact = phone.trim().replace(/[\s().-]/g, "");
  let digits = compact.replace(/\D/g, "");

  if (compact.startsWith("+91") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);

  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

function errorInfo(error: unknown): AuthErrorInfo {
  if (!error || typeof error !== "object") return {};
  return error as AuthErrorInfo;
}

function isAlreadyUsed(error: AuthErrorInfo) {
  const message = (error?.message || "").toLowerCase();
  const code = (error?.code || "").toLowerCase();
  return (
    code.includes("phone_exists") ||
    code.includes("user_already_exists") ||
    message.includes("already exists") ||
    message.includes("already registered") ||
    message.includes("already been taken")
  );
}

function isRateLimited(error: AuthErrorInfo) {
  const message = (error.message || "").toLowerCase();
  const code = (error.code || "").toLowerCase();
  return (
    code.includes("rate_limit") ||
    code.includes("too_many") ||
    message.includes("rate limit") ||
    message.includes("too many") ||
    message.includes("too many requests")
  );
}

function sendErrorMessage(error: AuthErrorInfo) {
  if (isAlreadyUsed(error)) return "This number is already linked to another account.";
  if (isRateLimited(error)) return "Too many attempts. Please wait a few minutes and try again.";
  return "We couldn't send the code right now. Please try again in a few minutes.";
}

function verifyErrorMessage(error: AuthErrorInfo) {
  if (isRateLimited(error)) return "Too many attempts. Please wait a few minutes and try again.";
  const message = (error.message || "").toLowerCase();
  const code = (error.code || "").toLowerCase();
  if (
    code.includes("otp_expired") ||
    code.includes("invalid") ||
    message.includes("expired") ||
    message.includes("invalid") ||
    message.includes("token")
  ) {
    return "That code is not correct or has expired. Request a new one.";
  }
  return "Something went wrong. Please try again.";
}

function developmentErrorDetails(error: unknown) {
  const info = errorInfo(error);
  return `status: ${info.status ?? "unknown"} · code: ${info.code ?? "unknown"} · message: ${info.message ?? "unknown"}`;
}

function formattedPhone(digits: string) {
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function PhoneVerification({ initialPhone, onVerified, onCancel }: Props) {
  const [step, setStep] = useState<Step>("number");
  const [digits, setDigits] = useState(() => initialDigits(initialPhone) || "");
  const [confirmingSavedNumber, setConfirmingSavedNumber] = useState(() => !!initialDigits(initialPhone));
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => {
      setCountdown((remaining) => Math.max(remaining - 1, 0));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  async function sendCode() {
    setErrorMessage(null);
    setErrorDetails(null);
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setErrorMessage("Enter a valid 10-digit mobile number");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ phone: `+91${digits}` });
      if (error) {
        setErrorMessage(sendErrorMessage(error));
        if (process.env.NODE_ENV !== "production") {
          console.error("Phone verification code send failed:", error);
          setErrorDetails(developmentErrorDetails(error));
        }
        return;
      }

      setCode("");
      setErrorMessage(null);
      setErrorDetails(null);
      setStep("code");
      setCountdown(60);
    } catch (error) {
      setErrorMessage(sendErrorMessage(errorInfo(error)));
      if (process.env.NODE_ENV !== "production") {
        console.error("Phone verification code send failed:", error);
        setErrorDetails(developmentErrorDetails(error));
      }
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setErrorDetails(null);
    if (!/^\d{6}$/.test(code)) {
      setErrorMessage("That code is not correct or has expired. Request a new one.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        phone: `+91${digits}`,
        token: code,
        type: "phone_change",
      });

      if (error) {
        setErrorMessage(verifyErrorMessage(error));
        return;
      }

      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        setErrorMessage("Something went wrong. Please try again.");
        return;
      }
      onVerified();
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function changeNumber() {
    setErrorMessage(null);
    setErrorDetails(null);
    setStep("number");
    setConfirmingSavedNumber(false);
    setCode("");
    setCountdown(0);
  }

  return (
    <div className="space-y-4">
      {step === "number" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
          className="space-y-4"
        >
          {confirmingSavedNumber ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We&apos;ll send a verification code to <strong className="font-semibold text-foreground">{formattedPhone(digits)}</strong>
              </p>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Sending…" : "Send code"}
              </Button>
              <button
                type="button"
                className="block w-full text-center text-sm text-muted-foreground underline"
                onClick={() => {
                  setErrorMessage(null);
                  setErrorDetails(null);
                  setConfirmingSavedNumber(false);
                }}
              >
                Use a different number
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label htmlFor="phone-number" className="text-sm font-medium">Mobile number</label>
                <div className="flex gap-2">
                  <span className="flex items-center rounded-md border bg-muted px-3 text-sm">+91</span>
                  <Input
                    id="phone-number"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={10}
                    value={digits}
                    onChange={(event) => setDigits(event.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="10-digit mobile number"
                    aria-describedby="phone-number-note"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Sending…" : "Send code"}
              </Button>
            </>
          )}
          {errorMessage && (
            <div>
              <p role="alert" className="text-sm text-destructive">{errorMessage}</p>
              {errorDetails && <p className="mt-1 text-xs text-muted-foreground">{errorDetails}</p>}
            </div>
          )}
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-4">
          <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to +91{digits}.</p>
          <div className="space-y-2">
            <label htmlFor="phone-verification-code" className="text-sm font-medium">Verification code</label>
            <Input
              id="phone-verification-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
            />
          </div>
          {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Verifying…" : "Verify"}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" className="underline" onClick={changeNumber}>Change number</button>
            <button type="button" className="underline disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || countdown > 0} onClick={() => void sendCode()}>
              {countdown > 0 ? `Resend code in ${countdown}s` : "Resend code"}
            </button>
          </div>
        </form>
      )}

      <p id="phone-number-note" className="text-xs text-muted-foreground">
        We only use your number to verify your account and, once an enquiry is confirmed, to let the other person contact you.
      </p>
      {onCancel && <button type="button" className="text-sm text-muted-foreground underline" onClick={onCancel}>Cancel</button>}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { PhoneVerification } from "@/components/phone-verification";

export function VerifyPhoneForm({
  next,
  initialPhone,
}: {
  next: string;
  initialPhone?: string;
}) {
  const router = useRouter();

  return (
    <PhoneVerification
      initialPhone={initialPhone}
      onVerified={() => router.replace(next)}
    />
  );
}

import Link from "next/link";
import { getPhoneVerificationRequired } from "@/lib/phone-verification-required";

export default async function ApplySubmittedPage() {
  const phoneVerificationRequired = await getPhoneVerificationRequired();

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="mb-2 text-2xl font-semibold">Application received</h1>
      <p className="text-muted-foreground">
        {phoneVerificationRequired
          ? "We’ll review your details and call you on the phone number you verified to confirm your application. Please keep your phone on. Once you are approved, your profile goes live and customers in your area can find you."
          : "We’ll review your details and call you to confirm your application. Please keep your phone on. Once you are approved, your profile goes live and customers in your area can find you."}
      </p>
      <Link href="/apply#credentials" className="mt-6 inline-block text-sm font-medium text-primary underline underline-offset-4">
        Add your credentials
      </Link>
    </div>
  );
}

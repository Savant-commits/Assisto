import Link from "next/link";
import { getPhoneVerificationRequired } from "@/lib/phone-verification-required";
import { PageHeading } from "@/components/page-heading";

export default async function ApplySubmittedPage() {
  const phoneVerificationRequired = await getPhoneVerificationRequired();

  return (
    <div className="mx-auto max-w-xl px-4 pt-0 pb-20 text-center">
      <PageHeading title="Application received" />
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

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthGate } from "@/components/auth/auth-sheet";

type AuthGatedLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  actionLabel?: string;
  onAuthenticated?: () => void;
  "aria-label"?: string;
  "aria-current"?: "page" | undefined;
};

export default function AuthGatedLink({
  href,
  children,
  className,
  actionLabel,
  onAuthenticated,
  ...ariaProps
}: AuthGatedLinkProps) {
  const { isAuthenticated, requireAuth } = useAuthGate();
  const router = useRouter();

  if (isAuthenticated && !onAuthenticated) {
    return <Link href={href} className={className} {...ariaProps}>{children}</Link>;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => requireAuth(onAuthenticated ?? (() => router.push(href)), actionLabel)}
      {...ariaProps}
    >
      {children}
    </button>
  );
}

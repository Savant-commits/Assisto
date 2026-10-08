"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PhoneGateDialog } from "@/components/phone-gate-dialog";

export function PhoneVerifyBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible || pathname === "/login" || pathname === "/signup") return null;

  return (
    <>
      <div className="border-b bg-amber-50 px-4 py-2 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-sm">
          <p>Verify your phone number to send enquiries, post requirements or apply as a provider.</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setIsOpen(true)}>Verify now</Button>
        </div>
      </div>
      <PhoneGateDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onVerified={() => {
          setIsOpen(false);
          setIsVisible(false);
          router.refresh();
        }}
      />
    </>
  );
}

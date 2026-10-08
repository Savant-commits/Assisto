"use client";

import { useEffect, useState } from "react";
import { useEscapeKey } from "@/lib/use-escape-key";
import { createClient } from "@/lib/supabase/client";
import { PhoneVerification } from "@/components/phone-verification";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  initialPhone?: string;
};

function ProfilePhoneVerification({ initialPhone, onVerified }: Pick<Props, "initialPhone" | "onVerified">) {
  const [profilePhone, setProfilePhone] = useState<string | null>(initialPhone || null);
  const [phoneLoaded, setPhoneLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadProfilePhone() {
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          if (mounted) {
            setProfilePhone(initialPhone || null);
            setPhoneLoaded(true);
          }
          return;
        }

        const { data, error } = await supabase.rpc("get_profile_phone", {
          profile_id: userData.user.id,
        });
        if (mounted) {
          setProfilePhone(!error && typeof data === "string" ? data : initialPhone || null);
          setPhoneLoaded(true);
        }
      } catch {
        if (mounted) {
          setProfilePhone(initialPhone || null);
          setPhoneLoaded(true);
        }
      }
    }

    void loadProfilePhone();
    return () => {
      mounted = false;
    };
  }, [initialPhone]);

  if (!phoneLoaded) {
    return <p className="text-sm text-muted-foreground">Loading your saved phone number…</p>;
  }

  return <PhoneVerification initialPhone={profilePhone || initialPhone} onVerified={onVerified} />;
}

export function PhoneGateDialog({ isOpen, onClose, onVerified, initialPhone }: Props) {
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-gate-title"
        className="my-auto w-full max-w-md rounded-xl border bg-background p-6 shadow-xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id="phone-gate-title" className="text-lg font-semibold">Verify your phone number to continue</h2>
          <button type="button" aria-label="Close" className="rounded px-2 text-xl leading-none text-muted-foreground hover:text-foreground" onClick={onClose}>
            ×
          </button>
        </div>
        <ProfilePhoneVerification initialPhone={initialPhone} onVerified={onVerified} />
      </section>
    </div>
  );
}

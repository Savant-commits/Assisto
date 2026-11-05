import "server-only";

import { cache } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

function errorFields(error: unknown) {
  const info = error && typeof error === "object"
    ? error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    : {};

  return {
    message: info.message ?? String(error),
    details: info.details,
    hint: info.hint,
    code: info.code,
  };
}

export const getPhoneVerificationRequired = cache(async (): Promise<boolean> => {
  await connection();

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("phone_verification_required");
    if (error) {
      console.error("phone verification switch lookup failed", errorFields(error));
      return true;
    }

    return data === true;
  } catch (error) {
    console.error("phone verification switch lookup failed", errorFields(error));
    return true;
  }
});

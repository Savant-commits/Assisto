import { cookies } from "next/headers";
import { DEFAULT_LOCATION, isSelectedLocation, LOCATION_COOKIE_NAME } from "@/lib/location/default";
import { createClient } from "@/lib/supabase/server";
import { resolvePhotonLocation } from "@/lib/location/geocoder";
import type { SelectedLocation } from "@/lib/location/types";

export async function getSelectedLocation(): Promise<SelectedLocation> {
  try {
    const value = (await cookies()).get(LOCATION_COOKIE_NAME)?.value;
    if (value) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        parsed = JSON.parse(decodeURIComponent(value));
      }
      if (isSelectedLocation(parsed)) return parsed;
    }

    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return DEFAULT_LOCATION;

    const { data: profile } = await supabase
      .from("profiles")
      .select("city")
      .eq("id", userData.user.id)
      .maybeSingle();
    const savedCity = typeof profile?.city === "string" ? profile.city.trim() : "";
    if (!savedCity) return DEFAULT_LOCATION;

    const resolved = await resolvePhotonLocation(savedCity);
    return resolved ? { ...resolved, source: "search" } : DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
}

import { cookies } from "next/headers";
import { DEFAULT_LOCATION, isSelectedLocation, LOCATION_COOKIE_NAME } from "@/lib/location/default";
import type { SelectedLocation } from "@/lib/location/types";

export async function getSelectedLocation(): Promise<SelectedLocation> {
  try {
    const value = (await cookies()).get(LOCATION_COOKIE_NAME)?.value;
    if (!value) return DEFAULT_LOCATION;

    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = JSON.parse(decodeURIComponent(value));
    }

    return isSelectedLocation(parsed) ? parsed : DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
}

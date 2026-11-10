import { NextRequest, NextResponse } from "next/server";
import { isValidCoords } from "@/lib/maps";
import { allowGeocodeRequest, geocodeResponseHeaders, normalizePhotonFeature, photonBaseUrl, type PhotonFeature } from "@/lib/location/geocoder";

const photonUserAgent = "Assisto/1.0 (Tamil Nadu location search)";

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function GET(request: NextRequest) {
  const latitude = request.nextUrl.searchParams.get("lat");
  const longitude = request.nextUrl.searchParams.get("lng");
  if (!latitude || !longitude) {
    return NextResponse.json({ error: "Latitude and longitude are required." }, { status: 400 });
  }
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isValidCoords(lat, lng)) {
    return NextResponse.json({ error: "Enter valid latitude and longitude coordinates." }, { status: 400 });
  }
  if (!allowGeocodeRequest(clientIp(request))) {
    return NextResponse.json({ error: "Too many location searches. Please try again shortly." }, { status: 429, headers: { "Retry-After": "60" } });
  }

  const photonUrl = new URL(`${photonBaseUrl()}/reverse`);
  photonUrl.searchParams.set("lat", String(lat));
  photonUrl.searchParams.set("lon", String(lng));
  photonUrl.searchParams.set("lang", "en");

  try {
    const response = await fetch(photonUrl, {
      headers: { "User-Agent": photonUserAgent, Accept: "application/json" },
      cache: "force-cache",
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error("Geocoder returned an unsuccessful response.");
    const payload = await response.json() as { features?: PhotonFeature[] };
    const location = (payload.features || []).map(normalizePhotonFeature).find((item) => item !== null) ?? null;
    return NextResponse.json({ location }, { headers: geocodeResponseHeaders() });
  } catch {
    return NextResponse.json(
      { error: "Location lookup is temporarily unavailable. Please try again." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
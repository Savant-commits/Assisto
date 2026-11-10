import { NextRequest, NextResponse } from "next/server";
import { allowGeocodeRequest, geocodeResponseHeaders, normalizePhotonFeature, photonBaseUrl, type PhotonFeature } from "@/lib/location/geocoder";

const photonUserAgent = "Assisto/1.0 (Tamil Nadu location search)";

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (query.length < 3 || query.length > 100) {
    return NextResponse.json({ error: "Enter a location between 3 and 100 characters." }, { status: 400 });
  }
  if (!allowGeocodeRequest(clientIp(request))) {
    return NextResponse.json({ error: "Too many location searches. Please try again shortly." }, { status: 429, headers: { "Retry-After": "60" } });
  }

  const photonUrl = new URL(`${photonBaseUrl()}/api/`);
  photonUrl.searchParams.set("q", query);
  photonUrl.searchParams.set("limit", "8");
  photonUrl.searchParams.set("lang", "en");
  photonUrl.searchParams.set("bbox", "76.2,8.0,80.4,13.6");
  photonUrl.searchParams.set("lat", "11.3993");
  photonUrl.searchParams.set("lon", "79.6914");

  try {
    const response = await fetch(photonUrl, {
      headers: { "User-Agent": photonUserAgent, Accept: "application/json" },
      cache: "force-cache",
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error("Geocoder returned an unsuccessful response.");
    const payload = await response.json() as { features?: PhotonFeature[] };
    const results = (payload.features || [])
      .map(normalizePhotonFeature)
      .filter((location) => location !== null)
      .slice(0, 8);
    return NextResponse.json({ results }, { headers: geocodeResponseHeaders() });
  } catch {
    return NextResponse.json(
      { error: "Location search is temporarily unavailable. Please try again." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
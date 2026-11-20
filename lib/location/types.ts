export type LocationSource = "default" | "search" | "map" | "device" | "manual";

export type SelectedLocation = {
  label: string;
  locality: string;
  city: string | null;
  state: string;
  lat: number | null;
  lng: number | null;
  source: LocationSource;
  formattedLabel?: string;
  street?: string | null;
  houseNumber?: string | null;
  area?: string | null;
  neighbourhood?: string | null;
  suburb?: string | null;
  district?: string | null;
  landmark?: string | null;
  name?: string | null;
  postcode?: string | null;
};

export type GeocodedLocation = SelectedLocation & {
  id: string;
  kind: string;
};

export function isValidCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

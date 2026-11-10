export type LocationSource = "default" | "search" | "map" | "device" | "manual";

export type SelectedLocation = {
  label: string;
  locality: string;
  city: string | null;
  state: string;
  lat: number | null;
  lng: number | null;
  source: LocationSource;
};

export type GeocodedLocation = SelectedLocation & {
  id: string;
  name: string;
  district: string | null;
  kind: string;
};

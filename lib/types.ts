export type ServiceCategory = {
  id: number;
  slug: string;
  name: string;
};

export type ProviderProfile = {
  full_name?: string | null;
  avatar_url?: string | null;
};

export type ProviderListItem = {
  id: string;
  business_name?: string | null;
  headline?: string | null;
  city?: string | null;
  avg_rating?: number | null;
  review_count?: number | null;
  is_verified?: boolean | null;
  profiles?: ProviderProfile | null;
};

export type ServiceCategory = {
  id: number;
  slug: string;
  name: string;
};

export type ProviderProfile = {
  full_name?: string | null;
  avatar_url?: string | null;
};

export type ProviderPortfolioItem = {
  id: string;
  image_url?: string | null;
  caption?: string | null;
  description?: string | null;
  media_type?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
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
  provider_portfolio_items?: ProviderPortfolioItem[] | null;
};

export type ProjectMessageAttachment = {
  id: string;
  message_id: string;
  project_id: string;
  uploader_id: string;
  kind: "photo" | "video" | "file";
  bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  deleted_at: string | null;
};

export type ProjectMessage = {
  id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

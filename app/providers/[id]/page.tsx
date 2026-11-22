import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import ProviderProfileClient from "@/components/provider/provider-profile-client";

type PageProps = {
  params: Promise<{ id: string }>;
};

type ProviderMetadataRecord = {
  business_name: string | null;
  city: string | null;
  locality: string | null;
  headline: string | null;
  provider_categories?: Array<{
    service_categories?: { name?: string | null } | Array<{ name?: string | null }> | null;
  }> | null;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("providers")
    .select("business_name, city, locality, headline, provider_categories(service_categories(name))")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("provider metadata lookup failed:", error.message, error.details, error.hint, error.code);
    return {
      title: "Professional | Assisto",
      description: "Browse a professional profile on Assisto.",
    };
  }

  if (!data) {
    return {
      title: "Provider not found | Assisto",
      robots: { index: false, follow: false },
    };
  }

  const provider = data as unknown as ProviderMetadataRecord;
  const firstRelation = provider.provider_categories?.[0]?.service_categories;
  const firstCategory = Array.isArray(firstRelation) ? firstRelation[0]?.name : firstRelation?.name;
  const category = firstCategory?.trim() || "Professional";
  const businessName = provider.business_name?.trim() || "Provider";
  const city = provider.city?.trim() || provider.locality?.trim() || "your area";
  const description = provider.headline?.trim() || `Browse ${category} professionals in ${city}.`;

  return {
    title: `${businessName} | ${category} in ${city} | Assisto`,
    description,
  };
}

export default async function ProviderProfilePage({ params }: PageProps) {
  const { id } = await params;
  return <ProviderProfileClient id={id} />;
}

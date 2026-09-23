import { createClient } from "@/lib/supabase/server";
import { ProviderCard } from "@/components/provider-card";
import ServicePicker from "@/components/service-picker";
import type { ProviderListItem, ServiceCategory } from "@/lib/types";

const CITIES = ["Cuddalore", "Chidambaram"];

function buildDiscoverUrl({ city, category, service, requirement, sort }: { city?: string; category?: string; service?: string; requirement?: string; sort?: string }) {
  const params = new URLSearchParams();
  if (city) params.set("city", city);
  if (category) params.set("category", category);
  if (service) params.set("service", service);
  if (requirement) params.set("requirement", requirement);
  if (sort && sort !== "recommended") params.set("sort", sort);
  return `/discover?${params.toString()}`;
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; city?: string; requirement?: string; service?: string; sort?: string }>;
}) {
  const { category, city, requirement, service, sort } = await searchParams;
  const selectedSort = sort === "top-rated" ? "top-rated" : "recommended";
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("service_categories")
    .select("id, slug, name")
    .order("sort_order");

  // Resolve any explicit service filter to an id
  let serviceRecord: { id?: number; slug?: string; name?: string; category_id?: number } | null = null;
  if (service) {
    const { data: svc } = await supabase
      .from("services")
      .select("id,slug,name,category_id")
      .eq("slug", service)
      .maybeSingle();
    if (svc) serviceRecord = svc;
  }

  // If we will filter by service (explicit or via auto-matching), include a provider_services inner join in the select
  let includeProviderServices = Boolean(serviceRecord);

  const providerCategoriesSelect = category
    ? "provider_categories!inner ( service_categories ( id, slug, name ) )"
    : "provider_categories ( service_categories ( id, slug, name ) )";

  const querySelect =
    `id, business_name, headline, city, avg_rating, review_count, is_verified,
         profiles ( full_name, avatar_url, email ),
         ${providerCategoriesSelect},
         provider_portfolio_items ( id, image_url, description, media_type, created_at )`;

  // Matched service ids from requirement auto-matching
  let matchedServiceIds: number[] = [];

  // If a requirement id is present, attempt to match providers by the
  // requirement's city and by any service names mentioned in the description.
  // Only run auto-matching when there is a requirement param AND no explicit service param.
  let reqData: { id?: string | number; title?: string | null; description?: string | null; city?: string | null } | null = null;
  if (requirement && !service) {
    const { data: req } = await supabase
      .from("customer_requirements")
      .select("id, title, description, city")
      .eq("id", requirement)
      .single();
    reqData = req;
    if (req?.description) {
      const { data: allServices } = await supabase.from("services").select("id,slug,name").eq("is_active", true);
      const matchedServices = (allServices || []).filter((s: { id: number; name?: string | null }) =>
        req.description.toLowerCase().includes((s.name || "").toLowerCase())
      );
      matchedServiceIds = matchedServices.map((m: { id: number }) => m.id).filter(Boolean);
      if (matchedServiceIds.length) includeProviderServices = true;
    }
  }

  // Build final select including provider_services join when required
  const finalSelect = includeProviderServices ? querySelect + ", provider_services!inner ( service_id )" : querySelect;

  let query = supabase.from("providers").select(finalSelect).eq("is_active", true);

  // Apply city filter: explicit param or requirement's city (explicit city wins)
  if (city) query = query.eq("city", city);
  else if (reqData?.city) query = query.eq("city", reqData.city);

  // Category filter
  if (category) {
    const selectedCategory = (categories as ServiceCategory[] | null | undefined)?.find((c) => c.slug === category);
    if (selectedCategory) {
      query = query.eq("provider_categories.category_id", selectedCategory.id);
    }
  }

  // Apply explicit service filter
  if (serviceRecord) {
    query = query.eq("provider_services.service_id", serviceRecord.id);
  }

  // Apply matched service ids from requirement auto-matching
  if (matchedServiceIds.length) {
    query = query.in("provider_services.service_id", matchedServiceIds as number[]);
  }

  const { data: providers } = await query;
  const sortedProviders = [...((providers as ProviderListItem[]) || [])].sort((a, b) => {
    if (selectedSort !== "top-rated") return 0;

    const aCount = Number(a.review_count ?? 0);
    const bCount = Number(b.review_count ?? 0);
    const aRating = Number(a.avg_rating ?? 0);
    const bRating = Number(b.avg_rating ?? 0);

    if (aCount === 0 && bCount === 0) return (bRating ?? 0) - (aRating ?? 0);
    if (aCount === 0) return 1;
    if (bCount === 0) return -1;
    if (bRating !== aRating) return (bRating ?? 0) - (aRating ?? 0);
    return bCount - aCount;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Find a professional</h1>
      <p className="mb-6 text-muted-foreground">
        Browse verified professionals in Cuddalore and Chidambaram.
      </p>

      <div className="mb-6 flex flex-wrap gap-2 items-center">
        <div className="w-full sm:w-auto mb-2 sm:mb-0">
          <ServicePicker initialSlug={service} category={category} city={city} requirement={requirement} />
        </div>
        {CITIES.map((c) => {
          const isActive = city === c;
          return (
            <a
              key={c}
              href={buildDiscoverUrl({ city: isActive ? undefined : c, category, service, requirement, sort: selectedSort })}
              className={`rounded-full border px-3 py-1 text-sm ${isActive ? "bg-foreground text-background" : ""}`}
            >
              {c}
            </a>
          );
        })}
        {(categories as ServiceCategory[] | null)?.map((cat) => {
          const isActive = category === cat.slug;
          return (
            <a
              key={cat.id}
              href={buildDiscoverUrl({ city, category: isActive ? undefined : cat.slug, service, requirement, sort: selectedSort })}
              className={`rounded-full border px-3 py-1 text-sm ${isActive ? "bg-foreground text-background" : ""}`}
            >
              {cat.name}
            </a>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort:</span>
          {[
            { value: "recommended", label: "Recommended" },
            { value: "top-rated", label: "Top rated" },
          ].map((option) => {
            const isActive = selectedSort === option.value;
            return (
              <a
                key={option.value}
                href={buildDiscoverUrl({ city, category, service, requirement, sort: isActive ? undefined : option.value })}
                className={`rounded-full border px-3 py-1 text-sm ${isActive ? "bg-foreground text-background" : ""}`}
              >
                {option.label}
              </a>
            );
          })}
        </div>
      </div>

      {!sortedProviders.length ? (
        <p className="text-muted-foreground">
          No professionals match yet. Try a different filter, or{" "}
          <a href="/requirements/new" className="underline">
            post what you need
          </a>{" "}
          and we&apos;ll help you find someone.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(sortedProviders as unknown as ProviderListItem[]).map((p) => (
            <ProviderCard key={p.id} provider={p} requirement={requirement} />
          ))}
        </div>
      )}
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { ProviderCard } from "@/components/provider-card";
import type { ProviderListItem, ServiceCategory } from "@/lib/types";

const CITIES = ["Cuddalore", "Chidambaram"];

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; city?: string }>;
}) {
  const { category, city } = await searchParams;
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("service_categories")
    .select("id, slug, name")
    .order("sort_order");

  let query = supabase
    .from("providers")
    .select(
      `id, business_name, headline, city, avg_rating, review_count, is_verified,
       profiles ( full_name, avatar_url ),
       provider_categories ( service_categories ( id, slug, name ) )`
    )
    .eq("is_active", true);

  if (city) query = query.eq("city", city);
  if (category) {
    query = query.eq("provider_categories.service_categories.slug", category);
  }

  const { data: providers } = await query;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Find a professional</h1>
      <p className="mb-6 text-muted-foreground">
        Browse verified professionals in Cuddalore and Chidambaram.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {CITIES.map((c) => (
          <a
            key={c}
            href={`/discover?city=${c}${category ? `&category=${category}` : ""}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              city === c ? "bg-foreground text-background" : ""
            }`}
          >
            {c}
          </a>
        ))}
        {(categories as ServiceCategory[] | null)?.map((cat) => (
          <a
            key={cat.id}
            href={`/discover?category=${cat.slug}${city ? `&city=${city}` : ""}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              category === cat.slug ? "bg-foreground text-background" : ""
            }`}
          >
            {cat.name}
          </a>
        ))}
      </div>

      {!providers?.length ? (
        <p className="text-muted-foreground">
          No professionals match yet. Try a different filter, or{" "}
          <a href="/requirements/new" className="underline">
            post what you need
          </a>{" "}
          and we&apos;ll help you find someone.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(providers as unknown as ProviderListItem[]).map((p) => (
            <ProviderCard key={p.id} provider={p} />
          ))}
        </div>
      )}
    </div>
  );
}

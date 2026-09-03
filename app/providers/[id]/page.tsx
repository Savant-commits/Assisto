import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function ProviderProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: provider } = await supabase
    .from("providers")
    .select(
      `id, business_name, headline, bio, years_experience, city, is_verified,
       avg_rating, review_count,
       profiles ( full_name ),
       provider_categories ( service_categories ( id, name ) ),
       provider_portfolio_items ( id, image_url, caption )`
    )
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (!provider) notFound();

  const name = provider.business_name || provider.profiles?.full_name || "Provider";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-start gap-4">
        <div className="h-16 w-16 shrink-0 rounded-full bg-muted" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{name}</h1>
            {provider.is_verified && <Badge variant="secondary">Verified</Badge>}
          </div>
          <p className="text-muted-foreground">
            {provider.city} · {provider.years_experience ?? 0} yrs experience
          </p>
          {provider.review_count > 0 ? (
            <p className="mt-1 text-sm">
              ★ {provider.avg_rating.toFixed(1)}{" "}
              <span className="text-muted-foreground">({provider.review_count} reviews)</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">New on Assisto — no reviews yet</p>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-1">
        {provider.provider_categories.map((pc) => (
          <Badge key={pc.service_categories.id} variant="outline">
            {pc.service_categories.name}
          </Badge>
        ))}
      </div>

      {provider.bio && (
        <div className="mb-8">
          <h2 className="mb-1 font-medium">About</h2>
          <p className="whitespace-pre-line text-muted-foreground">{provider.bio}</p>
        </div>
      )}

      {provider.provider_portfolio_items.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 font-medium">Work</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {provider.provider_portfolio_items.map((item) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={item.id}
                src={item.image_url}
                alt={item.caption ?? ""}
                className="aspect-square rounded-md object-cover"
              />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border p-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Contact details unlock once you send an enquiry and the provider confirms.
        </p>
        <Button className="w-full" disabled title="Enquiry flow lands in Phase 2">
          Send enquiry (coming next)
        </Button>
      </div>
    </div>
  );
}

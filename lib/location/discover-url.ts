export function buildDiscoverUrl(params: {
  category?: string;
  service?: string;
  city?: string | null;
}): string {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.service) query.set("service", params.service);
  if (params.city) query.set("city", params.city);
  const search = query.toString();
  return search ? `/discover?${search}` : "/discover";
}

-- Lets an approved provider manage their own category/service links directly.
-- Previously these tables only had public SELECT policies; every row was
-- inserted by hand via the SQL editor.

ALTER TABLE public.provider_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_services ENABLE ROW LEVEL SECURITY;

-- === provider_categories ===
DROP POLICY IF EXISTS "provider_categories_insert_own" ON public.provider_categories;
DROP POLICY IF EXISTS "provider_categories_delete_own" ON public.provider_categories;

CREATE POLICY "provider_categories_insert_own"
  ON public.provider_categories
  FOR INSERT
  WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "provider_categories_delete_own"
  ON public.provider_categories
  FOR DELETE
  USING (auth.uid() = provider_id);

-- === provider_services ===
DROP POLICY IF EXISTS "provider_services_insert_own" ON public.provider_services;
DROP POLICY IF EXISTS "provider_services_delete_own" ON public.provider_services;

CREATE POLICY "provider_services_insert_own"
  ON public.provider_services
  FOR INSERT
  WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "provider_services_delete_own"
  ON public.provider_services
  FOR DELETE
  USING (auth.uid() = provider_id);

-- No UPDATE policy — the UI always adds/removes rows rather than editing
-- them in place, matching the provider_portfolio_items pattern.
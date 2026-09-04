-- Enable RLS on tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

-- === Drop existing policies (if any) ===
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "portfolio_items_select_public" ON public.provider_portfolio_items;
DROP POLICY IF EXISTS "portfolio_items_insert_own" ON public.provider_portfolio_items;
DROP POLICY IF EXISTS "portfolio_items_update_own" ON public.provider_portfolio_items;
DROP POLICY IF EXISTS "portfolio_items_delete_own" ON public.provider_portfolio_items;
DROP POLICY IF EXISTS "providers_select_public" ON public.providers;

-- === Profiles table policies ===
-- Users can view all profiles (for discovery)
CREATE POLICY "profiles_select_public"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (via auth.uid trigger)
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- === Provider Portfolio Items policies ===
-- Anyone can view portfolio items (for discovery/profile viewing)
CREATE POLICY "portfolio_items_select_public"
  ON public.provider_portfolio_items
  FOR SELECT
  USING (true);

-- Providers can insert their own portfolio items
CREATE POLICY "portfolio_items_insert_own"
  ON public.provider_portfolio_items
  FOR INSERT
  WITH CHECK (auth.uid() = provider_id);

-- Providers can update their own portfolio items
CREATE POLICY "portfolio_items_update_own"
  ON public.provider_portfolio_items
  FOR UPDATE
  USING (auth.uid() = provider_id)
  WITH CHECK (auth.uid() = provider_id);

-- Providers can delete their own portfolio items
CREATE POLICY "portfolio_items_delete_own"
  ON public.provider_portfolio_items
  FOR DELETE
  USING (auth.uid() = provider_id);

-- === Providers table policies ===
-- Anyone can view providers
CREATE POLICY "providers_select_public"
  ON public.providers
  FOR SELECT
  USING (true);

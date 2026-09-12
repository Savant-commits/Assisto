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
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_select_public" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_update_own" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_delete_own" ON storage.objects;

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

-- === Storage policies: allow authenticated users to upload their own media under a user-scoped folder ===
-- Public read access for the media buckets so portfolio items and avatars can be shown on profiles and discovery pages.
CREATE POLICY "avatars_select_public"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND COALESCE((storage.foldername(name))[0], '') = auth.uid()::text
  );

CREATE POLICY "avatars_update_own"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND COALESCE((storage.foldername(name))[0], '') = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND COALESCE((storage.foldername(name))[0], '') = auth.uid()::text
  );

CREATE POLICY "avatars_delete_own"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND COALESCE((storage.foldername(name))[0], '') = auth.uid()::text
  );

CREATE POLICY "portfolio_select_public"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'portfolio');

CREATE POLICY "portfolio_insert_own"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'portfolio'
    AND auth.role() = 'authenticated'
    AND COALESCE((storage.foldername(name))[0], '') = auth.uid()::text
  );

CREATE POLICY "portfolio_update_own"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'portfolio'
    AND auth.role() = 'authenticated'
    AND COALESCE((storage.foldername(name))[0], '') = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'portfolio'
    AND auth.role() = 'authenticated'
    AND COALESCE((storage.foldername(name))[0], '') = auth.uid()::text
  );

CREATE POLICY "portfolio_delete_own"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'portfolio'
    AND auth.role() = 'authenticated'
    AND COALESCE((storage.foldername(name))[0], '') = auth.uid()::text
  );

-- === Providers table policies ===
-- Anyone can view providers
CREATE POLICY "providers_select_public"
  ON public.providers
  FOR SELECT
  USING (true);

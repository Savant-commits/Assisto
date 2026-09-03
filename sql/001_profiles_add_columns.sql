-- Add missing profile columns used by the app
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Optional: create an index on email for quick lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

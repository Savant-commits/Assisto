-- Insert providers for applications that were approved directly in SQL
-- This will create providers rows for user_ids that have an approved application
-- but no corresponding providers entry yet. Columns match the server-side
-- `approveApplication` insertion logic used by the app.

INSERT INTO public.providers (
  id,
  application_id,
  business_name,
  headline,
  bio,
  years_experience,
  city,
  is_active,
  created_at
)
SELECT
  pa.user_id as id,
  pa.id as application_id,
  pa.business_name,
  pa.professional_type as headline,
  pa.bio,
  pa.years_experience,
  pa.city,
  true as is_active,
  now() as created_at
FROM public.provider_applications pa
LEFT JOIN public.providers p ON p.id = pa.user_id
WHERE pa.status = 'approved' AND p.id IS NULL;

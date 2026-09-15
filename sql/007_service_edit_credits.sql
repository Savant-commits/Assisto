-- Caps how many times an approved provider can edit their own
-- provider_services rows after the initial approval-time auto-seed.
-- The auto-seed (run via the service_role key in approveApplication) is
-- exempt — only edits made through the provider's own authenticated
-- session count against the limit.

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS service_edit_credits integer NOT NULL DEFAULT 5;

CREATE OR REPLACE FUNCTION public.enforce_provider_service_edit_limit()
RETURNS trigger AS $$
DECLARE
  target_provider_id uuid;
  remaining integer;
BEGIN
  -- Service-role writes (the approval-time auto-seed) don't count.
  IF auth.role() = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  target_provider_id := COALESCE(NEW.provider_id, OLD.provider_id);

  SELECT service_edit_credits INTO remaining
  FROM public.providers
  WHERE id = target_provider_id
  FOR UPDATE;

  IF remaining IS NULL OR remaining <= 0 THEN
    RAISE EXCEPTION 'No service edits remaining. Contact support to request more.';
  END IF;

  UPDATE public.providers
  SET service_edit_credits = service_edit_credits - 1
  WHERE id = target_provider_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS provider_services_edit_limit ON public.provider_services;
CREATE TRIGGER provider_services_edit_limit
  BEFORE INSERT OR DELETE ON public.provider_services
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_provider_service_edit_limit();
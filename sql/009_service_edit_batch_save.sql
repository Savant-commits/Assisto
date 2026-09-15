-- 009_service_edit_batch_save_fix.sql
-- Correction: services.id, service_categories.id, provider_services.service_id,
-- and provider_categories.category_id are all uuid, not integer.

DROP FUNCTION IF EXISTS public.save_provider_services(integer[]);
DROP FUNCTION IF EXISTS public.save_provider_services(uuid[]);

CREATE OR REPLACE FUNCTION public.save_provider_services(p_service_ids uuid[])
RETURNS integer -- returns remaining credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid := auth.uid();
  remaining integer;
  current_service_ids uuid[];
  to_add uuid[];
  to_remove uuid[];
  category_ids uuid[];
  has_changes boolean;
BEGIN
  IF pid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.providers WHERE id = pid) THEN
    RAISE EXCEPTION 'Not a provider';
  END IF;

  SELECT COALESCE(array_agg(service_id), '{}') INTO current_service_ids
  FROM public.provider_services WHERE provider_id = pid;

  SELECT COALESCE(array_agg(x), '{}') INTO to_add
  FROM unnest(p_service_ids) x WHERE x <> ALL(current_service_ids);

  SELECT COALESCE(array_agg(x), '{}') INTO to_remove
  FROM unnest(current_service_ids) x WHERE x <> ALL(p_service_ids);

  has_changes := array_length(to_add, 1) > 0 OR array_length(to_remove, 1) > 0;

  IF NOT has_changes THEN
    SELECT service_edit_credits INTO remaining FROM public.providers WHERE id = pid;
    RETURN remaining;
  END IF;

  SELECT service_edit_credits INTO remaining
  FROM public.providers WHERE id = pid FOR UPDATE;

  IF remaining IS NULL OR remaining <= 0 THEN
    RAISE EXCEPTION 'No service edits remaining. Contact support to request more.';
  END IF;

  IF array_length(to_remove, 1) > 0 THEN
    DELETE FROM public.provider_services
    WHERE provider_id = pid AND service_id = ANY(to_remove);
  END IF;

  IF array_length(to_add, 1) > 0 THEN
    INSERT INTO public.provider_services (provider_id, service_id)
    SELECT pid, x FROM unnest(to_add) x
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT category_id), '{}') INTO category_ids
  FROM public.services WHERE id = ANY(p_service_ids);

  DELETE FROM public.provider_categories
  WHERE provider_id = pid AND category_id <> ALL(category_ids);

  INSERT INTO public.provider_categories (provider_id, category_id)
  SELECT pid, c FROM unnest(category_ids) c
  ON CONFLICT DO NOTHING;

  UPDATE public.providers
  SET service_edit_credits = service_edit_credits - 1
  WHERE id = pid
  RETURNING service_edit_credits INTO remaining;

  RETURN remaining;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_provider_services(uuid[]) TO authenticated;
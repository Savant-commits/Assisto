-- 010_phone_lockdown.sql

-- 1. Revoke direct column access to phone for both anon and authenticated.
--    RLS policies can't do this — they gate rows, not columns — so as long as
--    a policy lets a role read a profiles row at all, "select phone" would
--    succeed too. This is the actual fix.
revoke select (phone) on public.profiles from authenticated;
revoke select (phone) on public.profiles from anon;

-- 2. The only sanctioned way to read a phone number, going forward.
--    SECURITY DEFINER lets it bypass the column revoke above, but only
--    for the two cases we explicitly allow inside the function body.
create or replace function public.get_profile_phone(profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  result text;
begin
  if auth.uid() = profile_id then
    -- reading your own phone (e.g. profile edit screen)
    select phone into result from profiles where id = profile_id;
  elsif exists (
    select 1 from enquiries
    where status = 'confirmed'
      and (
        (customer_id = profile_id and provider_id = auth.uid())
        or (provider_id = profile_id and customer_id = auth.uid())
      )
  ) then
    -- contact-unlock case: caller and profile_id are the two sides
    -- of a confirmed enquiry, in either direction
    select phone into result from profiles where id = profile_id;
  else
    result := null;
  end if;

  return result;
end;
$$;

revoke all on function public.get_profile_phone(uuid) from public;
grant execute on function public.get_profile_phone(uuid) to authenticated;
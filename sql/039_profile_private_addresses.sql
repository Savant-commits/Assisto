begin;

create table public.profile_private_addresses (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  street text,
  house_number text,
  area text,
  city text,
  pincode text,
  lat double precision,
  lng double precision,
  constraint profile_private_addresses_text_length_chk check (
    (street is null or char_length(street) <= 200)
    and (house_number is null or char_length(house_number) <= 50)
    and (area is null or char_length(area) <= 200)
    and (city is null or char_length(city) <= 120)
  ),
  constraint profile_private_addresses_pincode_chk check (
    pincode is null or pincode ~ '^[0-9]{6}$'
  ),
  constraint profile_private_addresses_coords_chk check (
    (lat is null and lng is null)
    or (
      lat is not null and lng is not null
      and lat between -90 and 90
      and lng between -180 and 180
    )
  ),
  constraint profile_private_addresses_nonempty_chk check (
    nullif(btrim(coalesce(street, '')), '') is not null
    or nullif(btrim(coalesce(house_number, '')), '') is not null
    or nullif(btrim(coalesce(area, '')), '') is not null
    or nullif(btrim(coalesce(city, '')), '') is not null
    or nullif(btrim(coalesce(pincode, '')), '') is not null
  )
);

alter table public.profile_private_addresses enable row level security;

revoke all on table public.profile_private_addresses from public, anon, authenticated;
grant select, insert, update, delete on table public.profile_private_addresses to authenticated;

create policy "profile owner reads private address"
  on public.profile_private_addresses
  for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "profile owner inserts private address"
  on public.profile_private_addresses
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

create policy "profile owner updates private address"
  on public.profile_private_addresses
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "profile owner deletes private address"
  on public.profile_private_addresses
  for delete to authenticated
  using (profile_id = (select auth.uid()));

commit;

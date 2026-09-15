-- Make sure new rows default to 'sent' unless the app says otherwise.
alter table public.enquiries alter column status set default 'sent';

create index if not exists enquiries_provider_id_idx on public.enquiries (provider_id);
create index if not exists enquiries_customer_id_idx on public.enquiries (customer_id);
create index if not exists enquiries_requirement_id_idx on public.enquiries (requirement_id);

-- Prevents a customer from spamming the same provider with duplicate
-- outstanding enquiries. Uses 'sent' since this schema has no 'pending'.
create unique index if not exists enquiries_unique_sent_per_pair
  on public.enquiries (customer_id, provider_id)
  where status = 'sent';

alter table public.enquiries enable row level security;

drop policy if exists "customers can create enquiries" on public.enquiries;
create policy "customers can create enquiries"
  on public.enquiries for insert
  with check (auth.uid() = customer_id and status = 'sent');

drop policy if exists "customers can view own enquiries" on public.enquiries;
create policy "customers can view own enquiries"
  on public.enquiries for select
  using (auth.uid() = customer_id);

drop policy if exists "providers can view their enquiries" on public.enquiries;
create policy "providers can view their enquiries"
  on public.enquiries for select
  using (auth.uid() = provider_id);

-- Provider can only move sent -> accepted/declined.
drop policy if exists "providers can accept or decline" on public.enquiries;
create policy "providers can accept or decline"
  on public.enquiries for update
  using (auth.uid() = provider_id and status = 'sent')
  with check (auth.uid() = provider_id and status in ('accepted', 'declined'));

-- Customer can only confirm an enquiry the provider already accepted —
-- enforces "customer makes the final call" at the DB level.
drop policy if exists "customers can confirm accepted enquiries" on public.enquiries;
create policy "customers can confirm accepted enquiries"
  on public.enquiries for update
  using (auth.uid() = customer_id and status = 'accepted')
  with check (auth.uid() = customer_id and status = 'confirmed');

-- Stamp contact_unlocked_at automatically the moment an enquiry becomes
-- confirmed — the column already exists, this just starts populating it,
-- and gives Step 4 a ready-made "is contact unlocked" check with no
-- separate lookup against status needed.
create or replace function public.set_contact_unlocked_at()
returns trigger as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    new.contact_unlocked_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists enquiries_set_contact_unlocked_at on public.enquiries;
create trigger enquiries_set_contact_unlocked_at
  before update on public.enquiries
  for each row
  execute function public.set_contact_unlocked_at();
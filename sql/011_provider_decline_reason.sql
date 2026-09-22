alter table public.enquiries
  add column if not exists decline_reason text,
  add column if not exists is_asap boolean,
  add column if not exists scheduled_start_at timestamptz;

-- Optional provider-supplied reason for a declined enquiry.
-- Kept nullable so existing declines without a note continue to work.

-- Optional scheduling for a confirmed enquiry: customers can confirm ASAP
-- or choose a specific future date/time.

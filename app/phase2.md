# Assisto — Phase 2 Completion Instructions (for GitHub Copilot)

## Context (read first, don't skip)

You are working in the existing **Assisto** codebase — a service-professional
marketplace for Cuddalore and Chidambaram, Tamil Nadu. **Do not rebuild
anything.** Extend what exists.

Stack:
- Next.js (App Router), TypeScript, Tailwind, shadcn/ui, React Hook Form, Zod
- Supabase (Postgres + RLS, Auth, Storage)

Security pattern already established in this codebase — **follow it exactly,
do not invent a new pattern**:
- All auth checks happen against the **session-bound Supabase client**
  (`lib/supabase/server.ts` or equivalent) first.
- The **service-role client** (`lib/supabase/admin.ts`) is only ever used
  *after* that check has passed, server-side, and is never imported into
  client components or exposed to the browser.
- Every new table gets explicit RLS policies. Do not rely on "the app just
  won't show it" — assume every row is queryable directly.

Current state of Phase 2 ("Connection"):
- ✅ Customers can view provider profiles.
- ✅ Customers can submit a requirement/enquiry form.
- 🔲 The requirement form is currently a dead end — it saves data but
  doesn't lead anywhere.
- 🔲 No enquiry send flow from a provider's profile.
- 🔲 No provider-side inbox to accept/decline enquiries.
- 🔲 No contact-unlock mechanism after confirmation.
- 🔲 No admin visibility into enquiries.

Product principle to hold onto throughout: **the platform presents options,
the customer chooses.** Do not build automatic matching or automatic
provider assignment anywhere below.

Work through the 5 steps **in order**. Each step should be its own commit
(or small set of commits), buildable and testable on its own before moving
to the next. Do not jump ahead.

---

## Step 0 — Inspect before writing any code

Before touching anything, do the following and produce a short written
summary (as a comment in your PR description, not new code):

1. Open the requirement form component and its submit handler. Note:
   - What table it writes to (likely `requirements`).
   - What fields exist (category, description, location, budget, etc.).
   - What happens after a successful submit today (probably just a toast/
     redirect to nowhere useful).
2. Open the provider discovery/listing page. Note:
   - How it fetches providers.
   - What filters it already supports (category, location, etc.) and how
     filter state is represented (query params? local state?).
3. Open the provider profile page component.
4. Check `supabase/migrations/` (or wherever migrations live) for existing
   tables: `requirements`, `providers`, `profiles`, `applications`, and
   confirm whether an `enquiries` table already exists in any form.
5. Confirm how "role" is currently determined for a logged-in user
   (customer vs. provider vs. admin) — there should already be a pattern
   for this from Phase 1's approval flow.

Do not proceed to Step 1 until you can answer all of the above from the
actual code, not assumptions.

---

## Step 1 — Requirement → Discovery Linkage

**Goal:** Submitting a requirement should feel like the start of a search,
not a form disappearing into a void.

1. **Schema check/change**
   - Confirm the `requirements` row gets an `id` back on insert (it should,
     via `.select().single()` on the insert call). If the submit handler
     currently does a bare `.insert()` without returning the row, change it
     to return the new row's `id`.

2. **Submit handler**
   - On successful insert, instead of just showing a success toast, redirect
     the customer to the discovery/listing page with the requirement's
     category and location pre-filled as query params, e.g.:
     `/providers?category=interior&location=cuddalore&requirement=<id>`
   - Keep the success toast, but make the redirect the primary outcome.

3. **Discovery page**
   - Update the page (or its filter-initialization logic) to read `category`
     and `location` from `searchParams` on load and pre-populate the filter
     UI accordingly, rather than defaulting to "all".
   - If a `requirement` id is present in the query params, fetch that
     requirement (RLS: the requirement's owner only) and show a small banner
     above the results, e.g. "Showing professionals for: *[requirement
     description snippet]*" with a "clear" affordance that resets filters.
   - Do **not** auto-select or auto-enquire any provider. This step is
     purely about handing the customer into discovery with useful context —
     the customer still browses and chooses.

4. **Carry requirement context forward**
   - When the discovery page has a `requirement` id in context, pass it
     along as a query param on each provider profile link
     (`/providers/[id]?requirement=<requirementId>`), so Step 2 can
     associate an eventual enquiry with the originating requirement.

5. **Test**
   - Submit a requirement → confirm redirect lands on discovery with correct
     filters pre-applied.
   - Confirm a customer cannot view another customer's requirement by
     guessing/changing the `requirement` query param (RLS should block it;
     the banner should just not render if the fetch fails/returns nothing).

---

## Step 2 — Enquiry Send Flow (from a provider's profile)

**Goal:** A customer viewing a provider can send an enquiry, optionally tied
to the requirement they came from.

1. **Schema — create `enquiries` table** (if it doesn't already exist; if it
   partially exists, adapt rather than duplicate):
   ```sql
   create table if not exists enquiries (
     id uuid primary key default gen_random_uuid(),
     customer_id uuid not null references auth.users(id) on delete cascade,
     provider_id uuid not null references providers(id) on delete cascade,
     requirement_id uuid references requirements(id) on delete set null,
     message text not null,
     status text not null default 'pending'
       check (status in ('pending', 'accepted', 'declined', 'confirmed', 'closed')),
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   );

   create index on enquiries (provider_id);
   create index on enquiries (customer_id);
   create index on enquiries (requirement_id);
   ```
   Note the status model: `pending` → provider `accepted`/`declined` →
   customer `confirmed` → (later) `closed`. This deliberately keeps
   "provider accepts" and "customer confirms" as two separate steps, because
   the product flow requires the *customer* to be the one who finalizes the
   choice, not just the provider agreeing to take the job.

2. **RLS policies**
   ```sql
   alter table enquiries enable row level security;

   -- Customers can insert their own enquiries
   create policy "customers can create enquiries"
     on enquiries for insert
     with check (auth.uid() = customer_id);

   -- Customers can see their own enquiries
   create policy "customers can view own enquiries"
     on enquiries for select
     using (auth.uid() = customer_id);

   -- Providers can see enquiries sent to them
   create policy "providers can view their enquiries"
     on enquiries for select
     using (
       exists (
         select 1 from providers
         where providers.id = enquiries.provider_id
         and providers.user_id = auth.uid()
       )
     );

   -- Providers can update status (accept/decline) on their own enquiries
   create policy "providers can update their enquiries"
     on enquiries for update
     using (
       exists (
         select 1 from providers
         where providers.id = enquiries.provider_id
         and providers.user_id = auth.uid()
       )
     );

   -- Customers can update status (confirm) on their own enquiries
   create policy "customers can update own enquiries"
     on enquiries for update
     using (auth.uid() = customer_id);
   ```
   Adjust the `providers.user_id` join to match however this codebase
   already links a `providers` row to an `auth.users` id — check Step 0's
   findings before assuming the column name.

   Remember the admin-policies lesson from Phase 1: RLS gaps fail silently.
   After writing these, deliberately test as a *third* user (neither the
   customer nor the provider) and confirm they get zero rows back.

3. **Zod schema + form**
   - Add an enquiry form (dialog or inline section) on the provider profile
     page: a `message` textarea (required, e.g. min 10 chars), submit
     button "Send Enquiry".
   - If a `requirement` query param is present on the profile page, silently
     include it as `requirement_id` on submit; otherwise submit
     `requirement_id: null`.
   - On submit, insert into `enquiries` as the logged-in customer. Handle
     the not-logged-in case by redirecting to auth first, then back to this
     profile with intent preserved (query param or session-stored return
     path — check how auth redirects already work elsewhere in the app).

4. **Confirmation state**
   - After a successful send, show a clear confirmation ("Your enquiry has
     been sent to [Provider Name]. They'll respond soon.") and disable
     re-sending duplicate enquiries to the same provider while one is still
     `pending` (check for an existing pending enquiry from this customer to
     this provider before allowing a new one; either block or offer to view
     the existing one).

5. **Test**
   - Send an enquiry as a customer, confirm the row lands correctly with the
     right `requirement_id` (present and null cases).
   - Confirm an unauthenticated visitor is redirected to sign in, not
     allowed to submit.

---

## Step 3 — Provider-Side Enquiry Inbox

**Goal:** An approved provider can see enquiries addressed to them and
accept or decline.

1. **Route**
   - Add a protected route, e.g. `/dashboard/enquiries` (match existing
     provider dashboard routing conventions from Phase 1).
   - Gate it the same way other provider-only routes are gated: session
     check → confirm the user has an approved `providers` row → render.

2. **List view**
   - Fetch enquiries where `provider_id` = the logged-in provider's id,
     ordered by `created_at desc`, grouped or filterable by status
     (`pending` first).
   - For each enquiry, show: customer's display name (not contact info —
     contact stays locked until Step 4), the message, the linked
     requirement summary if present, and Accept/Decline buttons.

3. **Accept / Decline actions**
   - Server action or API route that updates `enquiries.status` to
     `accepted` or `declined`, scoped by the RLS policy from Step 2 (the
     provider can only update rows where they're the provider).
   - On decline, that's terminal — no further action needed on this
     enquiry.
   - On accept, the enquiry now needs the **customer** to confirm (see
     Step 4) — the provider accepting does not itself unlock contact info.

4. **Empty/edge states**
   - Handle zero enquiries, and handle a provider who isn't yet approved
     trying to hit this route (redirect to their application status page,
     matching Phase 1's approval-gate pattern).

5. **Test**
   - As Provider A, confirm you only ever see enquiries where you're the
     provider — never another provider's.
   - Accept one, decline another, confirm status persists and UI reflects
     it on refresh.

---

## Step 4 — Contact Unlock on Confirmation

**Goal:** Once a provider has accepted *and* the customer has confirmed,
both sides can see each other's contact details (phone/WhatsApp). Not
before.

1. **Where contact info lives**
   - Confirm from Step 0 where phone/WhatsApp numbers are currently stored
     (`profiles` table most likely). If they're currently selectable by
     anyone (e.g. exposed on public profile queries), that's a problem to
     fix now — contact fields must not be part of any publicly-readable
     profile query. Split them into a column/row that's protected by RLS,
     not just hidden in the UI.

2. **Customer confirmation step**
   - On the customer's side (e.g. their own "My Enquiries" list — add this
     page if it doesn't exist yet, mirroring the provider inbox but from
     the customer's perspective), show enquiries with status `accepted` and
     a "Confirm" button.
   - Confirming updates `enquiries.status` to `confirmed`.

3. **RLS for contact visibility**
   - Add a policy (or a Postgres function/view used specifically for this
     purpose) that allows a user to select another user's phone/WhatsApp
     field *only* if there exists an `enquiries` row where
     `status = 'confirmed'` and the two users are the `customer_id`/
     `provider_id` pair on that row. Example shape:
   ```sql
   create policy "contact visible after confirmed enquiry"
     on profiles for select
     using (
       auth.uid() = id -- always see your own
       or exists (
         select 1 from enquiries e
         join providers p on p.id = e.provider_id
         where e.status = 'confirmed'
         and (
           (e.customer_id = auth.uid() and p.user_id = profiles.id)
           or (p.user_id = auth.uid() and e.customer_id = profiles.id)
         )
       )
     );
   ```
   - If `profiles` currently has a broader public-select policy for
     non-contact fields (name, bio, etc. — which should stay public), you
     will likely need to split contact fields into a separate table
     (e.g. `contact_details`) with the stricter policy above, rather than
     changing the whole `profiles` table's visibility. Decide based on what
     Step 0 found; don't break existing public profile viewing.

4. **UI**
   - On both the provider inbox and the customer's enquiry list, once an
     enquiry is `confirmed`, reveal a "Contact" section with phone number
     and a `wa.me/<number>` WhatsApp link.
   - Before confirmation, keep this area visibly present but locked
     (e.g. "Contact details unlock once confirmed") so users understand
     what's coming, rather than the section just being absent.

5. **Test**
   - Confirm contact info is genuinely inaccessible via a direct query
     before `confirmed` status (test with the Supabase client directly, not
     just by checking the UI doesn't render it).
   - Confirm it becomes visible to both parties, and only both parties,
     after confirmation.

---

## Step 5 — Admin Enquiry Visibility

**Goal:** Admins can see all enquiries for moderation/support purposes,
without weakening the RLS built above.

1. **Access pattern**
   - Follow the two-layer pattern exactly: an admin-only route
     (`/admin/enquiries`) does a session-bound check that the current user
     has admin role first (same mechanism as the Phase 1 admin approval
     pages). Only after that check passes does the server code use the
     service-role client to fetch all enquiries — never expose the
     service-role client to a client component, and never gate admin access
     purely by RLS policy alone (defense in depth: both the route check and
     RLS should independently deny non-admins).

2. **List/detail view**
   - Table of all enquiries: customer, provider, status, created date,
     linked requirement (if any). Filterable by status.
   - Read-only for now — no need to let admins change enquiry status in
     this pass unless there's a clear support need; keep this step small.

3. **RLS**
   - Since admin access goes through the service-role client (which bypasses
     RLS by design), you do *not* need a new RLS policy for admins on
     `enquiries`. Just make sure the route-level admin check is airtight —
     this is exactly the kind of gap that caused the earlier silent
     admin-visibility bug in Phase 1, so re-verify by testing as a
     non-admin authenticated user that `/admin/enquiries` redirects/403s.

4. **Test**
   - As a non-admin, confirm the route is inaccessible.
   - As an admin, confirm you see enquiries across all customers/providers.

---

## Final checklist before calling Phase 2 done

- [ ] Requirement submission leads somewhere useful (Step 1).
- [ ] Customer can send an enquiry from any approved provider's profile
      (Step 2).
- [ ] Provider has a working inbox with accept/decline (Step 3).
- [ ] Customer has a way to confirm an accepted enquiry (Step 4, customer
      side).
- [ ] Contact details are provably locked until `confirmed` status, for
      both directions (Step 4, RLS-tested).
- [ ] Admin can view all enquiries without weakening any RLS policy
      (Step 5).
- [ ] No automatic matching or auto-selection was introduced anywhere —
      the customer always makes the final choice.
- [ ] No payments, materials, advanced matching, or project-tracking
      functionality was introduced (that's Phase 4/5, out of scope here).

Commit each step separately with a clear message referencing the step
number, so the work is easy to review and roll back individually if needed.
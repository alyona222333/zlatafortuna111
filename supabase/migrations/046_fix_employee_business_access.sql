-- Migration 046: fix the employee login redirect loop (white screen)
--
-- Symptom: an invited employee could register and log in, then landed on a
-- blank page with the URL flipping between /onboarding and /dashboard.
--
-- Cause: migration 016 dropped "public_read_businesses_for_booking" (rightly
-- so — it exposed smtp_pass, bot tokens and other secrets to anon), which
-- left `businesses` with exactly ONE policy: owner_access_businesses
-- (owner_id = auth.uid()). A logged-in EMPLOYEE is not the owner, so every
-- read of their own company row returned nothing:
--
--   lib/business.ts getBusinessForOwner()  -> null
--     -> app/(dashboard)/layout.tsx        -> redirect('/onboarding')
--     -> app/onboarding/page.tsx           -> redirect('/login')
--     -> /login sees a valid session       -> redirect('/dashboard')  -> loop
--
-- Every other tenant table (clients, orders, transactions...) already uses
-- my_business_ids(), which covers active linked employees. `businesses`
-- was simply never given the matching policy after 016 removed the old one.
--
-- Fix: let an active linked employee SELECT their own business row — the
-- same membership test used everywhere else. Insert/update/delete stay
-- owner-only via the existing owner_access_businesses policy.
--
-- SCOPE NOTE (deliberate, see below): this grants staff read access to the
-- whole row, which includes integration secrets (bot tokens, smtp_pass,
-- resend/LiqPay keys). It does NOT expose revenue, transactions, expenses
-- or analytics — those stay owner/director-only under migration 039, which
-- is the "nobody sees my finances" requirement. Locking the secret columns
-- down separately (masking them for non-director roles) is a follow-up;
-- doing it here would break staff-facing features that legitimately need
-- them server-side (Telegram/Viber chat sending, Nova Poshta lookups).

drop policy if exists "employee_read_own_business" on public.businesses;

create policy "employee_read_own_business" on public.businesses
  for select using (id in (select public.my_business_ids()));

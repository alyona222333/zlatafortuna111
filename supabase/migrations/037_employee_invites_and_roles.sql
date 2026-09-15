-- Migration 037: employee invite flow + fixed permission roles
--
-- Problem this fixes:
-- Adding a row in Settings -> Employees only created a calendar/staff card.
-- It never created an actual login, so nobody except the business owner
-- could ever sign in — "role" was just a text label, not an account.
--
-- This migration adds the columns needed to invite a real person to a
-- real login that is linked to their employee row. RLS already grants
-- any linked employee (public.my_business_ids(), see 005_security_fixes.sql)
-- full tenant access once user_id is set and is_active = true — so linking
-- the account is the missing piece, not the data access rule itself.
--
-- `role` stays a free-text column (unchanged) so existing data never
-- breaks, but the app now writes one of a fixed set of slugs to it:
--   owner, director, hr, sales_manager, marketer, it, analyst, employee
-- Anything else typed by hand in the past keeps working — it just won't
-- match a known permission profile until it's edited in Settings.

alter table public.employees
  add column if not exists invite_token       text unique,
  add column if not exists invite_expires_at  timestamptz,
  add column if not exists invite_sent_at     timestamptz,
  add column if not exists invite_accepted_at timestamptz;

comment on column public.employees.invite_token is
  'One-time token used at /invite/[token] to let this person set their own password and link user_id. Cleared once accepted.';

create index if not exists idx_employees_invite_token
  on public.employees(invite_token)
  where invite_token is not null;

-- Service-role-only lookup used by the invite acceptance route: it must be
-- able to find the row by token WITHOUT already having a session, and the
-- normal tenant_access_employees policy requires one. A tiny security
-- definer function keeps that lookup narrow (token + not-expired only)
-- instead of opening the table to anon reads.
create or replace function public.get_employee_by_invite_token(p_token text)
returns table (id uuid, business_id uuid, name text, email text, role text)
language sql
security definer
set search_path = public
as $$
  select id, business_id, name, email, role
  from public.employees
  where invite_token = p_token
    and invite_expires_at > now()
    and user_id is null
$$;

revoke all on function public.get_employee_by_invite_token(text) from public, anon, authenticated;
grant execute on function public.get_employee_by_invite_token(text) to service_role;

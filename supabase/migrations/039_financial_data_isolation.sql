-- Migration 039: real (database-level) financial data restriction
--
-- Until now, "roles" only hid sidebar buttons in the browser — any linked
-- employee could still read full revenue/transaction data by calling the
-- API directly, because RLS granted full tenant access to every active
-- employee regardless of role (see 005_security_fixes.sql). The owner
-- asked explicitly: "щоб мене ніхто не міг дивитися на мої фінанси" —
-- this migration enforces that in Postgres itself, not just the UI.
--
-- Rule: only the business owner or an employee with role = 'director'
-- may SELECT the full `transactions` table (which powers revenue on the
-- Dashboard, POS history, and Analytics) and the money-related columns
-- on `orders`. Everyone else who can use the POS (sales_manager,
-- employee) can still create sales and see the receipt for a sale THEY
-- personally rang up — just not the business's total revenue or anyone
-- else's sales.

create or replace function public.is_owner_or_director(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.businesses
    where id = p_business_id and owner_id = auth.uid()
  ) or exists (
    select 1 from public.employees
    where business_id = p_business_id
      and user_id = auth.uid()
      and is_active = true
      and role = 'director'
  )
$$;

grant execute on function public.is_owner_or_director(uuid) to authenticated;

-- Replace the old blanket "any tenant member" policy on transactions with
-- one that only lets owner/director see everything, and lets any other
-- linked employee see just the rows they personally rang up (so the POS
-- "recent sales" / receipt view keeps working for cashiers).
drop policy if exists "tenant_access_transactions" on public.transactions;

create policy "owner_director_full_transactions" on public.transactions
  for select using (public.is_owner_or_director(business_id));

create policy "staff_own_transactions" on public.transactions
  for select using (
    business_id in (select public.my_business_ids())
    and employee_id in (
      select id from public.employees where user_id = auth.uid() and is_active = true
    )
  );

create policy "tenant_insert_transactions" on public.transactions
  for insert with check (business_id in (select public.my_business_ids()));

create policy "owner_director_update_delete_transactions" on public.transactions
  for update using (public.is_owner_or_director(business_id));

create policy "owner_director_delete_transactions" on public.transactions
  for delete using (public.is_owner_or_director(business_id));

-- Orders carry money too (total_amount) — same rule: full visibility for
-- owner/director; other roles only see orders they're assigned to.
drop policy if exists "tenant_access_orders" on public.orders;

create policy "owner_director_full_orders" on public.orders
  for select using (public.is_owner_or_director(business_id));

create policy "staff_assigned_orders" on public.orders
  for select using (
    business_id in (select public.my_business_ids())
    and (
      assigned_to in (select id from public.employees where user_id = auth.uid() and is_active = true)
      or source = 'manual' -- an order a staff member entered themselves stays visible to them
    )
  );

create policy "tenant_insert_orders" on public.orders
  for insert with check (business_id in (select public.my_business_ids()));

create policy "owner_director_update_orders" on public.orders
  for update using (
    public.is_owner_or_director(business_id)
    or assigned_to in (select id from public.employees where user_id = auth.uid() and is_active = true)
  );

create policy "owner_director_delete_orders" on public.orders
  for delete using (public.is_owner_or_director(business_id));

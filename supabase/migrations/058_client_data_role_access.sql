-- Client contact data is limited to the owner, company director and sales roles.
-- Other departments may work with assigned tasks and internal collaboration,
-- but must not browse the customer directory or phone numbers.
create or replace function public.can_access_client_data(p_business_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id and b.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.employees e
    where e.business_id = p_business_id
      and e.user_id = auth.uid()
      and e.is_active = true
      and e.role in (
        'director', 'sales_director', 'store_director', 'services_director',
        'sales_manager', 'sales_manager_store', 'sales_manager_services'
      )
  );
$$;

drop policy if exists "tenant_access_clients" on public.clients;
create policy "sales_role_access_clients" on public.clients
  for all using (public.can_access_client_data(business_id))
  with check (public.can_access_client_data(business_id));

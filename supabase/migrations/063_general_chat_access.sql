create or replace function public.can_access_internal_channel(p_business_id uuid, p_slug text)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_internal_leader(p_business_id)
  or exists (
    select 1 from public.employees e
    where e.business_id = p_business_id and e.user_id = auth.uid() and e.is_active
      and ((p_slug = 'general' and e.role not in ('accountant','sales_manager_store'))
        or (p_slug = 'services' and e.role in ('sales_manager_services','sales_director'))
        or (p_slug = 'store' and e.role in ('sales_manager_store','sales_director','accountant'))
        or (p_slug = 'marketing-sales' and e.role in ('marketer','marketing_director','sales_manager','sales_manager_store','sales_manager_services'))
        or (p_slug = 'hr-security' and e.role in ('hr','security'))
        or (p_slug = 'legal-sales' and e.role in ('legal','sales_manager','sales_manager_store','sales_manager_services')))
  );
$$;

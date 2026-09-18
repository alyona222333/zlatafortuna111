alter table public.internal_messages alter column channel_id drop not null;
alter table public.internal_messages add column if not exists recipient_id uuid references auth.users(id) on delete cascade;
alter table public.internal_messages add column if not exists attachment_name text;
alter table public.internal_messages add column if not exists attachment_type text;

create or replace function public.is_internal_leader(p_business_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.businesses b where b.id = p_business_id and b.owner_id = auth.uid())
  or exists (select 1 from public.employees e where e.business_id = p_business_id and e.user_id = auth.uid() and e.is_active and e.role in ('director','sales_director','services_director','marketing_director','it_director','analytics_director','hr'));
$$;

create or replace function public.can_access_internal_channel(p_business_id uuid, p_slug text)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_internal_leader(p_business_id)
  or exists (
    select 1 from public.employees e
    where e.business_id = p_business_id and e.user_id = auth.uid() and e.is_active
      and ((p_slug = 'services' and e.role in ('sales_manager_services','sales_director'))
        or (p_slug = 'store' and e.role in ('sales_manager_store','sales_director','accountant'))
        or (p_slug = 'marketing-sales' and e.role in ('marketer','marketing_director','sales_manager','sales_manager_store','sales_manager_services'))
        or (p_slug = 'hr-security' and e.role in ('hr','security'))
        or (p_slug = 'legal-sales' and e.role in ('legal','sales_manager','sales_manager_store','sales_manager_services')))
  );
$$;

drop policy if exists "internal_messages_read" on public.internal_messages;
drop policy if exists "internal_messages_write" on public.internal_messages;
create policy "private_internal_messages_read" on public.internal_messages for select using (
  business_id in (select public.my_business_ids()) and (
    public.is_internal_leader(business_id)
    or sender_id = auth.uid()
    or recipient_id = auth.uid()
    or (channel_id is not null and exists (select 1 from public.internal_channels c where c.id = channel_id and public.can_access_internal_channel(c.business_id, c.slug)))
  )
);
create policy "private_internal_messages_write" on public.internal_messages for insert with check (
  sender_id = auth.uid() and business_id in (select public.my_business_ids()) and (
    (recipient_id is not null and exists (select 1 from public.employees e where e.business_id = business_id and e.user_id = recipient_id and e.is_active))
    or (channel_id is not null and exists (select 1 from public.internal_channels c where c.id = channel_id and public.can_access_internal_channel(c.business_id, c.slug)))
  )
);

-- Remove the obsolete store-director wording from existing channel metadata.
update public.internal_channels set name = 'Інтернет-магазин', description = 'Керівник відділу продажів, менеджери магазину, бухгалтер і керівництво' where slug = 'store';

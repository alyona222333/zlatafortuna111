create or replace function public.can_direct_message(p_business_id uuid, p_target_user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.businesses b where b.id = p_business_id and b.owner_id = auth.uid())
  or exists (
    select 1
    from public.employees sender
    join public.employees target on target.business_id = sender.business_id
    where sender.business_id = p_business_id
      and sender.user_id = auth.uid() and sender.is_active
      and target.user_id = p_target_user_id and target.is_active
      and (
        sender.role in ('director','sales_director','hr','it','it_director','accountant')
        or target.role in ('director','sales_director','hr','it','it_director','accountant')
        or (sender.role in ('sales_manager','sales_manager_store','sales_manager_services') and target.role in ('sales_manager','sales_manager_store','sales_manager_services','marketer','marketing_director','legal','it','it_director','accountant','hr','director','sales_director'))
        or (sender.role in ('marketer','marketing_director') and target.role in ('sales_manager','sales_manager_store','sales_manager_services','sales_director','director'))
        or (sender.role = 'legal' and target.role in ('sales_manager','sales_manager_store','sales_manager_services','sales_director','director'))
        or (target.role = 'legal' and sender.role in ('sales_manager','sales_manager_store','sales_manager_services','sales_director','director'))
      )
  );
$$;

drop policy if exists "private_internal_messages_write" on public.internal_messages;
create policy "private_internal_messages_write" on public.internal_messages for insert with check (
  sender_id = auth.uid() and business_id in (select public.my_business_ids()) and (
    (recipient_id is not null and public.can_direct_message(business_id, recipient_id))
    or (channel_id is not null and exists (select 1 from public.internal_channels c where c.id = channel_id and public.can_access_internal_channel(c.business_id, c.slug)))
  )
);

update public.internal_channels set name = 'Юрист ↔ Продажі', description = 'Договори та перевірка клієнтів' where slug = 'legal-sales';
update public.internal_channels set name = 'Маркетинг ↔ Продажі', description = 'Креативи, тексти, пропозиції та знижки' where slug = 'marketing-sales';
update public.internal_channels set name = 'Інтернет-магазин', description = 'Робочі питання магазину' where slug = 'store';

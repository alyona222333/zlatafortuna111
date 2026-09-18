-- Keep access rules stable even when an older employee record contains a translated role label.
create or replace function public.workspace_role_key(p_role text)
returns text language sql immutable as $$
  select case lower(trim(coalesce(p_role, '')))
    when 'директор' then 'director'
    when 'генеральный директор' then 'director'
    when 'генеральний директор' then 'director'
    when 'director' then 'director'
    when 'директор відділу продажів' then 'sales_director'
    when 'директор отдела продаж' then 'sales_director'
    when 'sales director' then 'sales_director'
    when 'юрист' then 'legal'
    when 'legal' then 'legal'
    when 'бухгалтер' then 'accountant'
    when 'accountant' then 'accountant'
    when 'hr / кадри' then 'hr'
    when 'hr / кадры' then 'hr'
    when 'hr / people' then 'hr'
    when 'hr' then 'hr'
    when 'it' then 'it'
    when 'технічна підтримка' then 'it'
    when 'техническая поддержка' then 'it'
    when 'marketer' then 'marketer'
    when 'маркетолог' then 'marketer'
    when 'sales_manager' then 'sales_manager'
    when 'sales_manager_store' then 'sales_manager_store'
    when 'sales_manager_services' then 'sales_manager_services'
    when 'менеджер з продажів' then 'sales_manager'
    when 'менеджер з продажів — інтернет-магазин' then 'sales_manager_store'
    when 'менеджер по продажам — интернет-магазин' then 'sales_manager_store'
    when 'менеджер з продажів — послуги' then 'sales_manager_services'
    when 'менеджер по продажам — услуги' then 'sales_manager_services'
    else lower(trim(coalesce(p_role, '')))
  end;
$$;

create or replace function public.can_direct_message(p_business_id uuid, p_target_user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.businesses b where b.id = p_business_id and b.owner_id = auth.uid())
  or exists (
    select 1 from public.employees sender
    join public.employees target on target.business_id = sender.business_id
    where sender.business_id = p_business_id and sender.user_id = auth.uid() and sender.is_active
      and target.user_id = p_target_user_id and target.is_active
      and (
        public.workspace_role_key(sender.role) in ('director','sales_director','hr')
        or public.workspace_role_key(target.role) in ('director','sales_director','hr')
        or (public.workspace_role_key(sender.role) in ('sales_manager','sales_manager_store','sales_manager_services') and public.workspace_role_key(target.role) in ('sales_manager','sales_manager_store','sales_manager_services','marketer','marketing_director','legal','it','it_director','accountant'))
        or (public.workspace_role_key(target.role) in ('sales_manager','sales_manager_store','sales_manager_services') and public.workspace_role_key(sender.role) in ('marketer','marketing_director','legal','it','it_director','accountant'))
      )
  );
$$;

create or replace function public.can_delete_internal_message(p_business_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.businesses b where b.id = p_business_id and b.owner_id = auth.uid())
    or exists (select 1 from public.employees e where e.business_id = p_business_id and e.user_id = auth.uid() and e.is_active and public.workspace_role_key(e.role) = 'director');
$$;

drop policy if exists "internal_messages_director_delete" on public.internal_messages;
create policy "internal_messages_director_delete" on public.internal_messages for delete using (public.can_delete_internal_message(business_id));

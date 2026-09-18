create table if not exists public.internal_channels (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (business_id, slug)
);

create table if not exists public.internal_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  channel_id uuid not null references public.internal_channels(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  attachment_url text,
  created_at timestamptz not null default now()
);

alter table public.internal_channels enable row level security;
alter table public.internal_messages enable row level security;

create or replace function public.can_access_internal_channel(p_business_id uuid, p_slug text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.businesses b where b.id = p_business_id and b.owner_id = auth.uid())
  or exists (
    select 1 from public.employees e
    where e.business_id = p_business_id and e.user_id = auth.uid() and e.is_active
      and (
        p_slug in ('general', 'management')
        or (p_slug = 'store' and e.role in ('director','store_director','sales_director','sales_manager_store','accountant'))
        or (p_slug = 'services' and e.role in ('director','services_director','sales_director','sales_manager_services'))
        or (p_slug = 'marketing-sales' and e.role in ('director','marketing_director','marketer','sales_director','sales_manager','sales_manager_store','sales_manager_services'))
        or (p_slug = 'hr-security' and e.role in ('director','hr','security'))
        or (p_slug = 'legal-sales' and e.role in ('director','legal','sales_director','sales_manager','sales_manager_store','sales_manager_services'))
      )
  );
$$;

create policy "internal_channels_read" on public.internal_channels for select using (public.can_access_internal_channel(business_id, slug));
create policy "internal_channels_owner_write" on public.internal_channels for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())) with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
create policy "internal_messages_read" on public.internal_messages for select using (
  business_id in (select public.my_business_ids()) and exists (select 1 from public.internal_channels c where c.id = channel_id and public.can_access_internal_channel(c.business_id, c.slug))
);
create policy "internal_messages_write" on public.internal_messages for insert with check (
  sender_id = auth.uid() and business_id in (select public.my_business_ids()) and exists (select 1 from public.internal_channels c where c.id = channel_id and public.can_access_internal_channel(c.business_id, c.slug))
);

create or replace function public.seed_internal_channels()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.internal_channels (business_id, slug, name, description) values
    (new.id, 'general', 'Загальний робочий чат', 'Командна комунікація без клієнських даних'),
    (new.id, 'management', 'Керівництво', 'Генеральний директор і керівники'),
    (new.id, 'store', 'Інтернет-магазин', 'Директор магазину, бухгалтер і керівництво'),
    (new.id, 'services', 'Послуги B2B', 'Команда продажів і виконання послуг'),
    (new.id, 'marketing-sales', 'Маркетинг → продажі', 'Матеріали, КП, презентації та креативи'),
    (new.id, 'hr-security', 'HR і безпека', 'Кадрові та безпекові питання'),
    (new.id, 'legal-sales', 'Юрист → продажі', 'Договори та перевірка клієнтів')
  on conflict (business_id, slug) do nothing;
  return new;
end;
$$;

drop trigger if exists seed_internal_channels_on_business on public.businesses;
create trigger seed_internal_channels_on_business after insert on public.businesses for each row execute function public.seed_internal_channels();

insert into public.internal_channels (business_id, slug, name, description)
select b.id, v.slug, v.name, v.description from public.businesses b cross join (values
  ('general','Загальний робочий чат','Командна комунікація без клієнських даних'),
  ('management','Керівництво','Генеральний директор і керівники'),
  ('store','Інтернет-магазин','Директор магазину, бухгалтер і керівництво'),
  ('services','Послуги B2B','Команда продажів і виконання послуг'),
  ('marketing-sales','Маркетинг → продажі','Матеріали, КП, презентації та креативи'),
  ('hr-security','HR і безпека','Кадрові та безпекові питання'),
  ('legal-sales','Юрист → продажі','Договори та перевірка клієнтів')
) v(slug,name,description) on conflict (business_id, slug) do nothing;

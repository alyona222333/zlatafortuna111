-- Store-manager workspace: four group chats plus private employee-to-employee messages.
update public.internal_channels set slug = 'sales', name = 'Продажі', description = 'Замовлення, клієнти, оплати, допродажі, ТТН і повернення' where slug = 'general';
update public.internal_channels set slug = 'marketing', name = 'Маркетинг', description = 'Ліди, акції, промокоди, ціни та рекламні матеріали' where slug = 'marketing-sales';
insert into public.internal_channels (business_id, slug, name, description)
select b.id, 'technical-support', 'Технічна підтримка', 'Проблеми CRM, замовлень, чатів, оплат та інтеграцій' from public.businesses b
where not exists (select 1 from public.internal_channels c where c.business_id = b.id and c.slug = 'technical-support');
update public.internal_channels set name = 'HR і безпека', description = 'Кадрові питання та безпекові інциденти' where slug = 'hr-security';
delete from public.internal_channels where slug in ('management','services','store','legal-sales');

create or replace function public.can_access_internal_channel(p_business_id uuid, p_slug text)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_internal_leader(p_business_id)
  or exists (select 1 from public.employees e where e.business_id = p_business_id and e.user_id = auth.uid() and e.is_active and p_slug in ('sales','marketing','technical-support','hr-security'))
$$;

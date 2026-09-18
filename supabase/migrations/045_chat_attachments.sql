-- Chat attachments: product offers, presentations, contracts and other documents.
alter table public.messages add column if not exists attachment_url text;
alter table public.messages add column if not exists attachment_name text;
alter table public.messages add column if not exists attachment_type text;

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'tenant_chat_attachments_read') then
    create policy "tenant_chat_attachments_read" on storage.objects for select to authenticated using (bucket_id = 'chat-attachments');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'tenant_chat_attachments_insert') then
    create policy "tenant_chat_attachments_insert" on storage.objects for insert to authenticated with check (bucket_id = 'chat-attachments');
  end if;
end $$;

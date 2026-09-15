drop extension if exists "pg_net";

drop extension if exists "uuid-ossp";

create extension if not exists "uuid-ossp" with schema "public";

drop policy "tenant_access_order_statuses" on "public"."order_statuses";

revoke delete on table "public"."order_statuses" from "anon";

revoke insert on table "public"."order_statuses" from "anon";

revoke references on table "public"."order_statuses" from "anon";

revoke select on table "public"."order_statuses" from "anon";

revoke trigger on table "public"."order_statuses" from "anon";

revoke truncate on table "public"."order_statuses" from "anon";

revoke update on table "public"."order_statuses" from "anon";

revoke delete on table "public"."order_statuses" from "authenticated";

revoke insert on table "public"."order_statuses" from "authenticated";

revoke references on table "public"."order_statuses" from "authenticated";

revoke select on table "public"."order_statuses" from "authenticated";

revoke trigger on table "public"."order_statuses" from "authenticated";

revoke truncate on table "public"."order_statuses" from "authenticated";

revoke update on table "public"."order_statuses" from "authenticated";

revoke delete on table "public"."order_statuses" from "service_role";

revoke insert on table "public"."order_statuses" from "service_role";

revoke references on table "public"."order_statuses" from "service_role";

revoke select on table "public"."order_statuses" from "service_role";

revoke trigger on table "public"."order_statuses" from "service_role";

revoke truncate on table "public"."order_statuses" from "service_role";

revoke update on table "public"."order_statuses" from "service_role";

alter table "public"."order_statuses" drop constraint "order_statuses_business_id_fkey";

alter table "public"."order_statuses" drop constraint "order_statuses_business_id_key_key";

alter table "public"."order_statuses" drop constraint "order_statuses_pkey";

drop index if exists "public"."order_statuses_business_id_key_key";

drop index if exists "public"."order_statuses_pkey";

drop table "public"."order_statuses";


  create table "public"."messages" (
    "id" uuid not null default public.uuid_generate_v4(),
    "business_id" uuid not null,
    "client_id" uuid,
    "channel" text not null,
    "direction" text not null,
    "body" text not null,
    "external_contact_id" text,
    "sent_by" uuid,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."messages" enable row level security;


  create table "public"."quick_replies" (
    "id" uuid not null default public.uuid_generate_v4(),
    "business_id" uuid not null,
    "title" text not null,
    "body" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."quick_replies" enable row level security;

alter table "public"."appointments" add column "liqpay_order_id" text;

alter table "public"."appointments" add column "payment_status" text not null default 'none'::text;

alter table "public"."appointments" add column "prepayment_amount" numeric(10,2);

alter table "public"."appointments" alter column "id" set default public.uuid_generate_v4();

alter table "public"."business_hours" alter column "id" set default public.uuid_generate_v4();

alter table "public"."businesses" add column "liqpay_private_key" text;

alter table "public"."businesses" add column "liqpay_public_key" text;

alter table "public"."businesses" alter column "id" set default public.uuid_generate_v4();

alter table "public"."clients" alter column "id" set default public.uuid_generate_v4();

alter table "public"."employees" alter column "id" set default public.uuid_generate_v4();

alter table "public"."expenses" alter column "id" set default public.uuid_generate_v4();

alter table "public"."inventory_items" alter column "id" set default public.uuid_generate_v4();

alter table "public"."inventory_movements" alter column "id" set default public.uuid_generate_v4();

alter table "public"."orders" add column "liqpay_order_id" text;

alter table "public"."orders" add column "paid_at" timestamp with time zone;

alter table "public"."orders" add column "payment_status" text not null default 'unpaid'::text;

alter table "public"."orders" alter column "id" set default public.uuid_generate_v4();

alter table "public"."services" alter column "id" set default public.uuid_generate_v4();

alter table "public"."transactions" alter column "id" set default public.uuid_generate_v4();

CREATE UNIQUE INDEX idx_appointments_liqpay_order_id ON public.appointments USING btree (liqpay_order_id) WHERE (liqpay_order_id IS NOT NULL);

CREATE INDEX idx_messages_business_created ON public.messages USING btree (business_id, created_at DESC);

CREATE INDEX idx_messages_client ON public.messages USING btree (business_id, client_id, created_at);

CREATE UNIQUE INDEX idx_orders_liqpay_order_id ON public.orders USING btree (liqpay_order_id) WHERE (liqpay_order_id IS NOT NULL);

CREATE INDEX idx_quick_replies_business ON public.quick_replies USING btree (business_id);

CREATE UNIQUE INDEX messages_pkey ON public.messages USING btree (id);

CREATE UNIQUE INDEX quick_replies_pkey ON public.quick_replies USING btree (id);

alter table "public"."messages" add constraint "messages_pkey" PRIMARY KEY using index "messages_pkey";

alter table "public"."quick_replies" add constraint "quick_replies_pkey" PRIMARY KEY using index "quick_replies_pkey";

alter table "public"."appointments" add constraint "appointments_payment_status_check" CHECK ((payment_status = ANY (ARRAY['none'::text, 'pending'::text, 'paid'::text, 'failed'::text]))) not valid;

alter table "public"."appointments" validate constraint "appointments_payment_status_check";

alter table "public"."messages" add constraint "messages_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE not valid;

alter table "public"."messages" validate constraint "messages_business_id_fkey";

alter table "public"."messages" add constraint "messages_channel_check" CHECK ((channel = ANY (ARRAY['telegram'::text, 'viber'::text, 'whatsapp'::text]))) not valid;

alter table "public"."messages" validate constraint "messages_channel_check";

alter table "public"."messages" add constraint "messages_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL not valid;

alter table "public"."messages" validate constraint "messages_client_id_fkey";

alter table "public"."messages" add constraint "messages_direction_check" CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text]))) not valid;

alter table "public"."messages" validate constraint "messages_direction_check";

alter table "public"."messages" add constraint "messages_sent_by_fkey" FOREIGN KEY (sent_by) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."messages" validate constraint "messages_sent_by_fkey";

alter table "public"."orders" add constraint "orders_payment_status_check" CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text]))) not valid;

alter table "public"."orders" validate constraint "orders_payment_status_check";

alter table "public"."quick_replies" add constraint "quick_replies_business_id_fkey" FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE not valid;

alter table "public"."quick_replies" validate constraint "quick_replies_business_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

grant delete on table "public"."messages" to "anon";

grant insert on table "public"."messages" to "anon";

grant references on table "public"."messages" to "anon";

grant select on table "public"."messages" to "anon";

grant trigger on table "public"."messages" to "anon";

grant truncate on table "public"."messages" to "anon";

grant update on table "public"."messages" to "anon";

grant delete on table "public"."messages" to "authenticated";

grant insert on table "public"."messages" to "authenticated";

grant references on table "public"."messages" to "authenticated";

grant select on table "public"."messages" to "authenticated";

grant trigger on table "public"."messages" to "authenticated";

grant truncate on table "public"."messages" to "authenticated";

grant update on table "public"."messages" to "authenticated";

grant delete on table "public"."messages" to "service_role";

grant insert on table "public"."messages" to "service_role";

grant references on table "public"."messages" to "service_role";

grant select on table "public"."messages" to "service_role";

grant trigger on table "public"."messages" to "service_role";

grant truncate on table "public"."messages" to "service_role";

grant update on table "public"."messages" to "service_role";

grant delete on table "public"."quick_replies" to "anon";

grant insert on table "public"."quick_replies" to "anon";

grant references on table "public"."quick_replies" to "anon";

grant select on table "public"."quick_replies" to "anon";

grant trigger on table "public"."quick_replies" to "anon";

grant truncate on table "public"."quick_replies" to "anon";

grant update on table "public"."quick_replies" to "anon";

grant delete on table "public"."quick_replies" to "authenticated";

grant insert on table "public"."quick_replies" to "authenticated";

grant references on table "public"."quick_replies" to "authenticated";

grant select on table "public"."quick_replies" to "authenticated";

grant trigger on table "public"."quick_replies" to "authenticated";

grant truncate on table "public"."quick_replies" to "authenticated";

grant update on table "public"."quick_replies" to "authenticated";

grant delete on table "public"."quick_replies" to "service_role";

grant insert on table "public"."quick_replies" to "service_role";

grant references on table "public"."quick_replies" to "service_role";

grant select on table "public"."quick_replies" to "service_role";

grant trigger on table "public"."quick_replies" to "service_role";

grant truncate on table "public"."quick_replies" to "service_role";

grant update on table "public"."quick_replies" to "service_role";


  create policy "tenant_access_messages"
  on "public"."messages"
  as permissive
  for all
  to public
using ((business_id IN ( SELECT public.my_business_ids() AS my_business_ids)));



  create policy "tenant_access_quick_replies"
  on "public"."quick_replies"
  as permissive
  for all
  to public
using ((business_id IN ( SELECT public.my_business_ids() AS my_business_ids)));

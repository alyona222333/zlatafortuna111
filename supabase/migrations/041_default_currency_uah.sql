-- Migration 041: default currency UAH instead of USD
--
-- This whole install is for a Ukrainian company; USD as the default made
-- every new business (and the one already created) show revenue in the
-- wrong currency until someone manually changed it in Settings.

alter table public.businesses alter column currency set default 'UAH';

-- Fix the business(es) already created with the old default that were
-- never manually changed.
update public.businesses set currency = 'UAH' where currency = 'USD';

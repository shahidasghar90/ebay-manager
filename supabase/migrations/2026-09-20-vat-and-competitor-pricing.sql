-- supabase/migrations/2026-09-20-vat-and-competitor-pricing.sql
-- Run this once in the Supabase SQL editor against the existing project.

alter table accounts add column if not exists vat_rate_percent numeric;
alter table accounts add column if not exists vat_amount_eur numeric;

alter table product_research add column if not exists competitor_prices jsonb not null default '[]';

insert into settings (key, value) values
  ('vat_registered', 0),
  ('vat_rate_percent', 19)
on conflict (key) do nothing;

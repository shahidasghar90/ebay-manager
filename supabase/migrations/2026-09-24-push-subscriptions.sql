-- supabase/migrations/2026-09-24-push-subscriptions.sql
-- Run this once in the Supabase SQL editor against the existing project.
-- Stores each device's Web Push subscription so teammates can be notified
-- when someone adds or edits a record.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Writes go through the server (service role). Users may only see their own devices.
drop policy if exists "Users read own push subscriptions" on push_subscriptions;
create policy "Users read own push subscriptions" on push_subscriptions
  for select to authenticated using (user_id = auth.uid());

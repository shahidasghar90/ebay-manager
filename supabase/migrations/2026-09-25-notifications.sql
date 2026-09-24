-- supabase/migrations/2026-09-25-notifications.sql
-- Run this once in the Supabase SQL editor against the existing project.
-- In-app inbox of UNREAD notifications only: one row per recipient, written by
-- /api/notify when a teammate adds or edits a record, and deleted as soon as
-- the recipient opens it (or taps "Clear all"). Nothing is kept once read.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  actor_email text,
  title text not null,
  body text,
  url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created on notifications (user_id, created_at desc);

alter table notifications enable row level security;

-- Inserts go through the server (service role). Users see and dismiss only their own.
drop policy if exists "Users read own notifications" on notifications;
create policy "Users read own notifications" on notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users delete own notifications" on notifications;
create policy "Users delete own notifications" on notifications
  for delete to authenticated using (user_id = auth.uid());

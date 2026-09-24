-- supabase/migrations/2026-09-24-record-authors.sql
-- Run this once in the Supabase SQL editor against the existing project.
-- Stamps every record with who created it and who changed it last.
-- Only three columns per table: no history table, nothing piles up.

alter table products         add column if not exists created_by text, add column if not exists updated_by text;
alter table orders           add column if not exists created_by text, add column if not exists updated_by text, add column if not exists updated_at timestamptz;
alter table inventory        add column if not exists created_by text, add column if not exists updated_by text, add column if not exists updated_at timestamptz;
alter table product_research add column if not exists created_by text, add column if not exists updated_by text, add column if not exists updated_at timestamptz;
alter table accounts         add column if not exists created_by text, add column if not exists updated_by text, add column if not exists updated_at timestamptz;
alter table returns_cases    add column if not exists created_by text, add column if not exists updated_by text, add column if not exists updated_at timestamptz;

create or replace function stamp_record_author() returns trigger
language plpgsql
as $$
declare
  actor text := auth.jwt() ->> 'email';
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, actor);
  end if;

  new.updated_by := actor;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_author_products on products;
create trigger trg_author_products before insert or update on products
  for each row execute function stamp_record_author();

drop trigger if exists trg_author_orders on orders;
create trigger trg_author_orders before insert or update on orders
  for each row execute function stamp_record_author();

drop trigger if exists trg_author_inventory on inventory;
create trigger trg_author_inventory before insert or update on inventory
  for each row execute function stamp_record_author();

drop trigger if exists trg_author_research on product_research;
create trigger trg_author_research before insert or update on product_research
  for each row execute function stamp_record_author();

drop trigger if exists trg_author_accounts on accounts;
create trigger trg_author_accounts before insert or update on accounts
  for each row execute function stamp_record_author();

drop trigger if exists trg_author_returns on returns_cases;
create trigger trg_author_returns before insert or update on returns_cases
  for each row execute function stamp_record_author();

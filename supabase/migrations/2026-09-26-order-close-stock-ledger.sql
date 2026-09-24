-- supabase/migrations/2026-09-26-order-close-stock-ledger.sql
-- Run this once in the Supabase SQL editor against the existing project.
-- Links orders, returns and inventory to the accounts ledger:
--   * money reaches Accounts when an order is CLOSED (with payout adjustment),
--   * every stock change is logged in stock_movements,
--   * a return posts its refund only once it is Resolved.
-- Every money/stock action runs inside one Postgres function, so it either
-- fully happens or not at all.

-- ---------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------
alter table orders
  add column if not exists actual_payout_eur numeric,
  add column if not exists payout_date date,
  add column if not exists adjustment_eur numeric not null default 0,
  add column if not exists closed_at timestamptz;

alter table accounts
  add column if not exists ref_type text,
  add column if not exists ref_id text;

-- One auto entry per (source record, entry type): re-running an action updates
-- the entry instead of adding a duplicate.
create unique index if not exists idx_accounts_ref
  on accounts (ref_type, ref_id, type) where ref_type is not null;

alter table returns_cases
  add column if not exists additional_loss_eur numeric not null default 0,
  add column if not exists fee_credit_eur numeric not null default 0,
  add column if not exists restock boolean not null default false,
  add column if not exists settled_at timestamptz,
  add column if not exists profit_impact_eur numeric not null default 0;

-- ---------------------------------------------------------------------
-- Stock movement log
-- ---------------------------------------------------------------------
create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  sku text not null references products (sku) on delete cascade,
  qty_change integer not null,
  reason text not null check (reason in ('opening', 'purchase', 'sale', 'cancel', 'return', 'adjust')),
  ref_type text,
  ref_id text,
  unit_cost_eur numeric,
  notes text,
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_movements_sku on stock_movements (sku, created_at desc);
create index if not exists idx_stock_movements_ref on stock_movements (ref_type, ref_id);

alter table stock_movements enable row level security;

drop policy if exists "Authenticated users can do everything - stock_movements" on stock_movements;
create policy "Authenticated users can do everything - stock_movements"
  on stock_movements for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- Link existing auto entries to their source records
-- ---------------------------------------------------------------------
update accounts
  set ref_type = 'order', ref_id = substring(notes from '^Auto: order (\S+)')
  where ref_type is null and type = 'Sale' and notes like 'Auto: order %';

update accounts
  set ref_type = 'return', ref_id = substring(notes from '^Auto: return (\S+)')
  where ref_type is null and type = 'Refund' and notes like 'Auto: return %';

-- Legacy return cases already posted their refund: mark them settled so a later
-- edit reverses exactly that entry. They never touched order profit.
update returns_cases r
  set settled_at = r.created_at
  where r.settled_at is null
    and exists (select 1 from accounts a where a.ref_type = 'return' and a.ref_id = r.case_id);

-- Legacy orders already took their stock; log it so a cancel can put it back.
insert into stock_movements (sku, qty_change, reason, ref_type, ref_id, notes, created_by, created_at)
select o.sku, -o.quantity, 'sale', 'order', o.order_id, 'Logged at migration', o.created_by, o.created_at
from orders o
join inventory i on i.sku = o.sku and i.inventory_type = 'On Hand'
where o.order_status <> 'Cancelled'
  and not exists (select 1 from stock_movements m where m.ref_type = 'order' and m.ref_id = o.order_id);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function round2(value numeric) returns numeric
language sql immutable
as $$ select round(value, 2) $$;

-- Changes stock for an On Hand SKU and logs it. Dropship/Virtual SKUs (or SKUs
-- with no inventory row) are skipped: returns false and logs nothing.
create or replace function apply_stock_movement(
  p_sku text,
  p_qty_change integer,
  p_reason text,
  p_ref_type text default null,
  p_ref_id text default null,
  p_unit_cost_eur numeric default null,
  p_notes text default null
) returns boolean
language plpgsql
as $$
begin
  if p_sku is null or coalesce(p_qty_change, 0) = 0 then
    return false;
  end if;

  update inventory
    set quantity_on_hand = quantity_on_hand + p_qty_change
    where sku = p_sku and inventory_type = 'On Hand';

  if not found then
    return false;
  end if;

  insert into stock_movements (sku, qty_change, reason, ref_type, ref_id, unit_cost_eur, notes)
  values (p_sku, p_qty_change, p_reason, p_ref_type, p_ref_id, p_unit_cost_eur, p_notes);

  return true;
end;
$$;

-- Inserts or updates one auto ledger entry for a source record; a zero amount
-- removes it instead.
create or replace function upsert_ledger_entry(
  p_ref_type text,
  p_ref_id text,
  p_type text,
  p_category text,
  p_amount_eur numeric,
  p_direction text,
  p_tx_date date,
  p_notes text,
  p_vat_rate_percent numeric default null,
  p_vat_amount_eur numeric default null
) returns void
language plpgsql
as $$
begin
  if round2(coalesce(p_amount_eur, 0)) = 0 then
    delete from accounts where ref_type = p_ref_type and ref_id = p_ref_id and type = p_type;
    return;
  end if;

  insert into accounts (tx_id, tx_date, type, category, amount_eur, direction,
                        vat_rate_percent, vat_amount_eur, notes, ref_type, ref_id)
  values ('ACC-' || upper(p_ref_id) || '-' || upper(replace(p_type, ' ', '-')),
          p_tx_date, p_type, p_category, round2(p_amount_eur), p_direction,
          p_vat_rate_percent, p_vat_amount_eur, p_notes, p_ref_type, p_ref_id)
  on conflict (ref_type, ref_id, type) where ref_type is not null do update
    set tx_date = excluded.tx_date,
        category = excluded.category,
        amount_eur = excluded.amount_eur,
        direction = excluded.direction,
        vat_rate_percent = excluded.vat_rate_percent,
        vat_amount_eur = excluded.vat_amount_eur,
        notes = excluded.notes;
end;
$$;

-- ---------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------
-- Books the order into Accounts: Sale (gross) In, Fees Out, Shipping Out and an
-- Adjustment for the difference between the expected and the actual payout.
create or replace function close_order(
  p_order_id text,
  p_actual_payout_eur numeric,
  p_payout_date date default current_date
) returns orders
language plpgsql
as $$
declare
  o orders;
  vat_on boolean;
  vat_rate numeric;
  fees numeric;
  expected numeric;
  adjustment numeric;
  label text;
begin
  select * into o from orders where order_id = p_order_id for update;

  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if o.closed_at is not null or o.order_status = 'Cancelled' then
    raise exception 'Order % is already %', p_order_id, o.order_status;
  end if;

  if p_actual_payout_eur is null or p_actual_payout_eur < 0 then
    raise exception 'Enter the amount actually received';
  end if;

  select coalesce(max(value) filter (where key = 'vat_registered'), 0) = 1,
         coalesce(max(value) filter (where key = 'vat_rate_percent'), 19)
    into vat_on, vat_rate
    from settings;

  fees := round2(o.ebay_fee_eur + o.payment_fee_eur);
  expected := round2(o.gross_sale_eur - fees);
  adjustment := round2(p_actual_payout_eur - expected);
  label := 'Auto: order ' || o.order_id || ' (' || coalesce(o.sku, '—') || ')';

  perform upsert_ledger_entry('order', o.order_id, 'Sale', 'eBay Sales', o.gross_sale_eur, 'In',
    p_payout_date, label,
    case when vat_on then vat_rate end,
    case when vat_on then round2(o.gross_sale_eur * vat_rate / 100) end);

  perform upsert_ledger_entry('order', o.order_id, 'Fees', 'Selling Fees', fees, 'Out',
    p_payout_date, label);

  perform upsert_ledger_entry('order', o.order_id, 'Shipping', 'Shipping & Packaging',
    o.shipping_packaging_cost_eur, 'Out', p_payout_date, label);

  perform upsert_ledger_entry('order', o.order_id, 'Adjustment', 'Payout Adjustment',
    abs(adjustment), case when adjustment >= 0 then 'In' else 'Out' end,
    p_payout_date, label || ' — expected ' || expected || ', received ' || round2(p_actual_payout_eur));

  update orders
    set order_status = case when order_status = 'Returned' then 'Returned' else 'Closed' end,
        actual_payout_eur = round2(p_actual_payout_eur),
        payout_date = p_payout_date,
        adjustment_eur = adjustment,
        closed_at = now(),
        net_profit_eur = round2(net_profit_eur + adjustment),
        net_margin = case when gross_sale_eur > 0
          then round((net_profit_eur + adjustment) / gross_sale_eur, 4) else 0 end
    where order_id = p_order_id
    returning * into o;

  return o;
end;
$$;

-- Undoes close_order: removes the order's ledger entries and the adjustment.
create or replace function reopen_order(p_order_id text) returns orders
language plpgsql
as $$
declare
  o orders;
begin
  select * into o from orders where order_id = p_order_id for update;

  if not found or o.closed_at is null then
    raise exception 'Only a closed order can be reopened';
  end if;

  delete from accounts where ref_type = 'order' and ref_id = p_order_id;

  update orders
    set order_status = case when order_status = 'Returned' then 'Returned' else 'Delivered' end,
        net_profit_eur = round2(net_profit_eur - adjustment_eur),
        net_margin = case when gross_sale_eur > 0
          then round((net_profit_eur - adjustment_eur) / gross_sale_eur, 4) else 0 end,
        actual_payout_eur = null,
        payout_date = null,
        adjustment_eur = 0,
        closed_at = null
    where order_id = p_order_id
    returning * into o;

  return o;
end;
$$;

-- Cancels an open order: stock goes back, any ledger entry is removed.
create or replace function cancel_order(p_order_id text) returns orders
language plpgsql
as $$
declare
  o orders;
  taken integer;
begin
  select * into o from orders where order_id = p_order_id for update;

  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if o.closed_at is not null or o.order_status = 'Returned' then
    raise exception 'Order % is %: log a return instead', p_order_id, o.order_status;
  end if;

  if o.order_status = 'Cancelled' then
    return o;
  end if;

  select coalesce(sum(qty_change), 0) into taken
    from stock_movements where ref_type = 'order' and ref_id = p_order_id;

  perform apply_stock_movement(o.sku, -taken, 'cancel', 'order', p_order_id, null, 'Order cancelled');

  delete from accounts where ref_type = 'order' and ref_id = p_order_id;

  update orders set order_status = 'Cancelled' where order_id = p_order_id returning * into o;

  return o;
end;
$$;

-- ---------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------
-- Adds purchased stock and (optionally) books the purchase as an expense.
create or replace function restock_inventory(
  p_sku text,
  p_qty integer,
  p_unit_cost_eur numeric,
  p_date date default current_date,
  p_record_expense boolean default true,
  p_notes text default null
) returns void
language plpgsql
as $$
declare
  movement_id uuid := gen_random_uuid();
begin
  if coalesce(p_qty, 0) <= 0 then
    raise exception 'Quantity must be at least 1';
  end if;

  if not apply_stock_movement(p_sku, p_qty, 'purchase', 'restock', movement_id::text, p_unit_cost_eur, p_notes) then
    raise exception 'No On Hand inventory record for SKU %', p_sku;
  end if;

  update inventory set last_restock_date = p_date where sku = p_sku;

  if p_record_expense and coalesce(p_unit_cost_eur, 0) > 0 then
    perform upsert_ledger_entry('restock', movement_id::text, 'Purchase', 'Inventory',
      p_qty * p_unit_cost_eur, 'Out', p_date,
      'Auto: restock ' || p_sku || ' × ' || p_qty || coalesce(' — ' || p_notes, ''));
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Returns
-- ---------------------------------------------------------------------
-- Brings a return's ledger/stock/order effects in line with its current row:
-- first undoes whatever was applied, then applies again if it is Resolved.
-- Safe to call after every save.
create or replace function sync_return(p_case_id text) returns returns_cases
language plpgsql
as $$
declare
  r returns_cases;
  o orders;
  vat_on boolean;
  vat_rate numeric;
  restocked integer;
  impact numeric;
  label text;
begin
  select * into r from returns_cases where case_id = p_case_id for update;

  if not found then
    raise exception 'Return % not found', p_case_id;
  end if;

  if r.order_id is not null then
    select * into o from orders where order_id = r.order_id for update;
  end if;

  -- Undo the previous settlement.
  if r.settled_at is not null then
    delete from accounts where ref_type = 'return' and ref_id = r.case_id;

    select coalesce(sum(qty_change), 0) into restocked
      from stock_movements where ref_type = 'return' and ref_id = r.case_id;

    if restocked <> 0 then
      perform apply_stock_movement(o.sku, -restocked, 'return', 'return', r.case_id, null, 'Return settlement undone');
    end if;

    if o.order_id is not null then
      update orders
        set net_profit_eur = round2(net_profit_eur - r.profit_impact_eur),
            net_margin = case when gross_sale_eur > 0
              then round((net_profit_eur - r.profit_impact_eur) / gross_sale_eur, 4) else 0 end,
            order_status = case when order_status = 'Returned'
              then case when closed_at is not null then 'Closed' else 'Delivered' end
              else order_status end
        where order_id = o.order_id;
    end if;

    update returns_cases set settled_at = null, profit_impact_eur = 0
      where case_id = r.case_id returning * into r;
  end if;

  if r.status <> 'Resolved' then
    return r;
  end if;

  -- Apply the settlement.
  select coalesce(max(value) filter (where key = 'vat_registered'), 0) = 1,
         coalesce(max(value) filter (where key = 'vat_rate_percent'), 19)
    into vat_on, vat_rate
    from settings;

  label := 'Auto: return ' || r.case_id || coalesce(' for order ' || r.order_id, '');

  perform upsert_ledger_entry('return', r.case_id, 'Refund', 'Returns', r.refund_eur, 'Out',
    r.case_date, label,
    case when vat_on then vat_rate end,
    case when vat_on then round2(r.refund_eur * vat_rate / 100) end);

  perform upsert_ledger_entry('return', r.case_id, 'Return Cost', 'Returns', r.additional_loss_eur, 'Out',
    r.case_date, label);

  perform upsert_ledger_entry('return', r.case_id, 'Fee Credit', 'Selling Fees', r.fee_credit_eur, 'In',
    r.case_date, label);

  impact := round2(r.fee_credit_eur - r.refund_eur - r.additional_loss_eur);

  if r.restock and o.order_id is not null
     and apply_stock_movement(o.sku, o.quantity, 'return', 'return', r.case_id, null, 'Returned item back in stock') then
    impact := round2(impact + o.product_cost_eur);
  end if;

  if o.order_id is not null then
    update orders
      set net_profit_eur = round2(net_profit_eur + impact),
          net_margin = case when gross_sale_eur > 0
            then round((net_profit_eur + impact) / gross_sale_eur, 4) else 0 end,
          order_status = 'Returned'
      where order_id = o.order_id;
  end if;

  update returns_cases
    set settled_at = now(),
        profit_impact_eur = impact,
        net_loss_eur = round2(-impact)
    where case_id = r.case_id
    returning * into r;

  return r;
end;
$$;

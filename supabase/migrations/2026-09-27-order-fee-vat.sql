-- supabase/migrations/2026-09-27-order-fee-vat.sql
-- Run this once in the Supabase SQL editor, after 2026-09-26-order-close-stock-ledger.sql.
-- Records the VAT eBay charges on its own fees as a separate "Fee VAT" entry when
-- an order is closed, instead of hiding it inside the payout Adjustment.
-- (Not reclaimable for a Kleinunternehmer, so it is booked as a cost.)

-- Ledger entries carry VAT columns; older projects never ran
-- 2026-09-20-vat-and-competitor-pricing.sql, so make sure they exist.
alter table accounts
  add column if not exists vat_rate_percent numeric,
  add column if not exists vat_amount_eur numeric;

alter table orders
  add column if not exists fee_vat_eur numeric not null default 0;

-- Books the order into Accounts: Sale (gross) In, Fees Out, Fee VAT Out (the VAT
-- eBay charges on its own fees, a cost for a Kleinunternehmer), Shipping Out and
-- an Adjustment for whatever difference is left against the actual payout.
-- close_order gains a 4th parameter; drop the 3-parameter version so only one exists.
drop function if exists close_order(text, numeric, date);

create or replace function close_order(
  p_order_id text,
  p_actual_payout_eur numeric,
  p_payout_date date default current_date,
  p_fee_vat_eur numeric default 0
) returns orders
language plpgsql
as $$
declare
  o orders;
  vat_on boolean;
  vat_rate numeric;
  fees numeric;
  fee_vat numeric := round2(coalesce(p_fee_vat_eur, 0));
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
  if fee_vat < 0 then
    raise exception 'VAT on fees cannot be negative';
  end if;

  expected := round2(o.gross_sale_eur - fees - fee_vat);
  adjustment := round2(p_actual_payout_eur - expected);
  label := 'Auto: order ' || o.order_id || ' (' || coalesce(o.sku, '—') || ')';

  perform upsert_ledger_entry('order', o.order_id, 'Sale', 'eBay Sales', o.gross_sale_eur, 'In',
    p_payout_date, label,
    case when vat_on then vat_rate end,
    case when vat_on then round2(o.gross_sale_eur * vat_rate / 100) end);

  perform upsert_ledger_entry('order', o.order_id, 'Fees', 'Selling Fees', fees, 'Out',
    p_payout_date, label);

  perform upsert_ledger_entry('order', o.order_id, 'Fee VAT', 'VAT on Fees', fee_vat, 'Out',
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
        fee_vat_eur = fee_vat,
        closed_at = now(),
        net_profit_eur = round2(net_profit_eur + adjustment - fee_vat),
        net_margin = case when gross_sale_eur > 0
          then round((net_profit_eur + adjustment - fee_vat) / gross_sale_eur, 4) else 0 end
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
        net_profit_eur = round2(net_profit_eur - adjustment_eur + fee_vat_eur),
        net_margin = case when gross_sale_eur > 0
          then round((net_profit_eur - adjustment_eur + fee_vat_eur) / gross_sale_eur, 4) else 0 end,
        actual_payout_eur = null,
        payout_date = null,
        adjustment_eur = 0,
        fee_vat_eur = 0,
        closed_at = null
    where order_id = p_order_id
    returning * into o;

  return o;
end;
$$;

-- Make the API (PostgREST) pick up the new close_order signature right away.
notify pgrst, 'reload schema';

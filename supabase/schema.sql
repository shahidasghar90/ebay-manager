-- eBay Business Manager - Supabase schema
-- Mirrors the old Google Sheets tabs (Products, Orders, Inventory,
-- Product_Research, Accounts, Returns_Cases, Settings) as Postgres tables.
-- Run this once in the Supabase SQL editor on a fresh project.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- SETTINGS  (FX rates + platform fee defaults)
-- ---------------------------------------------------------------------
create table if not exists settings (
  key text primary key,
  value numeric not null
);

insert into settings (key, value) values
  ('fx_usd', 1.08),
  ('fx_pkr', 310),
  ('ebay_fee_percent', 0.129),
  ('payment_fee_percent', 0.029),
  ('fixed_payment_fee_eur', 0.35),
  ('vat_registered', 0),
  ('vat_rate_percent', 19)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- PRODUCTS
-- ---------------------------------------------------------------------
create table if not exists products (
  sku text primary key,
  product_name text not null,
  category text,
  condition text not null check (condition in ('New', 'Used', 'Refurbished')),
  business_model text not null check (business_model in ('Stock', 'Dropship', 'Hybrid')),
  product_status text not null default 'Research'
    check (product_status in ('Research', 'Active', 'Paused', 'Out of Stock', 'Archived')),
  sales_platform text not null default 'eBay_DE',
  supplier_name text,
  supplier_platform text,
  supplier_link text,
  main_ebay_listing_url text,
  image_urls jsonb not null default '[]',
  image_file_ids jsonb not null default '[]',
  support_link_1 text,
  support_link_2 text,
  support_link_3 text,
  source_currency text not null default 'EUR',
  fx_rate numeric not null default 1,
  purchase_price_local numeric not null default 0,
  purchase_price_eur numeric not null default 0,
  shipping_local numeric not null default 0,
  shipping_eur numeric not null default 0,
  customs_eur numeric not null default 0,
  packaging_eur numeric not null default 0,
  refurbishment_eur numeric not null default 0,
  dropship_customer_shipping_eur numeric not null default 0,
  dropship_handling_fee_eur numeric not null default 0,
  total_cost_eur numeric not null default 0,
  ebay_fee_percent numeric not null default 0.129,
  payment_fee_percent numeric not null default 0.029,
  fixed_payment_fee_eur numeric not null default 0.35,
  target_profit_percent numeric not null default 0.25,
  recommended_sale_price_eur numeric not null default 0,
  minimum_sale_price_eur numeric not null default 0,
  current_sale_price_eur numeric not null default 0,
  estimated_ebay_fee_eur numeric not null default 0,
  estimated_payment_fee_eur numeric not null default 0,
  estimated_net_profit_eur numeric not null default 0,
  estimated_profit_margin numeric not null default 0,
  supplier_moq integer default 1,
  lead_time_days integer default 0,
  dropship_supported boolean not null default false,
  acquisition_source text,
  acquisition_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_status on products (product_status);
create index if not exists idx_products_category on products (category);

-- ---------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------
create table if not exists orders (
  order_id text primary key,
  order_date date not null,
  sales_platform text not null default 'eBay_DE',
  buyer_username text,
  sku text references products (sku) on delete set null,
  product_name text,
  condition text,
  quantity integer not null default 1,
  sale_currency text not null default 'EUR',
  fx_rate numeric not null default 1,
  item_price_local numeric not null default 0,
  shipping_charged_local numeric not null default 0,
  gross_sale_eur numeric not null default 0,
  fulfillment_type text not null default 'Self',
  supplier_name text,
  supplier_order_id text,
  supplier_order_date date,
  supplier_tracking_number text,
  supplier_ship_date date,
  order_status text not null default 'New',
  ebay_fee_percent numeric not null default 0.129,
  ebay_fee_eur numeric not null default 0,
  payment_fee_percent numeric not null default 0.029,
  fixed_payment_fee_eur numeric not null default 0.35,
  payment_fee_eur numeric not null default 0,
  product_cost_eur numeric not null default 0,
  shipping_packaging_cost_eur numeric not null default 0,
  total_order_cost_eur numeric not null default 0,
  net_profit_eur numeric not null default 0,
  net_margin numeric not null default 0,
  carrier text,
  buyer_tracking_number text,
  delivered_date date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_sku on orders (sku);
create index if not exists idx_orders_date on orders (order_date);

-- ---------------------------------------------------------------------
-- INVENTORY
-- ---------------------------------------------------------------------
create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  sku text not null references products (sku) on delete cascade,
  product_name text not null,
  variant text,
  inventory_type text not null default 'On Hand'
    check (inventory_type in ('On Hand', 'Dropship', 'Virtual')),
  location_bin text,
  quantity_on_hand integer not null default 0,
  quantity_reserved integer not null default 0,
  reorder_level integer not null default 0,
  supplier_name text,
  supplier_link text,
  lead_time_days integer default 0,
  last_restock_date date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_sku on inventory (sku);
create unique index if not exists idx_inventory_sku_unique on inventory (sku);

-- ---------------------------------------------------------------------
-- PRODUCT RESEARCH
-- ---------------------------------------------------------------------
create table if not exists product_research (
  id bigint generated always as identity primary key,
  keyword text not null,
  product_title text,
  category text,
  condition text default 'New',
  potential_model text not null default 'Stock',
  research_status text not null default 'Idea',
  platform text,
  supplier_platform text,
  main_listing_url text,
  image_url text,
  support_link_1 text,
  support_link_2 text,
  support_link_3 text,
  currency text not null default 'EUR',
  fx_rate numeric not null default 1,
  product_price_local numeric default 0,
  product_price_eur numeric default 0,
  shipping_local numeric default 0,
  shipping_eur numeric default 0,
  moq integer default 1,
  lead_time_days integer default 0,
  dropship_available boolean not null default false,
  seller_supplier text,
  competitor_prices jsonb not null default '[]',
  notes text,
  final_sku text references products (sku) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ACCOUNTS (income/expense ledger)
-- ---------------------------------------------------------------------
create table if not exists accounts (
  tx_id text primary key,
  tx_date date not null default current_date,
  type text not null,
  category text not null,
  amount_eur numeric not null,
  direction text not null check (direction in ('In', 'Out')),
  vat_rate_percent numeric,
  vat_amount_eur numeric,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_accounts_date on accounts (tx_date);

-- ---------------------------------------------------------------------
-- RETURNS / CASES
-- ---------------------------------------------------------------------
create table if not exists returns_cases (
  case_id text primary key,
  order_id text references orders (order_id) on delete set null,
  case_date date not null default current_date,
  reason text not null,
  status text not null default 'Open' check (status in ('Open', 'Resolved', 'Rejected')),
  refund_eur numeric not null default 0,
  net_loss_eur numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_returns_order on returns_cases (order_id);

-- ---------------------------------------------------------------------
-- Row Level Security: locked down, only authenticated users of this
-- project may read/write. Adjust if you add per-user data isolation.
-- ---------------------------------------------------------------------
alter table products enable row level security;
alter table orders enable row level security;
alter table inventory enable row level security;
alter table product_research enable row level security;
alter table accounts enable row level security;
alter table returns_cases enable row level security;
alter table settings enable row level security;

create policy "Authenticated users can do everything - products"
  on products for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users can do everything - orders"
  on orders for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users can do everything - inventory"
  on inventory for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users can do everything - product_research"
  on product_research for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users can do everything - accounts"
  on accounts for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users can do everything - returns_cases"
  on returns_cases for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users can do everything - settings"
  on settings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

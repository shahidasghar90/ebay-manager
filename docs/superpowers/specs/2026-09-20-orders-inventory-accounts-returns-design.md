# Orders, Inventory, Accounts, Returns Modules — Design

Date: 2026-09-20

## Context

The app (Next.js 15 + Supabase) currently has three working modules: Dashboard,
Products, and Research. The Supabase schema (`supabase/schema.sql`) already
defines `orders`, `inventory`, `accounts`, and `returns_cases` tables, and the
Dashboard already links to `/orders` and `/inventory`, but no pages exist for
any of the four remaining modules — those routes 404. The dashboard's
"Orders This Month" / "Net Profit This Month" / "Reorder Alerts" / "Open
Returns" stat cards also depend on these tables having real data.

A legacy Google Apps Script version of this app (`Google Sheet/*.js`) already
implements validated business logic for these four modules (fee/profit
formulas, auto-ledger entries). This design ports that logic into the new
Next.js + Supabase app, following the existing UI/data conventions established
by the Products module (`ProductForm.tsx`, `ProductsTable.tsx`,
`src/lib/pricing.ts`).

## Goals

- Build all four missing modules so the app has one continuous flow:
  Research → Product → Order → Inventory/Accounts → Returns, with no manual
  re-entry of data that already exists elsewhere in the system.
- Eliminate the 404s on `/orders`, `/inventory`, `/accounts`, `/returns`.
- Keep the same auto-linking pattern already proven by Research→Product
  (autofill from the source record, auto-create related records, status
  updates) and extend it forward into Orders/Inventory/Accounts/Returns.

## Non-goals (this cycle)

- Gmail/DHL email parsing and auto-attaching to orders (separate future
  phase, discussed but not part of this build).
- Matching the exact eBay CSV export column format — no sample file is
  available yet. CSV import uses our own template format instead.
- Reversing inventory/accounts side-effects when an order is cancelled
  (out of scope; can be a follow-up).

## Build order

One sequential plan, in this order, each step depending on the previous:

1. **Orders** module (+ a small fix to `ProductForm.tsx` so new products
   auto-create a matching `inventory` row)
2. **Inventory** module
3. **Accounts** module
4. **Returns** module
5. Dashboard verification (all links resolve, stat cards show real numbers)
6. End-to-end manual test with dummy data across the whole chain

## Shared conventions

Every new module follows the pattern already established by Products:
- Server component page (`page.tsx`) fetches the list via
  `createClient()` from `@/lib/supabase/server`, passes it to a client
  `*Table.tsx` component for search/filter/actions.
- A client `*Form.tsx` component handles create/edit, using
  `createClient()` from `@/lib/supabase/client`.
- Money formatting via `formatMoney` / status pill styling via
  `statusClassName` from `@/lib/format`.
- IDs generated the same way as `ProductForm.tsx` does for SKUs:
  `PREFIX-${Date.now().toString(36).toUpperCase()}`.

## 1. Orders module

### Data & auto-calc

New `src/lib/orderPricing.ts`, mirroring the legacy `Orders.js
buildOrderRow_` and the existing `src/lib/pricing.ts` style:

```
grossSaleEur = round2((itemPriceLocal + shippingChargedLocal) * fxRate)
ebayFeeEur = round2(grossSaleEur * ebayFeePercent)
paymentFeeEur = round2(grossSaleEur * paymentFeePercent + fixedPaymentFeeEur)
totalOrderCostEur = round2(productCostEur + shippingPackagingCostEur)
netProfitEur = round2(grossSaleEur - ebayFeeEur - paymentFeeEur - totalOrderCostEur)
netMargin = grossSaleEur > 0 ? netProfitEur / grossSaleEur : 0
```

`fxRate` comes from `fetchSettings()` keyed by `sale_currency`, same as
Products.

### SKU-linked autofill

Selecting a SKU in the order form fetches that product and autofills
(read-only-ish, still editable): `product_name`, `condition`,
`product_cost_eur` (= product's `total_cost_eur`), `ebay_fee_percent`,
`payment_fee_percent`, `fixed_payment_fee_eur`. This is the same
autofill-from-related-record pattern as Research→Product.

Manual fields: `buyer_username`, `quantity`, `sale_currency`,
`item_price_local`, `shipping_charged_local`, `fulfillment_type`,
`order_status`, `carrier`, `buyer_tracking_number`, `delivered_date`,
`notes`. Supplier/dropship fields (`supplier_order_id`,
`supplier_tracking_number`, etc.) are optional manual fields shown when
`fulfillment_type` is not `Self`.

### Pages

- `/orders` — list + search (order id, sku, buyer) + filters (status,
  platform, date range).
- `/orders/new` — manual entry form.
- `/orders/[orderId]` — detail view (mirrors `products/[sku]/page.tsx`
  layout/sections).
- `/orders/[orderId]/edit` — edit form.
- `/orders/import` — CSV bulk upload.

### Auto side-effects on order save

- **Accounts**: insert one `accounts` row —
  `{ type: 'Sale', category: 'eBay Sales', amount_eur: grossSaleEur,
  direction: 'In', notes: 'Auto: order <orderId> (<sku>)' }`.
- **Inventory**: decrement `quantity_on_hand` on the matching `inventory`
  row (matched by `sku`) by `quantity`. On **edit**, adjust by the delta
  between the new and previous quantity (not a flat re-deduct), so editing
  an order from qty 2 to qty 3 only deducts 1 more.
- If no `inventory` row exists for that SKU (pre-existing product created
  before the auto-create fix below), skip the deduct, log a console
  warning, and still save the order — inventory accuracy is secondary to
  not blocking a sale record.
- If the `accounts` insert fails, log the error but do not fail the order
  save — the order record is the source of truth.

### Fix required in `ProductForm.tsx`

On new product save (not edit), also insert a matching `inventory` row:
`{ sku, product_name, inventory_type: 'On Hand', quantity_on_hand: 0,
quantity_reserved: 0, reorder_level: 0 }`. This guarantees every order's
SKU has a row to deduct against going forward.

### CSV import

Template header row (exact names, any column order):

```
order_date, sales_platform, buyer_username, sku, quantity, sale_currency,
item_price_local, shipping_charged_local, fulfillment_type, order_status,
notes
```

- `order_id` is not in the CSV — generated on import, same scheme as
  manual save.
- Validation per row: `sku` must exist in `products` (otherwise reject
  with "SKU not found"); `quantity` and `item_price_local` must be
  numbers > 0; `order_date` must parse as a date. Missing
  `sales_platform`/`fulfillment_type`/`order_status` default to
  `eBay_DE` / `Self` / `New`.
- Flow: upload → parse client-side → preview table showing valid vs.
  invalid rows with reasons → "Import Valid Rows" button → each valid row
  goes through the same save path as a manual order (autofill from
  product, fee calc, accounts insert, inventory deduct).

### Order statuses

`New`, `Shipped`, `Delivered`, `Cancelled`. No automatic reversal of
inventory/accounts on `Cancelled` in this cycle.

## 2. Inventory module

- `/inventory` — list with a computed **Available** column
  (`quantity_on_hand - quantity_reserved`, or `N/A` when
  `inventory_type === 'Dropship'`) and a **Reorder Alert** badge
  (`available <= reorder_level` → `REORDER`, else `OK`; Dropship rows show
  "Supplier stock check" instead, matching the legacy sheet logic).
- `/inventory/new` — SKU dropdown (from `products`, autofills
  `product_name`, `supplier_name`, `supplier_link` from the product
  record), plus manual fields (`variant`, `inventory_type`,
  `location_bin`, `quantity_on_hand`, `quantity_reserved`,
  `reorder_level`, `lead_time_days`, `last_restock_date`, `notes`).
- `/inventory/[id]/edit` — same form pre-filled.
- Auto-create on product save (see Orders section fix above) means most
  rows exist before a human ever visits this page; manual create/edit
  covers restocks and adjustments.

## 3. Accounts module

- `/accounts` — ledger table (date, type, category, amount, direction,
  notes) newest-first, filters by type/direction/month, plus a summary
  strip (Total In / Total Out / Net for the filtered range).
- `/accounts/new` — manual transaction entry
  (`type`, `category`, `amount_eur`, `direction`, `notes`, `tx_date`).
- Auto-inserted rows (product purchase cost, order sale income, return
  refund) appear as normal rows in this same table — no special
  read-only lock; they're editable/deletable like any manual entry, since
  this is a personal ledger, not an audit log.

## 4. Returns module

- `/returns` — list (case id, order id, reason, status, refund, net
  loss).
- `/returns/new` — `order_id` dropdown (from `orders`, shows buyer/SKU
  preview once selected), `reason`, `refund_eur`, `additional_loss_eur`,
  `status` (`Open` / `Resolved` / `Rejected`).
  `net_loss_eur = refund_eur + additional_loss_eur` (matches legacy
  `Returns.js`).
- On save, auto-insert an `accounts` row: `{ type: 'Refund', category:
  'Returns', amount_eur: refund_eur, direction: 'Out', notes: 'Auto:
  return <caseId> for order <orderId>' }`.

## 5. Dashboard verification

Once the above pages exist, re-check `dashboard/page.tsx`'s existing
links (`/orders`, `/inventory`) resolve, and that its stat card queries
(`orders`, `inventory`, `returns_cases`) return meaningful numbers once
dummy data exists.

## 6. Testing plan (manual, with dummy data)

1. Create a dummy product → confirm a matching `inventory` row appears
   automatically with qty 0.
2. Create a manual order against that SKU → confirm: order appears in
   `/orders`; a `Sale` row appears in `/accounts`; the inventory row's
   `quantity_on_hand` decreases by the order quantity.
3. Edit that order's quantity up by 1 → confirm inventory adjusts by the
   delta only (not double-deducted).
4. Import a 3-row CSV (2 valid SKUs, 1 unknown SKU) → confirm the preview
   flags the invalid row, and only the 2 valid rows import with correct
   auto side-effects.
5. Create a return against the order → confirm it appears in `/returns`
   and a `Refund` row appears in `/accounts` with the correct amount.
6. Revisit `/dashboard` → confirm stat cards reflect the dummy data and
   the Quick Actions links no longer 404.

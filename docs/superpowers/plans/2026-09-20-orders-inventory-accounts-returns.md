# Orders, Inventory, Settings, Accounts (VAT), Returns, Research Pricing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four missing modules (Orders, Inventory, Accounts, Returns) plus a new Settings module and a Research competitor-pricing enhancement, so the app has one continuous flow (Research → Product → Order → Inventory/Accounts → Returns) with no repeated manual data entry, no 404s on the existing sidebar links, and VAT tracking that can be switched on/off.

**Architecture:** Next.js 15 App Router + Supabase (Postgres), following the exact pattern already established by the Products module: a server-component list page fetches rows and hands them to a client `*Table.tsx` for search/filter, a client `*Form.tsx` handles create/edit against `supabase.from(...).insert/update`, and pure calculation logic lives in `src/lib/*.ts` so it can be unit tested without touching the database.

**Tech Stack:** Next.js 15, React 18, TypeScript, Supabase JS v2 (`@supabase/ssr` for server, `@supabase/supabase-js` for client), Tailwind CSS. Vitest is added in Task 2 as the project currently has zero test infrastructure.

## Global Constraints

- Money values are stored and displayed as EUR; `formatMoney` (`src/lib/format.ts`) already handles `de-DE` currency formatting — reuse it, don't reformat manually.
- Status pills use `statusClassName` (`src/lib/format.ts`), which lowercases and dashes the value into a CSS class (`status-<value>`) — reuse it for any new status field.
- IDs for new rows follow the existing SKU convention from `ProductForm.tsx:254`: `` `PREFIX-${Date.now().toString(36).toUpperCase()}` ``.
- Every new page under `src/app/(app)/` must export `const dynamic = 'force-dynamic'` at the top when it's a server component reading from Supabase (matches `dashboard/page.tsx`, `products/page.tsx`, `research/page.tsx`), so data is never stale from caching.
- Every new list page follows the two-file split: `page.tsx` (server component, data fetch) + `XTable.tsx` (`'use client'`, search/filter/actions) — do not fetch data inside a client component.
- All new Supabase table/column access must go through the existing RLS policies (`auth.role() = 'authenticated'`) — no new policies are needed unless a task says so explicitly.
- Never invent a field name — cross-check against `src/lib/types.ts` and `supabase/schema.sql` before using a column name in a query.

---

## File Structure Overview

New files this plan creates, grouped by responsibility:

```
supabase/migrations/2026-09-20-vat-and-competitor-pricing.sql   (DB: new columns + settings rows)
supabase/schema.sql                                             (modified: keep fresh-install schema in sync)

src/lib/orderPricing.ts / .test.ts        (pure order fee/profit calc)
src/lib/orderCsv.ts / .test.ts            (pure CSV parse + validation)
src/lib/vat.ts / .test.ts                 (pure VAT calc + ledger summary)
src/lib/competitorStats.ts / .test.ts     (pure min/max/avg calc)
src/lib/settings.ts                        (modified: vatRegistered/vatRatePercent)
src/lib/types.ts                           (modified: Order/AccountTx/ResearchItem/Settings additions)

src/app/(app)/products/ProductForm.tsx     (modified: auto-create Inventory row)

src/app/(app)/orders/page.tsx
src/app/(app)/orders/OrdersTable.tsx
src/app/(app)/orders/OrderForm.tsx
src/app/(app)/orders/new/page.tsx
src/app/(app)/orders/[orderId]/page.tsx
src/app/(app)/orders/[orderId]/edit/page.tsx
src/app/(app)/orders/import/page.tsx

src/app/(app)/inventory/page.tsx
src/app/(app)/inventory/InventoryTable.tsx
src/app/(app)/inventory/InventoryForm.tsx
src/app/(app)/inventory/new/page.tsx
src/app/(app)/inventory/[id]/edit/page.tsx

src/app/(app)/settings/page.tsx
src/app/(app)/settings/SettingsForm.tsx
src/components/Sidebar.tsx                 (modified: add Settings nav item)

src/app/(app)/accounts/page.tsx
src/app/(app)/accounts/AccountsTable.tsx
src/app/(app)/accounts/AccountsForm.tsx
src/app/(app)/accounts/new/page.tsx
src/app/(app)/accounts/[txId]/edit/page.tsx

src/app/(app)/returns/page.tsx
src/app/(app)/returns/ReturnsTable.tsx
src/app/(app)/returns/ReturnForm.tsx
src/app/(app)/returns/new/page.tsx

src/app/(app)/research/ResearchForm.tsx    (modified: competitor price rows)
src/app/(app)/research/ResearchTable.tsx   (modified: min/max/avg display)
```

---

### Task 1: Database migration — VAT columns, competitor pricing, settings keys

**Files:**
- Create: `supabase/migrations/2026-09-20-vat-and-competitor-pricing.sql`
- Modify: `supabase/schema.sql:16-22` (settings seed rows), `supabase/schema.sql:152-180` (`product_research` table), and add a new block near line 194 for `accounts` VAT columns.

**Interfaces:**
- Produces: `accounts.vat_rate_percent numeric` (nullable), `accounts.vat_amount_eur numeric` (nullable), `product_research.competitor_prices jsonb` (default `'[]'`), `settings` rows `vat_registered` (0/1) and `vat_rate_percent` (default 19).

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/2026-09-20-vat-and-competitor-pricing.sql
-- Run this once in the Supabase SQL editor against the existing project.

alter table accounts add column if not exists vat_rate_percent numeric;
alter table accounts add column if not exists vat_amount_eur numeric;

alter table product_research add column if not exists competitor_prices jsonb not null default '[]';

insert into settings (key, value) values
  ('vat_registered', 0),
  ('vat_rate_percent', 19)
on conflict (key) do nothing;
```

- [ ] **Step 2: Run the migration against the local Supabase project**

Open the Supabase SQL editor for this project and run the file's contents
(or `psql` if a direct connection string is available). There is no
migration runner in this repo — `supabase/schema.sql`'s own header
comment confirms SQL files here are run manually.

- [ ] **Step 3: Verify the columns and rows exist**

Run in the SQL editor:

```sql
select column_name from information_schema.columns where table_name = 'accounts' and column_name like 'vat_%';
select column_name from information_schema.columns where table_name = 'product_research' and column_name = 'competitor_prices';
select key, value from settings where key in ('vat_registered', 'vat_rate_percent');
```

Expected: both `vat_rate_percent` and `vat_amount_eur` listed for
`accounts`; `competitor_prices` listed for `product_research`; both
settings rows present (`vat_registered = 0`, `vat_rate_percent = 19`).

- [ ] **Step 4: Update `supabase/schema.sql` so a fresh install matches**

In the `settings` seed block (`supabase/schema.sql:16-22`), add the two
new rows so a brand-new project gets them without needing the migration:

```sql
insert into settings (key, value) values
  ('fx_usd', 1.08),
  ('fx_pkr', 310),
  ('ebay_fee_percent', 0.129),
  ('payment_fee_percent', 0.029),
  ('fixed_payment_fee_eur', 0.35),
  ('vat_registered', 0),
  ('vat_rate_percent', 19)
on conflict (key) do nothing;
```

In the `accounts` table definition (`supabase/schema.sql:185-194`), add
the two nullable columns before the closing `);`:

```sql
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
```

In the `product_research` table definition (`supabase/schema.sql:152-180`),
add the column right after `seller_supplier`:

```sql
  seller_supplier text,
  competitor_prices jsonb not null default '[]',
  notes text,
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/2026-09-20-vat-and-competitor-pricing.sql supabase/schema.sql
git commit -m "feat(db): add VAT columns on accounts and competitor_prices on product_research"
```

---

### Task 2: Test runner setup + order pricing calculation

**Files:**
- Modify: `package.json` (add `vitest` devDependency and `test` script)
- Create: `vitest.config.ts`
- Create: `src/lib/orderPricing.ts`
- Test: `src/lib/orderPricing.test.ts`

**Interfaces:**
- Produces: `calculateOrderPricing(input: OrderPricingInput): OrderPricingResult` — consumed by `OrderForm.tsx` (Task 5/7) and the CSV importer (Task 9).

- [ ] **Step 1: Add Vitest to the project**

```bash
npm install -D vitest
```

- [ ] **Step 2: Add the test script and config**

In `package.json`, inside `"scripts"`, add:

```json
"test": "vitest run"
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node'
  }
});
```

- [ ] **Step 3: Write the failing test**

Create `src/lib/orderPricing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateOrderPricing } from './orderPricing';

describe('calculateOrderPricing', () => {
  it('computes gross sale, fees, and net profit for a simple EUR order', () => {
    const result = calculateOrderPricing({
      fxRate: 1,
      itemPriceLocal: 30,
      shippingChargedLocal: 5,
      ebayFeePercent: 0.129,
      paymentFeePercent: 0.029,
      fixedPaymentFeeEur: 0.35,
      productCostEur: 15,
      shippingPackagingCostEur: 2
    });

    expect(result.grossSaleEur).toBe(35);
    expect(result.ebayFeeEur).toBe(4.52);
    expect(result.paymentFeeEur).toBe(1.37);
    expect(result.totalOrderCostEur).toBe(17);
    expect(result.netProfitEur).toBe(12.11);
    expect(result.netMargin).toBeCloseTo(0.3460, 4);
  });

  it('converts a non-EUR sale using the fx rate before computing fees', () => {
    const result = calculateOrderPricing({
      fxRate: 1.08,
      itemPriceLocal: 20,
      shippingChargedLocal: 0,
      ebayFeePercent: 0.129,
      paymentFeePercent: 0.029,
      fixedPaymentFeeEur: 0.35,
      productCostEur: 10,
      shippingPackagingCostEur: 0
    });

    expect(result.grossSaleEur).toBe(21.6);
  });

  it('returns zero margin when gross sale is zero', () => {
    const result = calculateOrderPricing({
      fxRate: 1,
      itemPriceLocal: 0,
      shippingChargedLocal: 0,
      ebayFeePercent: 0.129,
      paymentFeePercent: 0.029,
      fixedPaymentFeeEur: 0.35,
      productCostEur: 0,
      shippingPackagingCostEur: 0
    });

    expect(result.netMargin).toBe(0);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './orderPricing'`.

- [ ] **Step 5: Write the implementation**

Create `src/lib/orderPricing.ts`:

```ts
// Mirrors the legacy Apps Script Orders.js buildOrderRow_ formula.

export type OrderPricingInput = {
  fxRate: number;
  itemPriceLocal: number;
  shippingChargedLocal: number;
  ebayFeePercent: number;
  paymentFeePercent: number;
  fixedPaymentFeeEur: number;
  productCostEur: number;
  shippingPackagingCostEur: number;
};

export type OrderPricingResult = {
  grossSaleEur: number;
  ebayFeeEur: number;
  paymentFeeEur: number;
  totalOrderCostEur: number;
  netProfitEur: number;
  netMargin: number;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateOrderPricing(input: OrderPricingInput): OrderPricingResult {
  const grossSaleEur = round2((input.itemPriceLocal + input.shippingChargedLocal) * input.fxRate);
  const ebayFeeEur = round2(grossSaleEur * input.ebayFeePercent);
  const paymentFeeEur = round2(grossSaleEur * input.paymentFeePercent + input.fixedPaymentFeeEur);
  const totalOrderCostEur = round2(input.productCostEur + input.shippingPackagingCostEur);
  const netProfitEur = round2(grossSaleEur - ebayFeeEur - paymentFeeEur - totalOrderCostEur);
  const netMargin = grossSaleEur > 0 ? Math.round((netProfitEur / grossSaleEur) * 10000) / 10000 : 0;

  return { grossSaleEur, ebayFeeEur, paymentFeeEur, totalOrderCostEur, netProfitEur, netMargin };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/orderPricing.ts src/lib/orderPricing.test.ts
git commit -m "test: add vitest and order pricing calculation"
```

---

### Task 3: Auto-create an Inventory row when a new Product is saved

**Files:**
- Modify: `src/app/(app)/products/ProductForm.tsx:302-317`

**Interfaces:**
- Consumes: existing `payload.sku`, `payload.product_name` already built in `handleSubmit`.
- Produces: a matching row in `inventory` for every new product, which Task 5's order-save inventory deduct (and Task 10's Inventory list) depend on existing.

- [ ] **Step 1: Add the insert right after a successful new-product save**

In `src/app/(app)/products/ProductForm.tsx`, the current save block is:

```tsx
    const { error: saveError } = isEditing
      ? await supabase.from('products').update(payload).eq('sku', sku)
      : await supabase.from('products').insert(payload);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    if (!isEditing && research) {
```

Change it to also create the inventory row, right after the products
insert succeeds and before the research-conversion update:

```tsx
    const { error: saveError } = isEditing
      ? await supabase.from('products').update(payload).eq('sku', sku)
      : await supabase.from('products').insert(payload);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    if (!isEditing) {
      const { error: inventoryError } = await supabase.from('inventory').insert({
        sku,
        product_name: form.productName,
        inventory_type: 'On Hand',
        quantity_on_hand: 0,
        quantity_reserved: 0,
        reorder_level: 0
      });

      if (inventoryError) {
        console.error('Failed to auto-create inventory row:', inventoryError.message);
      }
    }

    if (!isEditing && research) {
```

- [ ] **Step 2: Manually verify (no test framework covers Supabase-backed forms in this codebase — follow the existing convention)**

Run `npm run dev`, log in, go to `/products/new`, save a new product with
a fresh SKU. Then open the Supabase table editor (or run
`select * from inventory where sku = '<the sku>';` in the SQL editor) and
confirm one row exists with `quantity_on_hand = 0`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/products/ProductForm.tsx"
git commit -m "feat(products): auto-create matching inventory row on new product save"
```

---

### Task 4: Orders list page

**Files:**
- Create: `src/app/(app)/orders/OrdersTable.tsx`
- Create: `src/app/(app)/orders/page.tsx`

**Interfaces:**
- Consumes: `Order` type (`src/lib/types.ts:51-82`), `formatMoney`/`formatDate`/`statusClassName` (`src/lib/format.ts`).
- Produces: the `/orders` route the Dashboard's "View all" and "Add Order" links (`dashboard/page.tsx:93,141`) and the Sidebar's "Orders" link (`Sidebar.tsx:11`) already point at.

- [ ] **Step 1: Create the table component**

Create `src/app/(app)/orders/OrdersTable.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDate, formatMoney, statusClassName } from '@/lib/format';
import type { Order } from '@/lib/types';

export default function OrdersTable({ orders }: { orders: Order[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (statusFilter && order.order_status !== statusFilter) return false;
      if (!query) return true;

      return [order.order_id, order.sku, order.buyer_username, order.product_name]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [orders, search, statusFilter]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <input
          className="field-input sm:max-w-[420px]"
          placeholder="Search order ID, SKU, buyer..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="field-input w-auto min-w-[150px]"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">All Status</option>
          <option value="New">New</option>
          <option value="Shipped">Shipped</option>
          <option value="Delivered">Delivered</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
                <th className="p-3">Order ID</th>
                <th className="p-3">Date</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Buyer</th>
                <th className="p-3">Qty</th>
                <th className="p-3">Sale</th>
                <th className="p-3">Profit</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-muted p-5">
                    No orders found.
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.order_id} className="border-b border-border">
                    <td className="p-3">{order.order_id}</td>
                    <td className="p-3">{formatDate(order.order_date)}</td>
                    <td className="p-3">{order.sku}</td>
                    <td className="p-3">{order.buyer_username || '—'}</td>
                    <td className="p-3">{order.quantity}</td>
                    <td className="p-3">{formatMoney(order.gross_sale_eur)}</td>
                    <td className="p-3">{formatMoney(order.net_profit_eur)}</td>
                    <td className="p-3">
                      <span className={statusClassName(order.order_status)}>
                        {order.order_status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1.5">
                        <Link
                          href={`/orders/${order.order_id}`}
                          className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue"
                        >
                          View
                        </Link>
                        <Link
                          href={`/orders/${order.order_id}/edit`}
                          className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the page**

Create `src/app/(app)/orders/page.tsx`:

```tsx
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { Order } from '@/lib/types';
import OrdersTable from './OrdersTable';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .order('order_date', { ascending: false });

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Track eBay sales, fulfillment, and profit"
        actions={
          <>
            <Link href="/orders/import" className="btn-secondary">
              Import CSV
            </Link>
            <Link href="/orders/new" className="btn-primary">
              + Add Order
            </Link>
          </>
        }
      />

      <OrdersTable orders={(orders as Order[]) || []} />
    </div>
  );
}
```

- [ ] **Step 3: Manually verify**

Run `npm run dev`, visit `/orders`. Expected: page loads (no 404), shows
"No orders found." since the table is empty.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/orders/OrdersTable.tsx" "src/app/(app)/orders/page.tsx"
git commit -m "feat(orders): add orders list page"
```

---

### Task 5: Order create form with SKU autofill, Accounts insert, Inventory deduct

**Files:**
- Create: `src/app/(app)/orders/OrderForm.tsx`
- Create: `src/app/(app)/orders/new/page.tsx`

**Interfaces:**
- Consumes: `calculateOrderPricing` (Task 2), `fetchSettings` (`src/lib/settings.ts`), `Product`/`Order` types.
- Produces: `OrderForm` component accepting `{ products: Product[]; order?: Order }` — Task 7 (edit page) reuses this same component with `order` set.

- [ ] **Step 1: Create the form component**

Create `src/app/(app)/orders/OrderForm.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchSettings } from '@/lib/settings';
import { calculateOrderPricing } from '@/lib/orderPricing';
import { formatMoney } from '@/lib/format';
import type { Order, Product, Settings } from '@/lib/types';

type FormState = {
  sku: string;
  buyerUsername: string;
  quantity: string;
  salesPlatform: string;
  saleCurrency: 'EUR' | 'USD' | 'PKR';
  itemPriceLocal: string;
  shippingChargedLocal: string;
  fulfillmentType: 'Self' | 'Dropship';
  orderStatus: string;
  orderDate: string;
  supplierOrderId: string;
  supplierTrackingNumber: string;
  carrier: string;
  buyerTrackingNumber: string;
  deliveredDate: string;
  notes: string;
};

function initialState(order?: Order): FormState {
  return {
    sku: order?.sku || '',
    buyerUsername: order?.buyer_username || '',
    quantity: String(order?.quantity ?? 1),
    salesPlatform: order?.sales_platform || 'eBay_DE',
    saleCurrency: (order?.sale_currency as FormState['saleCurrency']) || 'EUR',
    itemPriceLocal: String(order?.item_price_local ?? ''),
    shippingChargedLocal: String(order?.shipping_charged_local ?? ''),
    fulfillmentType: (order?.fulfillment_type as FormState['fulfillmentType']) || 'Self',
    orderStatus: order?.order_status || 'New',
    orderDate: order?.order_date || new Date().toISOString().slice(0, 10),
    supplierOrderId: '',
    supplierTrackingNumber: '',
    carrier: order?.carrier || '',
    buyerTrackingNumber: order?.buyer_tracking_number || '',
    deliveredDate: order?.delivered_date || '',
    notes: order?.notes || ''
  };
}

function num(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function OrderForm({ products, order }: { products: Product[]; order?: Order }) {
  const isEditing = !!order;
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<FormState>(() => initialState(order));
  const [settings, setSettings] = useState<Settings>({
    fxRates: { EUR: 1, USD: 1.08, PKR: 310 },
    ebayFeePercent: 0.129,
    paymentFeePercent: 0.029,
    fixedPaymentFeeEur: 0.35,
    vatRegistered: false,
    vatRatePercent: 19
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings(supabase).then(setSettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const selectedProduct = useMemo(
    () => products.find((product) => product.sku === form.sku),
    [products, form.sku]
  );

  const pricing = useMemo(
    () =>
      calculateOrderPricing({
        fxRate: settings.fxRates[form.saleCurrency] || 1,
        itemPriceLocal: num(form.itemPriceLocal),
        shippingChargedLocal: num(form.shippingChargedLocal),
        ebayFeePercent: selectedProduct?.ebay_fee_percent ?? settings.ebayFeePercent,
        paymentFeePercent: selectedProduct?.payment_fee_percent ?? settings.paymentFeePercent,
        fixedPaymentFeeEur: selectedProduct?.fixed_payment_fee_eur ?? settings.fixedPaymentFeeEur,
        productCostEur: selectedProduct?.total_cost_eur ?? 0,
        shippingPackagingCostEur: 0
      }),
    [form.itemPriceLocal, form.shippingChargedLocal, form.saleCurrency, selectedProduct, settings]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    if (!selectedProduct) {
      setError('Select a valid SKU.');
      setSaving(false);
      return;
    }

    const orderId = order?.order_id || `EB-${Date.now().toString(36).toUpperCase()}`;
    const quantity = num(form.quantity) || 1;

    const vatAmountEur = settings.vatRegistered
      ? Math.round((pricing.grossSaleEur * settings.vatRatePercent / 100 + Number.EPSILON) * 100) / 100
      : null;

    const payload = {
      order_id: orderId,
      order_date: form.orderDate,
      sales_platform: form.salesPlatform,
      buyer_username: form.buyerUsername || null,
      sku: form.sku,
      product_name: selectedProduct.product_name,
      condition: selectedProduct.condition,
      quantity,
      sale_currency: form.saleCurrency,
      fx_rate: settings.fxRates[form.saleCurrency] || 1,
      item_price_local: num(form.itemPriceLocal),
      shipping_charged_local: num(form.shippingChargedLocal),
      gross_sale_eur: pricing.grossSaleEur,
      fulfillment_type: form.fulfillmentType,
      order_status: form.orderStatus,
      ebay_fee_percent: selectedProduct.ebay_fee_percent,
      ebay_fee_eur: pricing.ebayFeeEur,
      payment_fee_percent: selectedProduct.payment_fee_percent,
      fixed_payment_fee_eur: selectedProduct.fixed_payment_fee_eur,
      payment_fee_eur: pricing.paymentFeeEur,
      product_cost_eur: selectedProduct.total_cost_eur,
      shipping_packaging_cost_eur: 0,
      total_order_cost_eur: pricing.totalOrderCostEur,
      net_profit_eur: pricing.netProfitEur,
      net_margin: pricing.netMargin,
      carrier: form.carrier || null,
      buyer_tracking_number: form.buyerTrackingNumber || null,
      delivered_date: form.deliveredDate || null,
      notes: form.notes || null
    };

    const { error: saveError } = isEditing
      ? await supabase.from('orders').update(payload).eq('order_id', orderId)
      : await supabase.from('orders').insert(payload);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    const previousQuantity = isEditing ? order!.quantity : 0;
    const quantityDelta = quantity - previousQuantity;

    if (quantityDelta !== 0) {
      const { data: inventoryRow } = await supabase
        .from('inventory')
        .select('id, quantity_on_hand')
        .eq('sku', form.sku)
        .maybeSingle();

      if (inventoryRow) {
        const { error: inventoryError } = await supabase
          .from('inventory')
          .update({ quantity_on_hand: inventoryRow.quantity_on_hand - quantityDelta })
          .eq('id', inventoryRow.id);

        if (inventoryError) {
          console.error('Failed to adjust inventory:', inventoryError.message);
        }
      } else {
        console.warn(`No inventory row for SKU ${form.sku} — skipping stock deduction.`);
      }
    }

    if (!isEditing) {
      const { error: accountError } = await supabase.from('accounts').insert({
        tx_id: `ACC-${Date.now().toString(36).toUpperCase()}`,
        type: 'Sale',
        category: 'eBay Sales',
        amount_eur: pricing.grossSaleEur,
        direction: 'In',
        vat_rate_percent: settings.vatRegistered ? settings.vatRatePercent : null,
        vat_amount_eur: vatAmountEur,
        notes: `Auto: order ${orderId} (${form.sku})`
      });

      if (accountError) {
        console.error('Failed to auto-create accounts entry:', accountError.message);
      }
    }

    router.push('/orders');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <PreviewField label="Gross Sale" value={formatMoney(pricing.grossSaleEur)} />
          <PreviewField label="eBay Fee" value={formatMoney(pricing.ebayFeeEur)} />
          <PreviewField label="Payment Fee" value={formatMoney(pricing.paymentFeeEur)} />
          <PreviewField
            label="Net Profit"
            value={formatMoney(pricing.netProfitEur)}
            tone={pricing.netProfitEur < 0 ? 'text-red' : 'text-green'}
          />
        </div>
      </div>

      <div className="card p-5">
        <div className="grid sm:grid-cols-2 gap-3.5">
          <label className="field-label">
            SKU *
            <select
              className="field-input"
              required
              value={form.sku}
              onChange={(e) => setField('sku', e.target.value)}
              disabled={isEditing}
            >
              <option value="">Select a product</option>
              {products.map((product) => (
                <option key={product.sku} value={product.sku}>
                  {product.sku} — {product.product_name}
                </option>
              ))}
            </select>
          </label>

          <label className="field-label">
            Order Date *
            <input
              className="field-input"
              type="date"
              required
              value={form.orderDate}
              onChange={(e) => setField('orderDate', e.target.value)}
            />
          </label>

          <label className="field-label">
            Buyer Username
            <input
              className="field-input"
              value={form.buyerUsername}
              onChange={(e) => setField('buyerUsername', e.target.value)}
            />
          </label>

          <label className="field-label">
            Quantity *
            <input
              className="field-input"
              type="number"
              min="1"
              step="1"
              required
              value={form.quantity}
              onChange={(e) => setField('quantity', e.target.value)}
            />
          </label>

          <label className="field-label">
            Sales Platform
            <select
              className="field-input"
              value={form.salesPlatform}
              onChange={(e) => setField('salesPlatform', e.target.value)}
            >
              <option value="eBay_DE">eBay Germany</option>
              <option value="eBay_US">eBay USA</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <label className="field-label">
            Sale Currency *
            <select
              className="field-input"
              value={form.saleCurrency}
              onChange={(e) => setField('saleCurrency', e.target.value as FormState['saleCurrency'])}
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="PKR">PKR</option>
            </select>
          </label>

          <label className="field-label">
            Item Price (sale currency) *
            <input
              className="field-input"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.itemPriceLocal}
              onChange={(e) => setField('itemPriceLocal', e.target.value)}
            />
          </label>

          <label className="field-label">
            Shipping Charged (sale currency)
            <input
              className="field-input"
              type="number"
              min="0"
              step="0.01"
              value={form.shippingChargedLocal}
              onChange={(e) => setField('shippingChargedLocal', e.target.value)}
            />
          </label>

          <label className="field-label">
            Fulfillment Type
            <select
              className="field-input"
              value={form.fulfillmentType}
              onChange={(e) => setField('fulfillmentType', e.target.value as FormState['fulfillmentType'])}
            >
              <option value="Self">Self</option>
              <option value="Dropship">Dropship</option>
            </select>
          </label>

          <label className="field-label">
            Order Status
            <select
              className="field-input"
              value={form.orderStatus}
              onChange={(e) => setField('orderStatus', e.target.value)}
            >
              <option value="New">New</option>
              <option value="Shipped">Shipped</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </label>

          <label className="field-label">
            Carrier
            <input
              className="field-input"
              value={form.carrier}
              onChange={(e) => setField('carrier', e.target.value)}
            />
          </label>

          <label className="field-label">
            Buyer Tracking Number
            <input
              className="field-input"
              value={form.buyerTrackingNumber}
              onChange={(e) => setField('buyerTrackingNumber', e.target.value)}
            />
          </label>

          <label className="field-label">
            Delivered Date
            <input
              className="field-input"
              type="date"
              value={form.deliveredDate}
              onChange={(e) => setField('deliveredDate', e.target.value)}
            />
          </label>

          <label className="field-label sm:col-span-2">
            Notes
            <textarea
              className="field-input"
              rows={3}
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
            />
          </label>
        </div>

        {error && <p className="text-red font-semibold mt-4">{error}</p>}

        <div className="flex justify-end gap-2.5 mt-5 pt-4 border-t border-border">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isEditing ? 'Update Order' : 'Save Order'}
          </button>
        </div>
      </div>
    </form>
  );
}

function PreviewField({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase text-muted font-bold">{label}</span>
      <strong className={`text-lg ${tone || ''}`}>{value}</strong>
    </div>
  );
}
```

- [ ] **Step 2: Create the new-order page**

Create `src/app/(app)/orders/new/page.tsx`:

```tsx
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';
import OrderForm from '../OrderForm';

export default async function NewOrderPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .neq('product_status', 'Archived')
    .order('product_name', { ascending: true });

  return (
    <div>
      <PageHeader title="Add Order" subtitle="Record a new eBay sale" />
      <OrderForm products={(products as Product[]) || []} />
    </div>
  );
}
```

- [ ] **Step 3: Manually verify**

Create a dummy product first (via `/products/new`) if none exist. Then
visit `/orders/new`, pick that SKU, fill quantity/price, save. Confirm:
redirected to `/orders` and the new row appears; check
`select * from accounts order by created_at desc limit 1;` shows the
auto `Sale` row; check the `inventory` row's `quantity_on_hand`
decreased by the order quantity.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/orders/OrderForm.tsx" "src/app/(app)/orders/new/page.tsx"
git commit -m "feat(orders): add order create form with SKU autofill, accounts and inventory side-effects"
```

---

### Task 6: Order detail page

**Files:**
- Create: `src/app/(app)/orders/[orderId]/page.tsx`

**Interfaces:**
- Consumes: `Order` type, `formatMoney`/`formatDate`/`statusClassName`.

- [ ] **Step 1: Create the page**

Create `src/app/(app)/orders/[orderId]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatMoney, statusClassName } from '@/lib/format';
import type { Order } from '@/lib/types';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase text-muted font-bold">{label}</span>
      <strong className="text-sm break-words">{value || '—'}</strong>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs uppercase tracking-wide text-blue font-bold border-b border-border pb-1.5 mb-2.5">
        {title}
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

export default async function OrderDetailPage({
  params
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('orders').select('*').eq('order_id', orderId).maybeSingle();

  if (!data) notFound();

  const order = data as Order;

  return (
    <div>
      <PageHeader
        title={order.order_id}
        subtitle={order.product_name || order.sku || ''}
        actions={
          <>
            <Link href={`/orders/${order.order_id}/edit`} className="btn-secondary">
              Edit
            </Link>
            <Link href="/orders" className="btn-secondary">
              Back to Orders
            </Link>
          </>
        }
      />

      <div className="card p-5 grid gap-6">
        <Section title="Overview">
          <Field label="Order ID" value={order.order_id} />
          <Field label="Date" value={formatDate(order.order_date)} />
          <Field label="Platform" value={order.sales_platform} />
          <Field label="Buyer" value={order.buyer_username || ''} />
          <Field label="SKU" value={order.sku || ''} />
          <Field label="Quantity" value={String(order.quantity)} />
          <div>
            <span className="text-[11px] uppercase text-muted font-bold block mb-1">Status</span>
            <span className={statusClassName(order.order_status)}>{order.order_status}</span>
          </div>
        </Section>

        <Section title="Financials">
          <Field label="Gross Sale" value={formatMoney(order.gross_sale_eur)} />
          <Field label="eBay Fee" value={formatMoney(order.ebay_fee_eur)} />
          <Field label="Payment Fee" value={formatMoney(order.payment_fee_eur)} />
          <Field label="Total Cost" value={formatMoney(order.total_order_cost_eur)} />
          <Field label="Net Profit" value={formatMoney(order.net_profit_eur)} />
          <Field label="Net Margin" value={`${(Number(order.net_margin || 0) * 100).toFixed(1)}%`} />
        </Section>

        <Section title="Fulfillment">
          <Field label="Fulfillment Type" value={order.fulfillment_type} />
          <Field label="Carrier" value={order.carrier || ''} />
          <Field label="Buyer Tracking" value={order.buyer_tracking_number || ''} />
          <Field label="Delivered Date" value={formatDate(order.delivered_date)} />
        </Section>

        {order.notes && (
          <Section title="Notes">
            <p className="col-span-full text-sm">{order.notes}</p>
          </Section>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manually verify**

Visit `/orders/[the order id you created in Task 5]`. Expected: all
fields populated correctly, matching what was entered.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/orders/[orderId]/page.tsx"
git commit -m "feat(orders): add order detail page"
```

---

### Task 7: Order edit page

**Files:**
- Create: `src/app/(app)/orders/[orderId]/edit/page.tsx`

**Interfaces:**
- Consumes: `OrderForm` from Task 5 (already supports `order` prop for edit mode and delta-based inventory adjustment).

- [ ] **Step 1: Create the page**

Create `src/app/(app)/orders/[orderId]/edit/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { Order, Product } from '@/lib/types';
import OrderForm from '../../OrderForm';

export default async function EditOrderPage({
  params
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: products }] = await Promise.all([
    supabase.from('orders').select('*').eq('order_id', orderId).maybeSingle(),
    supabase.from('products').select('*').order('product_name', { ascending: true })
  ]);

  if (!order) notFound();

  return (
    <div>
      <PageHeader title={`Edit Order — ${order.order_id}`} subtitle={order.product_name || ''} />
      <OrderForm order={order as Order} products={(products as Product[]) || []} />
    </div>
  );
}
```

- [ ] **Step 2: Manually verify the delta logic**

Note the inventory row's `quantity_on_hand` for the order's SKU. Edit
the order from quantity 1 to quantity 2 and save. Confirm
`quantity_on_hand` dropped by exactly 1 more (not re-deducted by the
full new quantity).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/orders/[orderId]/edit/page.tsx"
git commit -m "feat(orders): add order edit page"
```

---

### Task 8: CSV parsing and validation for order import

**Files:**
- Create: `src/lib/orderCsv.ts`
- Test: `src/lib/orderCsv.test.ts`

**Interfaces:**
- Produces: `parseOrderCsv(csvText: string, knownSkus: Set<string>): { valid: OrderCsvRow[]; invalid: { line: number; reason: string; raw: Record<string,string> }[] }` — consumed by the import page (Task 9).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/orderCsv.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseOrderCsv } from './orderCsv';

const knownSkus = new Set(['SKU-ABC123']);

describe('parseOrderCsv', () => {
  it('parses valid rows with defaults applied for missing optional fields', () => {
    const csv = [
      'order_date,sales_platform,buyer_username,sku,quantity,sale_currency,item_price_local,shipping_charged_local,fulfillment_type,order_status,notes',
      '2026-01-05,eBay_DE,buyer1,SKU-ABC123,2,EUR,25,5,,,'
    ].join('\n');

    const result = parseOrderCsv(csv, knownSkus);

    expect(result.invalid).toHaveLength(0);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]).toMatchObject({
      sku: 'SKU-ABC123',
      quantity: 2,
      item_price_local: 25,
      shipping_charged_local: 5,
      sales_platform: 'eBay_DE',
      fulfillment_type: 'Self',
      order_status: 'New'
    });
  });

  it('rejects a row whose SKU is not known', () => {
    const csv = [
      'order_date,sales_platform,buyer_username,sku,quantity,sale_currency,item_price_local,shipping_charged_local,fulfillment_type,order_status,notes',
      '2026-01-05,eBay_DE,buyer1,SKU-UNKNOWN,1,EUR,10,0,Self,New,'
    ].join('\n');

    const result = parseOrderCsv(csv, knownSkus);

    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].reason).toContain('SKU not found');
  });

  it('rejects a row with a non-positive quantity', () => {
    const csv = [
      'order_date,sales_platform,buyer_username,sku,quantity,sale_currency,item_price_local,shipping_charged_local,fulfillment_type,order_status,notes',
      '2026-01-05,eBay_DE,buyer1,SKU-ABC123,0,EUR,10,0,Self,New,'
    ].join('\n');

    const result = parseOrderCsv(csv, knownSkus);

    expect(result.valid).toHaveLength(0);
    expect(result.invalid[0].reason).toContain('Quantity');
  });

  it('handles a mix of valid and invalid rows in one file', () => {
    const csv = [
      'order_date,sales_platform,buyer_username,sku,quantity,sale_currency,item_price_local,shipping_charged_local,fulfillment_type,order_status,notes',
      '2026-01-05,eBay_DE,buyer1,SKU-ABC123,1,EUR,10,0,Self,New,',
      '2026-01-06,eBay_DE,buyer2,SKU-UNKNOWN,1,EUR,10,0,Self,New,'
    ].join('\n');

    const result = parseOrderCsv(csv, knownSkus);

    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].line).toBe(3);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './orderCsv'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/orderCsv.ts`:

```ts
export type OrderCsvRow = {
  order_date: string;
  sales_platform: string;
  buyer_username: string;
  sku: string;
  quantity: number;
  sale_currency: string;
  item_price_local: number;
  shipping_charged_local: number;
  fulfillment_type: string;
  order_status: string;
  notes: string;
};

export type OrderCsvInvalidRow = {
  line: number;
  reason: string;
  raw: Record<string, string>;
};

export type OrderCsvParseResult = {
  valid: OrderCsvRow[];
  invalid: OrderCsvInvalidRow[];
};

function parseCsvLine(line: string): string[] {
  return line.split(',').map((cell) => cell.trim());
}

export function parseOrderCsv(csvText: string, knownSkus: Set<string>): OrderCsvParseResult {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const valid: OrderCsvRow[] = [];
  const invalid: OrderCsvInvalidRow[] = [];

  if (lines.length === 0) return { valid, invalid };

  const headers = parseCsvLine(lines[0]);

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const raw: Record<string, string> = {};
    headers.forEach((header, index) => {
      raw[header] = cells[index] ?? '';
    });

    const lineNumber = i + 1;
    const sku = raw.sku || '';
    const quantity = Number(raw.quantity);
    const itemPriceLocal = Number(raw.item_price_local);
    const orderDate = raw.order_date || '';

    if (!sku) {
      invalid.push({ line: lineNumber, reason: 'Missing SKU', raw });
      continue;
    }
    if (!knownSkus.has(sku)) {
      invalid.push({ line: lineNumber, reason: `SKU not found: ${sku}`, raw });
      continue;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      invalid.push({ line: lineNumber, reason: 'Quantity must be a number greater than 0', raw });
      continue;
    }
    if (!Number.isFinite(itemPriceLocal) || itemPriceLocal <= 0) {
      invalid.push({ line: lineNumber, reason: 'Item price must be a number greater than 0', raw });
      continue;
    }
    if (!orderDate || Number.isNaN(new Date(orderDate).getTime())) {
      invalid.push({ line: lineNumber, reason: 'Invalid order date', raw });
      continue;
    }

    valid.push({
      order_date: orderDate,
      sales_platform: raw.sales_platform || 'eBay_DE',
      buyer_username: raw.buyer_username || '',
      sku,
      quantity,
      sale_currency: raw.sale_currency || 'EUR',
      item_price_local: itemPriceLocal,
      shipping_charged_local: Number(raw.shipping_charged_local) || 0,
      fulfillment_type: raw.fulfillment_type || 'Self',
      order_status: raw.order_status || 'New',
      notes: raw.notes || ''
    });
  }

  return { valid, invalid };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS (4 tests, plus the 3 from Task 2 = 7 total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/orderCsv.ts src/lib/orderCsv.test.ts
git commit -m "test: add order CSV parsing and validation"
```

---

### Task 9: CSV import page with preview

**Files:**
- Create: `src/app/(app)/orders/import/page.tsx`

**Interfaces:**
- Consumes: `parseOrderCsv` (Task 8), `calculateOrderPricing` (Task 2), `fetchSettings`.

- [ ] **Step 1: Create the page**

Create `src/app/(app)/orders/import/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/client';
import { fetchSettings } from '@/lib/settings';
import { calculateOrderPricing } from '@/lib/orderPricing';
import { parseOrderCsv, type OrderCsvInvalidRow, type OrderCsvRow } from '@/lib/orderCsv';
import type { Product, Settings } from '@/lib/types';

export default function ImportOrdersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [validRows, setValidRows] = useState<OrderCsvRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<OrderCsvInvalidRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [imported, setImported] = useState(0);

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const text = await file.text();
    const { data: products } = await supabase.from('products').select('sku');
    const knownSkus = new Set((products || []).map((p: { sku: string }) => p.sku));

    const result = parseOrderCsv(text, knownSkus);
    setValidRows(result.valid);
    setInvalidRows(result.invalid);
    setImported(0);
    setError('');
  }

  async function handleImport() {
    setImporting(true);
    setError('');

    const settings: Settings = await fetchSettings(supabase);
    const { data: productRows } = await supabase.from('products').select('*');
    const products = (productRows as Product[]) || [];
    let successCount = 0;

    for (const row of validRows) {
      const product = products.find((p) => p.sku === row.sku);
      if (!product) continue;

      const fxRate = settings.fxRates[row.sale_currency as keyof Settings['fxRates']] || 1;
      const pricing = calculateOrderPricing({
        fxRate,
        itemPriceLocal: row.item_price_local,
        shippingChargedLocal: row.shipping_charged_local,
        ebayFeePercent: product.ebay_fee_percent,
        paymentFeePercent: product.payment_fee_percent,
        fixedPaymentFeeEur: product.fixed_payment_fee_eur,
        productCostEur: product.total_cost_eur,
        shippingPackagingCostEur: 0
      });

      const orderId = `EB-${Date.now().toString(36).toUpperCase()}-${successCount}`;
      const vatAmountEur = settings.vatRegistered
        ? Math.round((pricing.grossSaleEur * settings.vatRatePercent / 100 + Number.EPSILON) * 100) / 100
        : null;

      const { error: insertError } = await supabase.from('orders').insert({
        order_id: orderId,
        order_date: row.order_date,
        sales_platform: row.sales_platform,
        buyer_username: row.buyer_username || null,
        sku: row.sku,
        product_name: product.product_name,
        condition: product.condition,
        quantity: row.quantity,
        sale_currency: row.sale_currency,
        fx_rate: fxRate,
        item_price_local: row.item_price_local,
        shipping_charged_local: row.shipping_charged_local,
        gross_sale_eur: pricing.grossSaleEur,
        fulfillment_type: row.fulfillment_type,
        order_status: row.order_status,
        ebay_fee_percent: product.ebay_fee_percent,
        ebay_fee_eur: pricing.ebayFeeEur,
        payment_fee_percent: product.payment_fee_percent,
        fixed_payment_fee_eur: product.fixed_payment_fee_eur,
        payment_fee_eur: pricing.paymentFeeEur,
        product_cost_eur: product.total_cost_eur,
        shipping_packaging_cost_eur: 0,
        total_order_cost_eur: pricing.totalOrderCostEur,
        net_profit_eur: pricing.netProfitEur,
        net_margin: pricing.netMargin,
        notes: row.notes || null
      });

      if (insertError) {
        console.error(`Failed to import row for SKU ${row.sku}:`, insertError.message);
        continue;
      }

      const { data: inventoryRow } = await supabase
        .from('inventory')
        .select('id, quantity_on_hand')
        .eq('sku', row.sku)
        .maybeSingle();

      if (inventoryRow) {
        await supabase
          .from('inventory')
          .update({ quantity_on_hand: inventoryRow.quantity_on_hand - row.quantity })
          .eq('id', inventoryRow.id);
      }

      await supabase.from('accounts').insert({
        tx_id: `ACC-${Date.now().toString(36).toUpperCase()}-${successCount}`,
        type: 'Sale',
        category: 'eBay Sales',
        amount_eur: pricing.grossSaleEur,
        direction: 'In',
        vat_rate_percent: settings.vatRegistered ? settings.vatRatePercent : null,
        vat_amount_eur: vatAmountEur,
        notes: `Auto: order ${orderId} (${row.sku}) — CSV import`
      });

      successCount++;
    }

    setImporting(false);
    setImported(successCount);

    if (successCount > 0) {
      router.push('/orders');
      router.refresh();
    }
  }

  return (
    <div>
      <PageHeader title="Import Orders" subtitle="Bulk-upload orders from a CSV file" />

      <div className="card p-5 grid gap-4">
        <p className="text-muted text-sm">
          Required columns: order_date, sales_platform, buyer_username, sku,
          quantity, sale_currency, item_price_local, shipping_charged_local,
          fulfillment_type, order_status, notes.
        </p>

        <input type="file" accept=".csv,text/csv" onChange={handleFileSelect} />

        {(validRows.length > 0 || invalidRows.length > 0) && (
          <div className="grid gap-2">
            <p className="text-sm font-semibold">
              {validRows.length} valid row(s), {invalidRows.length} invalid row(s)
            </p>

            {invalidRows.length > 0 && (
              <ul className="text-sm text-red list-disc pl-5">
                {invalidRows.map((row) => (
                  <li key={row.line}>
                    Line {row.line}: {row.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <p className="text-red font-semibold">{error}</p>}
        {imported > 0 && <p className="text-green font-semibold">Imported {imported} order(s).</p>}

        <div className="flex justify-end">
          <button
            type="button"
            className="btn-primary"
            disabled={validRows.length === 0 || importing}
            onClick={handleImport}
          >
            {importing ? 'Importing...' : `Import ${validRows.length} Valid Row(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manually verify**

Create a CSV file with the header row from the spec and 3 data rows (2
using an existing SKU, 1 using a made-up SKU). Upload it at
`/orders/import`. Confirm the preview shows "2 valid row(s), 1 invalid
row(s)" with the invalid line's reason, then click import and confirm
2 new orders appear at `/orders` with matching accounts/inventory
side-effects.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/orders/import/page.tsx"
git commit -m "feat(orders): add CSV bulk import with validation preview"
```

---

### Task 10: Inventory list page

**Files:**
- Create: `src/app/(app)/inventory/InventoryTable.tsx`
- Create: `src/app/(app)/inventory/page.tsx`

**Interfaces:**
- Consumes: `InventoryItem` type (`src/lib/types.ts:84-99`).

- [ ] **Step 1: Create the table component**

Create `src/app/(app)/inventory/InventoryTable.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { InventoryItem } from '@/lib/types';

function reorderAlert(item: InventoryItem): { label: string; className: string } {
  if (item.inventory_type === 'Dropship') {
    return { label: 'Supplier stock check', className: 'status-badge bg-slate-100 text-slate-600' };
  }

  const available = item.quantity_on_hand - item.quantity_reserved;

  return available <= item.reorder_level
    ? { label: 'REORDER', className: 'status-badge bg-[#fee2e2] text-[#991b1b]' }
    : { label: 'OK', className: 'status-badge bg-[#dcfce7] text-[#166534]' };
}

export default function InventoryTable({ items }: { items: InventoryItem[] }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) =>
      [item.sku, item.product_name, item.variant, item.location_bin]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [items, search]);

  return (
    <div>
      <input
        className="field-input sm:max-w-[420px] mb-4"
        placeholder="Search SKU, product name, bin..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
                <th className="p-3">SKU</th>
                <th className="p-3">Product</th>
                <th className="p-3">Type</th>
                <th className="p-3">On Hand</th>
                <th className="p-3">Reserved</th>
                <th className="p-3">Available</th>
                <th className="p-3">Alert</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted p-5">
                    No inventory records found.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const alert = reorderAlert(item);
                  const available =
                    item.inventory_type === 'Dropship'
                      ? 'N/A'
                      : String(item.quantity_on_hand - item.quantity_reserved);

                  return (
                    <tr key={item.id} className="border-b border-border">
                      <td className="p-3">{item.sku}</td>
                      <td className="p-3">{item.product_name}</td>
                      <td className="p-3">{item.inventory_type}</td>
                      <td className="p-3">{item.quantity_on_hand}</td>
                      <td className="p-3">{item.quantity_reserved}</td>
                      <td className="p-3">{available}</td>
                      <td className="p-3">
                        <span className={alert.className}>{alert.label}</span>
                      </td>
                      <td className="p-3">
                        <Link
                          href={`/inventory/${item.id}/edit`}
                          className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the page**

Create `src/app/(app)/inventory/page.tsx`:

```tsx
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { InventoryItem } from '@/lib/types';
import InventoryTable from './InventoryTable';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from('inventory')
    .select('*')
    .order('product_name', { ascending: true });

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Stock levels, reorder alerts, and locations"
        actions={
          <Link href="/inventory/new" className="btn-primary">
            + Add Inventory Item
          </Link>
        }
      />

      <InventoryTable items={(items as InventoryItem[]) || []} />
    </div>
  );
}
```

- [ ] **Step 3: Manually verify**

Visit `/inventory`. Expected: the auto-created row from Task 3's dummy
product appears with `On Hand`, `Reserved`, `Available` all showing, and
an `OK` or `REORDER` badge depending on `reorder_level`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/inventory/InventoryTable.tsx" "src/app/(app)/inventory/page.tsx"
git commit -m "feat(inventory): add inventory list page with reorder alerts"
```

---

### Task 11: Inventory create/edit form

**Files:**
- Create: `src/app/(app)/inventory/InventoryForm.tsx`
- Create: `src/app/(app)/inventory/new/page.tsx`
- Create: `src/app/(app)/inventory/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `InventoryItem`, `Product` types.

- [ ] **Step 1: Create the form component**

Create `src/app/(app)/inventory/InventoryForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { InventoryItem, Product } from '@/lib/types';

type FormState = {
  sku: string;
  variant: string;
  inventoryType: 'On Hand' | 'Dropship' | 'Virtual';
  locationBin: string;
  quantityOnHand: string;
  quantityReserved: string;
  reorderLevel: string;
  leadTimeDays: string;
  lastRestockDate: string;
  notes: string;
};

function initialState(item?: InventoryItem): FormState {
  return {
    sku: item?.sku || '',
    variant: item?.variant || '',
    inventoryType: item?.inventory_type || 'On Hand',
    locationBin: item?.location_bin || '',
    quantityOnHand: String(item?.quantity_on_hand ?? 0),
    quantityReserved: String(item?.quantity_reserved ?? 0),
    reorderLevel: String(item?.reorder_level ?? 0),
    leadTimeDays: String(item?.lead_time_days ?? ''),
    lastRestockDate: item?.last_restock_date || '',
    notes: item?.notes || ''
  };
}

function num(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function InventoryForm({
  item,
  products
}: {
  item?: InventoryItem;
  products: Product[];
}) {
  const isEditing = !!item;
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<FormState>(() => initialState(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const product = products.find((p) => p.sku === form.sku);

    const payload = {
      sku: form.sku,
      product_name: product?.product_name || item?.product_name || '',
      variant: form.variant || null,
      inventory_type: form.inventoryType,
      location_bin: form.locationBin || null,
      quantity_on_hand: num(form.quantityOnHand),
      quantity_reserved: num(form.quantityReserved),
      reorder_level: num(form.reorderLevel),
      supplier_name: product?.supplier_name || null,
      supplier_link: product?.supplier_link || null,
      lead_time_days: num(form.leadTimeDays),
      last_restock_date: form.lastRestockDate || null,
      notes: form.notes || null
    };

    const { error: saveError } = isEditing
      ? await supabase.from('inventory').update(payload).eq('id', item!.id)
      : await supabase.from('inventory').insert(payload);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    router.push('/inventory');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 grid gap-3.5">
      <div className="grid sm:grid-cols-2 gap-3.5">
        <label className="field-label">
          SKU *
          <select
            className="field-input"
            required
            value={form.sku}
            onChange={(e) => setField('sku', e.target.value)}
            disabled={isEditing}
          >
            <option value="">Select a product</option>
            {products.map((product) => (
              <option key={product.sku} value={product.sku}>
                {product.sku} — {product.product_name}
              </option>
            ))}
          </select>
        </label>

        <label className="field-label">
          Variant
          <input
            className="field-input"
            value={form.variant}
            onChange={(e) => setField('variant', e.target.value)}
          />
        </label>

        <label className="field-label">
          Inventory Type *
          <select
            className="field-input"
            value={form.inventoryType}
            onChange={(e) => setField('inventoryType', e.target.value as FormState['inventoryType'])}
          >
            <option value="On Hand">On Hand</option>
            <option value="Dropship">Dropship</option>
            <option value="Virtual">Virtual</option>
          </select>
        </label>

        <label className="field-label">
          Location / Bin
          <input
            className="field-input"
            value={form.locationBin}
            onChange={(e) => setField('locationBin', e.target.value)}
          />
        </label>

        <label className="field-label">
          Quantity On Hand
          <input
            className="field-input"
            type="number"
            min="0"
            value={form.quantityOnHand}
            onChange={(e) => setField('quantityOnHand', e.target.value)}
          />
        </label>

        <label className="field-label">
          Quantity Reserved
          <input
            className="field-input"
            type="number"
            min="0"
            value={form.quantityReserved}
            onChange={(e) => setField('quantityReserved', e.target.value)}
          />
        </label>

        <label className="field-label">
          Reorder Level
          <input
            className="field-input"
            type="number"
            min="0"
            value={form.reorderLevel}
            onChange={(e) => setField('reorderLevel', e.target.value)}
          />
        </label>

        <label className="field-label">
          Lead Time (days)
          <input
            className="field-input"
            type="number"
            min="0"
            value={form.leadTimeDays}
            onChange={(e) => setField('leadTimeDays', e.target.value)}
          />
        </label>

        <label className="field-label">
          Last Restock Date
          <input
            className="field-input"
            type="date"
            value={form.lastRestockDate}
            onChange={(e) => setField('lastRestockDate', e.target.value)}
          />
        </label>

        <label className="field-label sm:col-span-2">
          Notes
          <textarea
            className="field-input"
            rows={3}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </label>
      </div>

      {error && <p className="text-red font-semibold">{error}</p>}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : isEditing ? 'Update Inventory Item' : 'Save Inventory Item'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create the new-item page**

Create `src/app/(app)/inventory/new/page.tsx`:

```tsx
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';
import InventoryForm from '../InventoryForm';

export default async function NewInventoryItemPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('product_name', { ascending: true });

  return (
    <div>
      <PageHeader title="Add Inventory Item" subtitle="Track stock for a product" />
      <InventoryForm products={(products as Product[]) || []} />
    </div>
  );
}
```

- [ ] **Step 3: Create the edit page**

Create `src/app/(app)/inventory/[id]/edit/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { InventoryItem, Product } from '@/lib/types';
import InventoryForm from '../../InventoryForm';

export default async function EditInventoryItemPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: item }, { data: products }] = await Promise.all([
    supabase.from('inventory').select('*').eq('id', id).maybeSingle(),
    supabase.from('products').select('*').order('product_name', { ascending: true })
  ]);

  if (!item) notFound();

  return (
    <div>
      <PageHeader title={`Edit Inventory — ${item.sku}`} subtitle={item.product_name} />
      <InventoryForm item={item as InventoryItem} products={(products as Product[]) || []} />
    </div>
  );
}
```

- [ ] **Step 4: Manually verify**

Visit `/inventory/new`, pick the dummy product's SKU, set quantity and
reorder level, save — confirm it appears at `/inventory`. Then edit it
from `/inventory/[id]/edit`, change the quantity, save, confirm the
update sticks.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/inventory/InventoryForm.tsx" "src/app/(app)/inventory/new/page.tsx" "src/app/(app)/inventory/[id]/edit/page.tsx"
git commit -m "feat(inventory): add inventory create/edit form"
```

---

### Task 12: Extend Settings type and fetchSettings with VAT fields

**Files:**
- Modify: `src/lib/types.ts:145-151` (`Settings` type)
- Modify: `src/lib/settings.ts`
- Test: `src/lib/settings.test.ts`

**Interfaces:**
- Produces: `Settings.vatRegistered: boolean`, `Settings.vatRatePercent: number`; `mapSettingsRows(rows: { key: string; value: number }[]): Settings` (new pure export, used by `fetchSettings` and tested directly).

- [ ] **Step 1: Update the `Settings` type**

In `src/lib/types.ts`, change:

```ts
export type Settings = {
  fxRates: { EUR: number; USD: number; PKR: number };
  ebayFeePercent: number;
  paymentFeePercent: number;
  fixedPaymentFeeEur: number;
};
```

to:

```ts
export type Settings = {
  fxRates: { EUR: number; USD: number; PKR: number };
  ebayFeePercent: number;
  paymentFeePercent: number;
  fixedPaymentFeeEur: number;
  vatRegistered: boolean;
  vatRatePercent: number;
};
```

- [ ] **Step 2: Write the failing test for the pure mapping function**

Create `src/lib/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mapSettingsRows } from './settings';

describe('mapSettingsRows', () => {
  it('maps known keys and applies defaults for missing ones', () => {
    const result = mapSettingsRows([
      { key: 'fx_usd', value: 1.1 },
      { key: 'vat_registered', value: 1 },
      { key: 'vat_rate_percent', value: 7 }
    ]);

    expect(result.fxRates).toEqual({ EUR: 1, USD: 1.1, PKR: 310 });
    expect(result.vatRegistered).toBe(true);
    expect(result.vatRatePercent).toBe(7);
  });

  it('defaults vatRegistered to false and vatRatePercent to 19 when absent', () => {
    const result = mapSettingsRows([]);

    expect(result.vatRegistered).toBe(false);
    expect(result.vatRatePercent).toBe(19);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `mapSettingsRows is not exported from './settings'`.

- [ ] **Step 4: Refactor `settings.ts` to add and export the pure function**

Replace the full contents of `src/lib/settings.ts` with:

```ts
import { SupabaseClient } from '@supabase/supabase-js';
import type { Settings } from './types';

const DEFAULT_SETTINGS: Settings = {
  fxRates: { EUR: 1, USD: 1.08, PKR: 310 },
  ebayFeePercent: 0.129,
  paymentFeePercent: 0.029,
  fixedPaymentFeeEur: 0.35,
  vatRegistered: false,
  vatRatePercent: 19
};

export function mapSettingsRows(rows: { key: string; value: number }[]): Settings {
  const byKey = Object.fromEntries(rows.map((row) => [row.key, Number(row.value)]));

  return {
    fxRates: {
      EUR: 1,
      USD: byKey.fx_usd ?? DEFAULT_SETTINGS.fxRates.USD,
      PKR: byKey.fx_pkr ?? DEFAULT_SETTINGS.fxRates.PKR
    },
    ebayFeePercent: byKey.ebay_fee_percent ?? DEFAULT_SETTINGS.ebayFeePercent,
    paymentFeePercent: byKey.payment_fee_percent ?? DEFAULT_SETTINGS.paymentFeePercent,
    fixedPaymentFeeEur: byKey.fixed_payment_fee_eur ?? DEFAULT_SETTINGS.fixedPaymentFeeEur,
    vatRegistered: (byKey.vat_registered ?? 0) === 1,
    vatRatePercent: byKey.vat_rate_percent ?? DEFAULT_SETTINGS.vatRatePercent
  };
}

export async function fetchSettings(supabase: SupabaseClient): Promise<Settings> {
  const { data } = await supabase.from('settings').select('key, value');

  if (!data) return DEFAULT_SETTINGS;

  return mapSettingsRows(data as { key: string; value: number }[]);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS (2 new tests, plus all prior tests still passing).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/settings.ts src/lib/settings.test.ts
git commit -m "feat(settings): add VAT registered flag and VAT rate to Settings"
```

---

### Task 13: Settings page and Sidebar nav link

**Files:**
- Create: `src/app/(app)/settings/SettingsForm.tsx`
- Create: `src/app/(app)/settings/page.tsx`
- Modify: `src/components/Sidebar.tsx:7-16`

**Interfaces:**
- Consumes: `mapSettingsRows`/`fetchSettings`, `Settings` type.

- [ ] **Step 1: Create the settings form**

Create `src/app/(app)/settings/SettingsForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Settings } from '@/lib/types';

export default function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const supabase = createClient();

  const [fxUsd, setFxUsd] = useState(String(settings.fxRates.USD));
  const [fxPkr, setFxPkr] = useState(String(settings.fxRates.PKR));
  const [ebayFeePercent, setEbayFeePercent] = useState(String(settings.ebayFeePercent));
  const [paymentFeePercent, setPaymentFeePercent] = useState(String(settings.paymentFeePercent));
  const [fixedPaymentFeeEur, setFixedPaymentFeeEur] = useState(String(settings.fixedPaymentFeeEur));
  const [vatRegistered, setVatRegistered] = useState(settings.vatRegistered);
  const [vatRatePercent, setVatRatePercent] = useState(String(settings.vatRatePercent));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function num(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);

    const rows = [
      { key: 'fx_usd', value: num(fxUsd) },
      { key: 'fx_pkr', value: num(fxPkr) },
      { key: 'ebay_fee_percent', value: num(ebayFeePercent) },
      { key: 'payment_fee_percent', value: num(paymentFeePercent) },
      { key: 'fixed_payment_fee_eur', value: num(fixedPaymentFeeEur) },
      { key: 'vat_registered', value: vatRegistered ? 1 : 0 },
      { key: 'vat_rate_percent', value: num(vatRatePercent) }
    ];

    const { error: saveError } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 grid gap-3.5 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-3.5">
        <label className="field-label">
          USD to EUR Rate
          <input
            className="field-input"
            type="number"
            step="0.0001"
            value={fxUsd}
            onChange={(e) => setFxUsd(e.target.value)}
          />
        </label>

        <label className="field-label">
          PKR to EUR Rate
          <input
            className="field-input"
            type="number"
            step="0.0001"
            value={fxPkr}
            onChange={(e) => setFxPkr(e.target.value)}
          />
        </label>

        <label className="field-label">
          eBay Fee %
          <input
            className="field-input"
            type="number"
            step="0.001"
            value={ebayFeePercent}
            onChange={(e) => setEbayFeePercent(e.target.value)}
          />
        </label>

        <label className="field-label">
          Payment Fee %
          <input
            className="field-input"
            type="number"
            step="0.001"
            value={paymentFeePercent}
            onChange={(e) => setPaymentFeePercent(e.target.value)}
          />
        </label>

        <label className="field-label">
          Fixed Payment Fee (EUR)
          <input
            className="field-input"
            type="number"
            step="0.01"
            value={fixedPaymentFeeEur}
            onChange={(e) => setFixedPaymentFeeEur(e.target.value)}
          />
        </label>
      </div>

      <div className="border-t border-border pt-3.5 grid sm:grid-cols-2 gap-3.5">
        <label className="field-label flex-row items-center gap-2 flex">
          <input
            type="checkbox"
            checked={vatRegistered}
            onChange={(e) => setVatRegistered(e.target.checked)}
          />
          VAT Registered (Regelbesteuerung)
        </label>

        {vatRegistered && (
          <label className="field-label">
            VAT Rate %
            <input
              className="field-input"
              type="number"
              step="0.01"
              value={vatRatePercent}
              onChange={(e) => setVatRatePercent(e.target.value)}
            />
          </label>
        )}
      </div>

      <p className="text-muted text-[13px] -mt-1">
        Leave VAT Registered unchecked if operating as a Kleinunternehmer
        (§19 UStG) — no VAT fields will appear on Accounts entries.
      </p>

      {error && <p className="text-red font-semibold">{error}</p>}
      {saved && <p className="text-green font-semibold">Settings saved.</p>}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create the page**

Create `src/app/(app)/settings/page.tsx`:

```tsx
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import { mapSettingsRows } from '@/lib/settings';
import SettingsForm from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('settings').select('key, value');

  const settings = mapSettingsRows((data as { key: string; value: number }[]) || []);

  return (
    <div>
      <PageHeader title="Settings" subtitle="FX rates, platform fees, and VAT mode" />
      <SettingsForm settings={settings} />
    </div>
  );
}
```

- [ ] **Step 3: Add the Settings link to the sidebar**

In `src/components/Sidebar.tsx`, change the `NAV_ITEMS` array:

```tsx
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/products', label: 'Products', icon: '◫' },
  { href: '/products/new', label: 'Add Product', icon: '＋' },
  { href: '/orders', label: 'Orders', icon: '▤' },
  { href: '/research', label: 'Product Research', icon: '⌕' },
  { href: '/inventory', label: 'Inventory', icon: '▣' },
  { href: '/accounts', label: 'Accounts', icon: '$' },
  { href: '/returns', label: 'Returns', icon: '↩' },
  { href: '/settings', label: 'Settings', icon: '⚙' }
];
```

- [ ] **Step 4: Manually verify**

Visit `/settings`, toggle "VAT Registered" on, set a rate, save. Reload
the page — confirm the checkbox and rate persist (i.e., they were
written to the `settings` table and read back correctly).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/settings/SettingsForm.tsx" "src/app/(app)/settings/page.tsx" src/components/Sidebar.tsx
git commit -m "feat(settings): add settings page with FX/fee/VAT controls"
```

---

### Task 14: VAT calculation and ledger summary helpers

**Files:**
- Create: `src/lib/vat.ts`
- Test: `src/lib/vat.test.ts`

**Interfaces:**
- Produces: `calculateVatAmount(amountEur: number, vatRatePercent: number): number`, `summarizeVat(rows: { direction: 'In' | 'Out'; vat_amount_eur: number | null }[]): { vatCollectedEur: number; vatPaidEur: number; vatPayableEur: number }` — consumed by `AccountsForm`/`AccountsTable` (Tasks 15-16).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/vat.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateVatAmount, summarizeVat } from './vat';

describe('calculateVatAmount', () => {
  it('computes VAT from a gross amount and rate', () => {
    expect(calculateVatAmount(119, 19)).toBe(22.61);
  });

  it('returns 0 for a 0 amount', () => {
    expect(calculateVatAmount(0, 19)).toBe(0);
  });
});

describe('summarizeVat', () => {
  it('sums collected (In) and paid (Out) VAT separately and computes payable', () => {
    const summary = summarizeVat([
      { direction: 'In', vat_amount_eur: 20 },
      { direction: 'In', vat_amount_eur: 5 },
      { direction: 'Out', vat_amount_eur: 8 },
      { direction: 'Out', vat_amount_eur: null }
    ]);

    expect(summary.vatCollectedEur).toBe(25);
    expect(summary.vatPaidEur).toBe(8);
    expect(summary.vatPayableEur).toBe(17);
  });

  it('returns zeros for an empty ledger', () => {
    const summary = summarizeVat([]);

    expect(summary).toEqual({ vatCollectedEur: 0, vatPaidEur: 0, vatPayableEur: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './vat'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/vat.ts`:

```ts
function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateVatAmount(amountEur: number, vatRatePercent: number): number {
  return round2((amountEur * vatRatePercent) / 100);
}

export type VatLedgerRow = {
  direction: 'In' | 'Out';
  vat_amount_eur: number | null;
};

export type VatSummary = {
  vatCollectedEur: number;
  vatPaidEur: number;
  vatPayableEur: number;
};

export function summarizeVat(rows: VatLedgerRow[]): VatSummary {
  const vatCollectedEur = rows
    .filter((row) => row.direction === 'In')
    .reduce((sum, row) => sum + Number(row.vat_amount_eur || 0), 0);
  const vatPaidEur = rows
    .filter((row) => row.direction === 'Out')
    .reduce((sum, row) => sum + Number(row.vat_amount_eur || 0), 0);

  return {
    vatCollectedEur: round2(vatCollectedEur),
    vatPaidEur: round2(vatPaidEur),
    vatPayableEur: round2(vatCollectedEur - vatPaidEur)
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/vat.ts src/lib/vat.test.ts
git commit -m "test: add VAT amount and ledger summary calculations"
```

---

### Task 15: Extend `AccountTx` type; Accounts list page with VAT summary

**Files:**
- Modify: `src/lib/types.ts:101-109` (`AccountTx` type)
- Create: `src/app/(app)/accounts/AccountsTable.tsx`
- Create: `src/app/(app)/accounts/page.tsx`

**Interfaces:**
- Consumes: `summarizeVat` (Task 14), `fetchSettings`.

- [ ] **Step 1: Update the `AccountTx` type**

In `src/lib/types.ts`, change:

```ts
export type AccountTx = {
  tx_id: string;
  tx_date: string;
  type: string;
  category: string;
  amount_eur: number;
  direction: 'In' | 'Out';
  notes: string | null;
};
```

to:

```ts
export type AccountTx = {
  tx_id: string;
  tx_date: string;
  type: string;
  category: string;
  amount_eur: number;
  direction: 'In' | 'Out';
  vat_rate_percent: number | null;
  vat_amount_eur: number | null;
  notes: string | null;
};
```

- [ ] **Step 2: Create the table component**

Create `src/app/(app)/accounts/AccountsTable.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDate, formatMoney } from '@/lib/format';
import { summarizeVat } from '@/lib/vat';
import type { AccountTx } from '@/lib/types';

export default function AccountsTable({
  transactions,
  vatRegistered
}: {
  transactions: AccountTx[];
  vatRegistered: boolean;
}) {
  const [directionFilter, setDirectionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (directionFilter && tx.direction !== directionFilter) return false;
      if (typeFilter && tx.type !== typeFilter) return false;
      return true;
    });
  }, [transactions, directionFilter, typeFilter]);

  const totals = useMemo(() => {
    const totalIn = filtered
      .filter((tx) => tx.direction === 'In')
      .reduce((sum, tx) => sum + Number(tx.amount_eur || 0), 0);
    const totalOut = filtered
      .filter((tx) => tx.direction === 'Out')
      .reduce((sum, tx) => sum + Number(tx.amount_eur || 0), 0);

    return { totalIn, totalOut, net: totalIn - totalOut };
  }, [filtered]);

  const vatSummary = useMemo(() => summarizeVat(filtered), [filtered]);

  const types = useMemo(
    () => Array.from(new Set(transactions.map((tx) => tx.type))).sort(),
    [transactions]
  );

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
        <SummaryCard label="Total In" value={formatMoney(totals.totalIn)} tone="text-green" />
        <SummaryCard label="Total Out" value={formatMoney(totals.totalOut)} tone="text-red" />
        <SummaryCard
          label="Net"
          value={formatMoney(totals.net)}
          tone={totals.net < 0 ? 'text-red' : 'text-green'}
        />
      </div>

      {vatRegistered && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
          <SummaryCard label="VAT Collected" value={formatMoney(vatSummary.vatCollectedEur)} />
          <SummaryCard label="VAT Paid" value={formatMoney(vatSummary.vatPaidEur)} />
          <SummaryCard
            label="VAT Payable"
            value={formatMoney(vatSummary.vatPayableEur)}
            tone={vatSummary.vatPayableEur < 0 ? 'text-red' : ''}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2.5 mb-4">
        <select
          className="field-input w-auto min-w-[150px]"
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value)}
        >
          <option value="">All Directions</option>
          <option value="In">In</option>
          <option value="Out">Out</option>
        </select>

        <select
          className="field-input w-auto min-w-[150px]"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
                <th className="p-3">Date</th>
                <th className="p-3">Type</th>
                <th className="p-3">Category</th>
                <th className="p-3">Amount</th>
                {vatRegistered && <th className="p-3">VAT</th>}
                <th className="p-3">Direction</th>
                <th className="p-3">Notes</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={vatRegistered ? 8 : 7} className="text-center text-muted p-5">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                  <tr key={tx.tx_id} className="border-b border-border">
                    <td className="p-3">{formatDate(tx.tx_date)}</td>
                    <td className="p-3">{tx.type}</td>
                    <td className="p-3">{tx.category}</td>
                    <td className={`p-3 ${tx.direction === 'In' ? 'text-green' : 'text-red'}`}>
                      {formatMoney(tx.amount_eur)}
                    </td>
                    {vatRegistered && (
                      <td className="p-3">
                        {tx.vat_amount_eur != null ? formatMoney(tx.vat_amount_eur) : '—'}
                      </td>
                    )}
                    <td className="p-3">{tx.direction}</td>
                    <td className="p-3">{tx.notes || '—'}</td>
                    <td className="p-3">
                      <Link
                        href={`/accounts/${tx.tx_id}/edit`}
                        className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <span className="text-[11px] uppercase text-muted font-bold">{label}</span>
      <strong className={`text-lg ${tone || ''}`}>{value}</strong>
    </div>
  );
}
```

- [ ] **Step 3: Create the page**

Create `src/app/(app)/accounts/page.tsx`:

```tsx
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import { mapSettingsRows } from '@/lib/settings';
import type { AccountTx } from '@/lib/types';
import AccountsTable from './AccountsTable';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const supabase = await createClient();

  const [{ data: transactions }, { data: settingsRows }] = await Promise.all([
    supabase.from('accounts').select('*').order('tx_date', { ascending: false }),
    supabase.from('settings').select('key, value')
  ]);

  const settings = mapSettingsRows((settingsRows as { key: string; value: number }[]) || []);

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="Income and expense ledger"
        actions={
          <Link href="/accounts/new" className="btn-primary">
            + Add Transaction
          </Link>
        }
      />

      <AccountsTable
        transactions={(transactions as AccountTx[]) || []}
        vatRegistered={settings.vatRegistered}
      />
    </div>
  );
}
```

- [ ] **Step 4: Manually verify**

Visit `/accounts`. Expected: the auto-created "Purchase" and "Sale" rows
from earlier tasks appear, Total In/Out/Net compute correctly. With VAT
mode off (default), no VAT column/summary shows.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts "src/app/(app)/accounts/AccountsTable.tsx" "src/app/(app)/accounts/page.tsx"
git commit -m "feat(accounts): add ledger list page with VAT summary"
```

---

### Task 16: Accounts create/edit form (VAT-aware)

**Files:**
- Create: `src/app/(app)/accounts/AccountsForm.tsx`
- Create: `src/app/(app)/accounts/new/page.tsx`
- Create: `src/app/(app)/accounts/[txId]/edit/page.tsx`

**Interfaces:**
- Consumes: `calculateVatAmount` (Task 14), `fetchSettings`.

- [ ] **Step 1: Create the form component**

Create `src/app/(app)/accounts/AccountsForm.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchSettings } from '@/lib/settings';
import { calculateVatAmount } from '@/lib/vat';
import { formatMoney } from '@/lib/format';
import type { AccountTx, Settings } from '@/lib/types';

type FormState = {
  txDate: string;
  type: string;
  category: string;
  amountEur: string;
  direction: 'In' | 'Out';
  vatRatePercent: string;
  notes: string;
};

function initialState(tx?: AccountTx, defaultVatRate?: number): FormState {
  return {
    txDate: tx?.tx_date || new Date().toISOString().slice(0, 10),
    type: tx?.type || '',
    category: tx?.category || '',
    amountEur: String(tx?.amount_eur ?? ''),
    direction: tx?.direction || 'Out',
    vatRatePercent: String(tx?.vat_rate_percent ?? defaultVatRate ?? 19),
    notes: tx?.notes || ''
  };
}

function num(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function AccountsForm({ tx }: { tx?: AccountTx }) {
  const isEditing = !!tx;
  const router = useRouter();
  const supabase = createClient();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<FormState>(() => initialState(tx));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings(supabase).then((loaded) => {
      setSettings(loaded);
      setForm((prev) => (tx ? prev : { ...prev, vatRatePercent: String(loaded.vatRatePercent) }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const vatAmountEur = useMemo(
    () => (settings?.vatRegistered ? calculateVatAmount(num(form.amountEur), num(form.vatRatePercent)) : null),
    [settings, form.amountEur, form.vatRatePercent]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const txId = tx?.tx_id || `ACC-${Date.now().toString(36).toUpperCase()}`;

    const payload = {
      tx_id: txId,
      tx_date: form.txDate,
      type: form.type,
      category: form.category,
      amount_eur: num(form.amountEur),
      direction: form.direction,
      vat_rate_percent: settings?.vatRegistered ? num(form.vatRatePercent) : null,
      vat_amount_eur: vatAmountEur,
      notes: form.notes || null
    };

    const { error: saveError } = isEditing
      ? await supabase.from('accounts').update(payload).eq('tx_id', txId)
      : await supabase.from('accounts').insert(payload);

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    router.push('/accounts');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 grid gap-3.5 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-3.5">
        <label className="field-label">
          Date *
          <input
            className="field-input"
            type="date"
            required
            value={form.txDate}
            onChange={(e) => setField('txDate', e.target.value)}
          />
        </label>

        <label className="field-label">
          Direction *
          <select
            className="field-input"
            value={form.direction}
            onChange={(e) => setField('direction', e.target.value as FormState['direction'])}
          >
            <option value="In">In (Income)</option>
            <option value="Out">Out (Expense)</option>
          </select>
        </label>

        <label className="field-label">
          Type *
          <input
            className="field-input"
            required
            placeholder="Sale, Purchase, Refund, Fee..."
            value={form.type}
            onChange={(e) => setField('type', e.target.value)}
          />
        </label>

        <label className="field-label">
          Category *
          <input
            className="field-input"
            required
            placeholder="eBay Sales, Inventory, Returns..."
            value={form.category}
            onChange={(e) => setField('category', e.target.value)}
          />
        </label>

        <label className="field-label">
          Amount (EUR) *
          <input
            className="field-input"
            type="number"
            min="0"
            step="0.01"
            required
            value={form.amountEur}
            onChange={(e) => setField('amountEur', e.target.value)}
          />
        </label>

        {settings?.vatRegistered && (
          <label className="field-label">
            VAT Rate %
            <input
              className="field-input"
              type="number"
              step="0.01"
              value={form.vatRatePercent}
              onChange={(e) => setField('vatRatePercent', e.target.value)}
            />
          </label>
        )}

        <label className="field-label sm:col-span-2">
          Notes
          <textarea
            className="field-input"
            rows={3}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </label>
      </div>

      {settings?.vatRegistered && vatAmountEur != null && (
        <p className="text-muted text-sm">VAT amount: {formatMoney(vatAmountEur)}</p>
      )}

      {error && <p className="text-red font-semibold">{error}</p>}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : isEditing ? 'Update Transaction' : 'Save Transaction'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create the new-transaction page**

Create `src/app/(app)/accounts/new/page.tsx`:

```tsx
import PageHeader from '@/components/PageHeader';
import AccountsForm from '../AccountsForm';

export default function NewAccountsTxPage() {
  return (
    <div>
      <PageHeader title="Add Transaction" subtitle="Record a manual income or expense" />
      <AccountsForm />
    </div>
  );
}
```

- [ ] **Step 3: Create the edit page**

Create `src/app/(app)/accounts/[txId]/edit/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { AccountTx } from '@/lib/types';
import AccountsForm from '../../AccountsForm';

export default async function EditAccountsTxPage({
  params
}: {
  params: Promise<{ txId: string }>;
}) {
  const { txId } = await params;
  const supabase = await createClient();
  const { data: tx } = await supabase.from('accounts').select('*').eq('tx_id', txId).maybeSingle();

  if (!tx) notFound();

  return (
    <div>
      <PageHeader title={`Edit Transaction — ${tx.tx_id}`} subtitle={tx.category} />
      <AccountsForm tx={tx as AccountTx} />
    </div>
  );
}
```

- [ ] **Step 4: Manually verify**

With VAT mode off, add a manual transaction — confirm no VAT field
shown and it saves fine. Go to `/settings`, turn VAT mode on, come back
to `/accounts/new` — confirm the VAT Rate field now appears and the VAT
amount preview updates as you type the amount.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/accounts/AccountsForm.tsx" "src/app/(app)/accounts/new/page.tsx" "src/app/(app)/accounts/[txId]/edit/page.tsx"
git commit -m "feat(accounts): add VAT-aware transaction create/edit form"
```

---

### Task 17: Wire VAT into the existing Product purchase auto-entry

**Files:**
- Modify: `src/app/(app)/products/ProductForm.tsx:319-328`

**Interfaces:**
- Consumes: `fetchSettings` (already imported in this file), `calculateVatAmount` (Task 14).

- [ ] **Step 1: Import the VAT helper**

At the top of `src/app/(app)/products/ProductForm.tsx`, add to the
existing imports:

```tsx
import { calculateVatAmount } from '@/lib/vat';
```

- [ ] **Step 2: Populate VAT fields on the auto purchase-cost entry**

Change:

```tsx
    if (!isEditing && pricing.totalCostEur > 0) {
      await supabase.from('accounts').insert({
        tx_id: `ACC-${Date.now().toString(36).toUpperCase()}`,
        type: 'Purchase',
        category: 'Inventory',
        amount_eur: pricing.totalCostEur,
        direction: 'Out',
        notes: `Auto: purchase cost for ${sku} (${form.productName})`
      });
    }
```

to:

```tsx
    if (!isEditing && pricing.totalCostEur > 0) {
      await supabase.from('accounts').insert({
        tx_id: `ACC-${Date.now().toString(36).toUpperCase()}`,
        type: 'Purchase',
        category: 'Inventory',
        amount_eur: pricing.totalCostEur,
        direction: 'Out',
        vat_rate_percent: settings.vatRegistered ? settings.vatRatePercent : null,
        vat_amount_eur: settings.vatRegistered
          ? calculateVatAmount(pricing.totalCostEur, settings.vatRatePercent)
          : null,
        notes: `Auto: purchase cost for ${sku} (${form.productName})`
      });
    }
```

Since `settings` in this component already comes from `fetchSettings`
(`ProductForm.tsx:139-144,161-164`), it already carries `vatRegistered`
and `vatRatePercent` once Task 12 lands — no additional fetch needed.

- [ ] **Step 3: Manually verify**

With VAT mode on (`/settings`), create a new product with a non-zero
cost. Check `/accounts` — the auto "Purchase" row should show a VAT
amount in the VAT column.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/products/ProductForm.tsx"
git commit -m "feat(products): populate VAT fields on auto purchase-cost accounts entry"
```

---

### Task 18: Returns list page

**Files:**
- Create: `src/app/(app)/returns/ReturnsTable.tsx`
- Create: `src/app/(app)/returns/page.tsx`

**Interfaces:**
- Consumes: `ReturnCase` type (`src/lib/types.ts:111-120`).

- [ ] **Step 1: Create the table component**

Create `src/app/(app)/returns/ReturnsTable.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { formatDate, formatMoney, statusClassName } from '@/lib/format';
import type { ReturnCase } from '@/lib/types';

export default function ReturnsTable({ cases }: { cases: ReturnCase[] }) {
  if (cases.length === 0) {
    return <div className="card p-6 text-center text-muted">No return cases yet.</div>;
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
              <th className="p-3">Case ID</th>
              <th className="p-3">Order ID</th>
              <th className="p-3">Date</th>
              <th className="p-3">Reason</th>
              <th className="p-3">Refund</th>
              <th className="p-3">Net Loss</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((item) => (
              <tr key={item.case_id} className="border-b border-border">
                <td className="p-3">{item.case_id}</td>
                <td className="p-3">{item.order_id || '—'}</td>
                <td className="p-3">{formatDate(item.case_date)}</td>
                <td className="p-3">{item.reason}</td>
                <td className="p-3">{formatMoney(item.refund_eur)}</td>
                <td className="p-3">{formatMoney(item.net_loss_eur)}</td>
                <td className="p-3">
                  <span className={statusClassName(item.status)}>{item.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the page**

Create `src/app/(app)/returns/page.tsx`:

```tsx
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { ReturnCase } from '@/lib/types';
import ReturnsTable from './ReturnsTable';

export const dynamic = 'force-dynamic';

export default async function ReturnsPage() {
  const supabase = await createClient();
  const { data: cases } = await supabase
    .from('returns_cases')
    .select('*')
    .order('case_date', { ascending: false });

  return (
    <div>
      <PageHeader
        title="Returns"
        subtitle="Track return cases and refunds"
        actions={
          <Link href="/returns/new" className="btn-primary">
            + Add Return
          </Link>
        }
      />

      <ReturnsTable cases={(cases as ReturnCase[]) || []} />
    </div>
  );
}
```

- [ ] **Step 3: Manually verify**

Visit `/returns`. Expected: page loads, "No return cases yet." shown.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/returns/ReturnsTable.tsx" "src/app/(app)/returns/page.tsx"
git commit -m "feat(returns): add returns list page"
```

---

### Task 19: Returns create form (VAT-aware auto refund entry)

**Files:**
- Create: `src/app/(app)/returns/ReturnForm.tsx`
- Create: `src/app/(app)/returns/new/page.tsx`

**Interfaces:**
- Consumes: `Order` type, `calculateVatAmount` (Task 14), `fetchSettings`.

- [ ] **Step 1: Create the form component**

Create `src/app/(app)/returns/ReturnForm.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchSettings } from '@/lib/settings';
import { calculateVatAmount } from '@/lib/vat';
import type { Order, Settings } from '@/lib/types';

export default function ReturnForm({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [orderId, setOrderId] = useState('');
  const [caseDate, setCaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [refundEur, setRefundEur] = useState('');
  const [additionalLossEur, setAdditionalLossEur] = useState('0');
  const [status, setStatus] = useState<'Open' | 'Resolved' | 'Rejected'>('Open');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings(supabase).then(setSettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedOrder = useMemo(() => orders.find((o) => o.order_id === orderId), [orders, orderId]);

  function num(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const caseId = `RET-${Date.now().toString(36).toUpperCase()}`;
    const refund = num(refundEur);
    const netLoss = refund + num(additionalLossEur);

    const { error: saveError } = await supabase.from('returns_cases').insert({
      case_id: caseId,
      order_id: orderId || null,
      case_date: caseDate,
      reason,
      status,
      refund_eur: refund,
      net_loss_eur: netLoss,
      notes: null
    });

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    const vatRegistered = settings?.vatRegistered ?? false;
    const vatRatePercent = settings?.vatRatePercent ?? 19;

    const { error: accountError } = await supabase.from('accounts').insert({
      tx_id: `ACC-${Date.now().toString(36).toUpperCase()}`,
      type: 'Refund',
      category: 'Returns',
      amount_eur: refund,
      direction: 'Out',
      vat_rate_percent: vatRegistered ? vatRatePercent : null,
      vat_amount_eur: vatRegistered ? calculateVatAmount(refund, vatRatePercent) : null,
      notes: `Auto: return ${caseId}${orderId ? ` for order ${orderId}` : ''}`
    });

    if (accountError) {
      console.error('Failed to auto-create refund accounts entry:', accountError.message);
    }

    router.push('/returns');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 grid gap-3.5 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-3.5">
        <label className="field-label">
          Order
          <select
            className="field-input"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          >
            <option value="">No linked order</option>
            {orders.map((order) => (
              <option key={order.order_id} value={order.order_id}>
                {order.order_id} — {order.sku} ({order.buyer_username || 'no buyer'})
              </option>
            ))}
          </select>
          {selectedOrder && (
            <small className="text-muted font-normal text-[11px]">
              {selectedOrder.product_name} — sold for {selectedOrder.gross_sale_eur} EUR
            </small>
          )}
        </label>

        <label className="field-label">
          Case Date *
          <input
            className="field-input"
            type="date"
            required
            value={caseDate}
            onChange={(e) => setCaseDate(e.target.value)}
          />
        </label>

        <label className="field-label sm:col-span-2">
          Reason *
          <input
            className="field-input"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>

        <label className="field-label">
          Refund (EUR) *
          <input
            className="field-input"
            type="number"
            min="0"
            step="0.01"
            required
            value={refundEur}
            onChange={(e) => setRefundEur(e.target.value)}
          />
        </label>

        <label className="field-label">
          Additional Loss (EUR)
          <input
            className="field-input"
            type="number"
            min="0"
            step="0.01"
            value={additionalLossEur}
            onChange={(e) => setAdditionalLossEur(e.target.value)}
          />
        </label>

        <label className="field-label">
          Status
          <select
            className="field-input"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="Open">Open</option>
            <option value="Resolved">Resolved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </label>
      </div>

      {error && <p className="text-red font-semibold">{error}</p>}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Return'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create the page**

Create `src/app/(app)/returns/new/page.tsx`:

```tsx
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { Order } from '@/lib/types';
import ReturnForm from '../ReturnForm';

export default async function NewReturnPage() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .order('order_date', { ascending: false });

  return (
    <div>
      <PageHeader title="Add Return" subtitle="Log a return case and refund" />
      <ReturnForm orders={(orders as Order[]) || []} />
    </div>
  );
}
```

- [ ] **Step 3: Manually verify**

Visit `/returns/new`, select the dummy order created earlier, enter a
reason and refund amount, save. Confirm it appears at `/returns` and a
matching "Refund" row (direction Out) appears at `/accounts` with
`net_loss_eur = refund_eur + additional_loss_eur`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/returns/ReturnForm.tsx" "src/app/(app)/returns/new/page.tsx"
git commit -m "feat(returns): add return create form with auto refund accounts entry"
```

---

### Task 20: Competitor price summary calculation

**Files:**
- Create: `src/lib/competitorStats.ts`
- Test: `src/lib/competitorStats.test.ts`

**Interfaces:**
- Produces: `summarizeCompetitorPrices(prices: { platform: string; price: number }[]): { min: number | null; max: number | null; avg: number | null }` — consumed by `ResearchTable.tsx` (Task 21).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/competitorStats.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { summarizeCompetitorPrices } from './competitorStats';

describe('summarizeCompetitorPrices', () => {
  it('computes min, max, and avg for multiple prices', () => {
    const result = summarizeCompetitorPrices([
      { platform: 'eBay.de', price: 25 },
      { platform: 'Amazon.de', price: 30 },
      { platform: 'Kleinanzeigen', price: 20 }
    ]);

    expect(result.min).toBe(20);
    expect(result.max).toBe(30);
    expect(result.avg).toBe(25);
  });

  it('ignores zero or negative prices', () => {
    const result = summarizeCompetitorPrices([
      { platform: 'eBay.de', price: 25 },
      { platform: 'Bad Entry', price: 0 }
    ]);

    expect(result.min).toBe(25);
    expect(result.max).toBe(25);
  });

  it('returns nulls for an empty list', () => {
    const result = summarizeCompetitorPrices([]);

    expect(result).toEqual({ min: null, max: null, avg: null });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './competitorStats'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/competitorStats.ts`:

```ts
export type CompetitorPrice = {
  platform: string;
  price: number;
};

export type CompetitorStats = {
  min: number | null;
  max: number | null;
  avg: number | null;
};

export function summarizeCompetitorPrices(prices: CompetitorPrice[]): CompetitorStats {
  const values = prices.map((p) => p.price).filter((price) => Number.isFinite(price) && price > 0);

  if (values.length === 0) {
    return { min: null, max: null, avg: null };
  }

  const sum = values.reduce((total, price) => total + price, 0);

  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: Math.round((sum / values.length + Number.EPSILON) * 100) / 100
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/competitorStats.ts src/lib/competitorStats.test.ts
git commit -m "test: add competitor price min/max/avg calculation"
```

---

### Task 21: Research competitor price entry and display

**Files:**
- Modify: `src/lib/types.ts:122-143` (`ResearchItem` type)
- Modify: `src/app/(app)/research/ResearchForm.tsx`
- Modify: `src/app/(app)/research/ResearchTable.tsx`

**Interfaces:**
- Consumes: `summarizeCompetitorPrices` (Task 20).

- [ ] **Step 1: Add the field to `ResearchItem`**

In `src/lib/types.ts`, add `competitor_prices` to `ResearchItem` right
after `seller_supplier`:

```ts
  seller_supplier: string | null;
  competitor_prices: { platform: string; price: number }[];
  notes: string | null;
```

- [ ] **Step 2: Add repeatable competitor price rows to the form**

In `src/app/(app)/research/ResearchForm.tsx`, add state and UI for the
rows. Change the `initial` object to include `competitorPrices: [] as { platform: string; price: string }[]`:

```tsx
const initial = {
  keyword: '',
  productTitle: '',
  category: '',
  potentialModel: 'Stock' as 'Stock' | 'Dropship' | 'Used',
  currency: 'EUR' as 'EUR' | 'USD' | 'PKR',
  productPriceLocal: '',
  shippingLocal: '',
  mainListingUrl: '',
  imageUrl: '',
  competitorPrices: [] as { platform: string; price: string }[],
  notes: ''
};
```

Add these handler functions inside the component, above `handleSubmit`:

```tsx
  function addCompetitorPrice() {
    setForm((prev) => ({
      ...prev,
      competitorPrices: [...prev.competitorPrices, { platform: '', price: '' }]
    }));
  }

  function updateCompetitorPrice(index: number, field: 'platform' | 'price', value: string) {
    setForm((prev) => ({
      ...prev,
      competitorPrices: prev.competitorPrices.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      )
    }));
  }

  function removeCompetitorPrice(index: number) {
    setForm((prev) => ({
      ...prev,
      competitorPrices: prev.competitorPrices.filter((_, i) => i !== index)
    }));
  }
```

In `handleSubmit`, add `competitor_prices` to the insert payload:

```tsx
    const { error: insertError } = await supabase.from('product_research').insert({
      keyword: form.keyword,
      product_title: form.productTitle || null,
      category: form.category || null,
      potential_model: form.potentialModel,
      currency: form.currency,
      product_price_local: Number(form.productPriceLocal) || 0,
      shipping_local: Number(form.shippingLocal) || 0,
      main_listing_url: normalizeUrl(form.mainListingUrl),
      image_url: normalizeUrl(form.imageUrl),
      competitor_prices: form.competitorPrices
        .filter((row) => row.platform && Number(row.price) > 0)
        .map((row) => ({ platform: row.platform, price: Number(row.price) })),
      notes: form.notes || null
    });
```

Add the UI block in the JSX, right before the Notes field:

```tsx
        <div className="field-label sm:col-span-2">
          Competitor Prices (other platforms)
          <div className="grid gap-2 mt-1">
            {form.competitorPrices.map((row, index) => (
              <div key={index} className="flex gap-2">
                <input
                  className="field-input"
                  placeholder="Platform (e.g. Amazon.de)"
                  value={row.platform}
                  onChange={(e) => updateCompetitorPrice(index, 'platform', e.target.value)}
                />
                <input
                  className="field-input max-w-[140px]"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price"
                  value={row.price}
                  onChange={(e) => updateCompetitorPrice(index, 'price', e.target.value)}
                />
                <button
                  type="button"
                  className="text-red font-bold px-2"
                  onClick={() => removeCompetitorPrice(index)}
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="btn-secondary w-fit" onClick={addCompetitorPrice}>
              + Add Competitor Price
            </button>
          </div>
        </div>
```

- [ ] **Step 3: Display Min/Max/Avg in the table**

In `src/app/(app)/research/ResearchTable.tsx`, import the helper and add
a column:

```tsx
import { summarizeCompetitorPrices } from '@/lib/competitorStats';
```

Add a `<th>` after "Price":

```tsx
              <th className="p-3">Price</th>
              <th className="p-3">Competitor Min/Avg/Max</th>
```

Add the corresponding `<td>` after the price cell, inside the `.map`:

```tsx
                <td className="p-3">{formatMoney(item.product_price_local)}</td>
                <td className="p-3">
                  {(() => {
                    const stats = summarizeCompetitorPrices(item.competitor_prices || []);
                    if (stats.min == null) return '—';
                    return `${formatMoney(stats.min)} / ${formatMoney(stats.avg!)} / ${formatMoney(stats.max!)}`;
                  })()}
                </td>
```

- [ ] **Step 4: Manually verify**

Visit `/research`, create a new research item with 2-3 competitor
prices added via "+ Add Competitor Price". Save. Confirm the table
shows the correct Min/Avg/Max combination next to the item's own price.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts "src/app/(app)/research/ResearchForm.tsx" "src/app/(app)/research/ResearchTable.tsx"
git commit -m "feat(research): add manual competitor price comparison"
```

---

### Task 22: Dashboard and end-to-end verification (manual QA, no code expected)

**Files:** none expected — this task verifies Tasks 1-21 together. If a
bug surfaces, fix it in the file it belongs to and commit that fix
separately with a `fix:` message before continuing.

**Interfaces:** N/A — this is the full-chain acceptance pass from the
spec's testing plan.

- [ ] **Step 1: Confirm no more 404s**

Click every Sidebar link (`Dashboard`, `Products`, `Add Product`,
`Orders`, `Product Research`, `Inventory`, `Accounts`, `Returns`,
`Settings`) and every Dashboard Quick Action link. Expected: all load
successfully.

- [ ] **Step 2: Run the full dummy-data chain**

1. `/research` — create a research item, add 2-3 competitor prices,
   save. Confirm Min/Avg/Max shows correctly.
2. Click "Convert to Product" on that item. Fill in the remaining
   Product fields, save. Confirm: research row now shows
   `research_status = Converted`; a matching `inventory` row exists
   with `quantity_on_hand = 0`; an auto "Purchase" accounts row exists.
3. `/orders/new` — create an order against that SKU. Confirm: order
   appears in `/orders`; a "Sale" accounts row appears; the inventory
   row's `quantity_on_hand` decreased by the order quantity.
4. Edit that order's quantity up by 1. Confirm inventory decreased by
   exactly 1 more (delta, not double-deducted).
5. `/orders/import` — upload a 3-row CSV (2 valid SKUs, 1 unknown SKU).
   Confirm the preview flags the invalid row and only 2 rows import
   with correct accounts/inventory side-effects.
6. `/returns/new` — create a return against the order created in step
   3. Confirm it appears in `/returns` and a "Refund" accounts row
   appears with the correct amount.
7. `/settings` — toggle VAT Registered on, set a rate, save. Confirm
   `/accounts` now shows a VAT column and VAT summary strip with
   correct collected/paid/payable totals for the transactions created
   above (all created before VAT mode was on, so they should show `—`
   in the VAT column — this is expected, since VAT is only computed at
   the time a transaction is created).
8. Create one more manual accounts transaction while VAT mode is on.
   Confirm its VAT amount auto-computes and shows in the ledger.
9. Toggle VAT Registered back off in `/settings`. Confirm `/accounts`
   reverts to hiding the VAT column/summary and `/accounts/new` no
   longer shows the VAT Rate field.
10. `/dashboard` — confirm the stat cards ("Total Products", "Active
    Products", "Orders This Month", "Net Profit This Month", "Reorder
    Alerts", "Open Returns") reflect the dummy data created above, and
    "Recent Orders" lists the order(s) created.

- [ ] **Step 3: Run the automated test suite one final time**

Run: `npm test`
Expected: PASS — all suites from Tasks 2, 8, 12, 14, 20 green.

- [ ] **Step 4: If everything passes, no commit is needed for this task**

This task is verification-only. If any step above surfaced a bug, that
fix was already committed with its own `fix:` commit during this task —
there is nothing further to commit here.

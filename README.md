# eBay Manager (Next.js + Supabase)

Rebuild of the Google Apps Script eBay Business Manager (still preserved under
`Google Sheet/`) on a proper web stack: Next.js (App Router) on Vercel,
Supabase for the database, auth, and file storage.

## Stack

- **Frontend/API:** Next.js 15 (App Router, TypeScript, Tailwind CSS)
- **Database:** Supabase Postgres — see `supabase/schema.sql`
- **Auth:** Supabase Auth (email/password)
- **File storage:** Supabase Storage (bucket `product-images`)
- **Hosting:** Vercel

## What's built so far

- Auth: login page (`/login`), middleware redirects unauthenticated users there
  and signed-in users away from it.
- Shared shell: sliding mobile sidebar + nav (`src/components/Sidebar.tsx`,
  `AppShell.tsx`), matching the old app's navy/blue design.
- **Dashboard** (`/dashboard`): live stat cards + recent orders, from Supabase.
- **Products** (`/products`, `/products/new`, `/products/[sku]`,
  `/products/[sku]/edit`): full list with search/filters, Add/Edit form with
  the same cost/profit engine as the old app (`src/lib/pricing.ts`, ported
  from `Google Sheet/Products.js`), up to 5 photos uploaded to Supabase
  Storage sorted into `condition/category/product` folders, a full detail
  view, and archive (soft delete).

## Not built yet

Orders, Inventory, Product Research, Accounts, and Returns pages — same
pattern as Products, next up. Auto-accounting (Product save → Accounts
expense entry) is wired for Products only so far; Orders/Returns need the
same treatment once their pages exist.

## Local setup

1. Create a Supabase project at https://supabase.com.
2. In the SQL editor, run `supabase/schema.sql` once.
3. In Storage, create a **public** bucket named `product-images`.
4. In Authentication → Users, create yourself a user (email + password) —
   there's no public signup page, accounts are created by an admin.
5. Copy `.env.local.example` to `.env.local` and fill in your project's URL
   and anon key (Project Settings → API).
6. `npm install`
7. `npm run dev` — http://localhost:3000

## Deploying to Vercel

1. Push this repo to GitHub (already done).
2. Import the repo in Vercel.
3. Add the same two env vars (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the Vercel project settings.
4. Deploy. Vercel auto-detects Next.js, no extra config needed.

## Migrating data from the old Google Sheet

Not automated yet. Export each sheet tab to CSV and import into the matching
Supabase table (column names differ - e.g. `Product Name` → `product_name` -
match them up per `supabase/schema.sql`), or ask for a one-off migration
script once there's real data to move.

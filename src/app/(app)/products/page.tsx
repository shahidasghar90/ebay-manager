import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';
import ProductsTable from './ProductsTable';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const supabase = await createClient();

  const [{ data: products }, { data: closedOrders }, { data: stock }] = await Promise.all([
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('sku')
      .not('closed_at', 'is', null)
      .not('order_status', 'in', '(Cancelled,Returned)')
      .not('sku', 'is', null),
    supabase.from('inventory').select('sku, quantity_on_hand')
  ]);

  // Sold = at least one closed order and nothing left on hand.
  const onHand = new Map<string, number>();
  for (const row of (stock as { sku: string; quantity_on_hand: number }[]) || []) {
    onHand.set(row.sku, (onHand.get(row.sku) || 0) + Number(row.quantity_on_hand || 0));
  }
  const soldSkus = Array.from(
    new Set(((closedOrders as { sku: string }[]) || []).map((order) => order.sku))
  ).filter((sku) => (onHand.get(sku) || 0) <= 0);

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Search, compare and manage your product catalogue"
        actions={
          <Link href="/products/new" className="btn-primary">
            + Add Product
          </Link>
        }
      />

      <ProductsTable products={(products as Product[]) || []} soldSkus={soldSkus} />
    </div>
  );
}

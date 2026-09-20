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

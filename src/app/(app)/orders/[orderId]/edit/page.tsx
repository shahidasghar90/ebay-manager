import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { InventoryItem, Order, Product } from '@/lib/types';
import OrderForm from '../../OrderForm';
import { RecordAuthorLine } from '@/components/RecordAuthor';

export default async function EditOrderPage({
  params
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: products }, { data: inventory }] = await Promise.all([
    supabase.from('orders').select('*').eq('order_id', orderId).maybeSingle(),
    supabase.from('products').select('*').order('product_name', { ascending: true }),
    supabase.from('inventory').select('*')
  ]);

  if (!order) notFound();

  // Closed/cancelled/returned orders are already booked in Accounts; editing the
  // numbers here would put the two out of step.
  const locked = !!order.closed_at || ['Cancelled', 'Returned'].includes(order.order_status);

  return (
    <div>
      <PageHeader title={`Edit Order — ${order.order_id}`} subtitle={order.product_name || ''} />
      <RecordAuthorLine record={order} />
      {locked ? (
        <div className="card p-5 grid gap-3 max-w-2xl">
          <p className="m-0">
            This order is <strong>{order.order_status}</strong> and can no longer be edited.
            {order.closed_at && ' Reopen it from the order page to make changes.'}
          </p>
          <div>
            <Link href={`/orders/${order.order_id}`} className="btn-secondary inline-block">
              Back to Order
            </Link>
          </div>
        </div>
      ) : (
        <OrderForm
          order={order as Order}
          products={(products as Product[]) || []}
          inventory={(inventory as InventoryItem[]) || []}
        />
      )}
    </div>
  );
}

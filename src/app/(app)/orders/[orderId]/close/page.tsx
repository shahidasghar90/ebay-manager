import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { Order } from '@/lib/types';
import CloseOrderForm from '../../CloseOrderForm';

export default async function CloseOrderPage({
  params
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('orders').select('*').eq('order_id', orderId).maybeSingle();

  if (!data) notFound();

  const order = data as Order;
  const closable = !order.closed_at && order.order_status !== 'Cancelled';

  return (
    <div>
      <PageHeader title={`Close Order — ${order.order_id}`} subtitle="Book the payout into Accounts" />
      {closable ? (
        <CloseOrderForm order={order} />
      ) : (
        <div className="card p-5 grid gap-3 max-w-2xl">
          <p className="m-0">
            This order is <strong>{order.order_status}</strong> and cannot be closed.
          </p>
          <div>
            <Link href={`/orders/${order.order_id}`} className="btn-secondary inline-block">
              Back to Order
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

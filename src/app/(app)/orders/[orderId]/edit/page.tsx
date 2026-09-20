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

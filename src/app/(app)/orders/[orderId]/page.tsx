import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatMoney, statusClassName } from '@/lib/format';
import type { Order } from '@/lib/types';
import { RecordAuthorLine } from '@/components/RecordAuthor';

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
      <RecordAuthorLine record={order} />

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
          <Field label="Selling Fee" value={formatMoney(order.ebay_fee_eur)} />
          <Field label="Payment Fee" value={formatMoney(order.payment_fee_eur)} />
          <Field label="Product Cost" value={formatMoney(order.product_cost_eur)} />
          <Field label="Shipping/Packaging Cost" value={formatMoney(order.shipping_packaging_cost_eur)} />
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

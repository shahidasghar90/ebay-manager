import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatMoney, statusClassName } from '@/lib/format';
import { expectedPayout } from '@/lib/orderPricing';
import { buildLedgerRows } from '@/lib/ledgerRows';
import type { AccountTx, Order } from '@/lib/types';
import { RecordAuthorLine } from '@/components/RecordAuthor';
import OrderActions from '../OrderActions';

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
  const [{ data }, { data: entries }] = await Promise.all([
    supabase.from('orders').select('*').eq('order_id', orderId).maybeSingle(),
    supabase
      .from('accounts')
      .select('*')
      .eq('ref_type', 'order')
      .eq('ref_id', orderId)
      .order('created_at', { ascending: true })
  ]);

  if (!data) notFound();

  const order = data as Order;
  const ledger = (entries as AccountTx[]) || [];
  // Same grouping as the Accounts page: fixed order + net total.
  const ledgerRow = buildLedgerRows(ledger)[0];
  const adjustment = Number(order.adjustment_eur || 0);

  return (
    <div>
      <PageHeader
        title={order.order_id}
        subtitle={order.product_name || order.sku || ''}
        actions={<OrderActions order={order} />}
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

        <Section title="Payout">
          <Field
            label="Expected Payout"
            value={formatMoney(expectedPayout(order, Number(order.fee_vat_eur || 0)))}
          />
          <Field label="VAT on Fees" value={order.closed_at ? formatMoney(order.fee_vat_eur) : '—'} />
          <Field
            label="Received"
            value={order.actual_payout_eur != null ? formatMoney(order.actual_payout_eur) : 'Not closed yet'}
          />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase text-muted font-bold">Adjustment</span>
            <strong className={`text-sm ${adjustment < 0 ? 'text-red' : adjustment > 0 ? 'text-green' : ''}`}>
              {order.closed_at ? formatMoney(adjustment) : '—'}
            </strong>
          </div>
          <Field label="Payout Date" value={formatDate(order.payout_date)} />
        </Section>

        {ledgerRow && (
          <div>
            <h4 className="text-xs uppercase tracking-wide text-blue font-bold border-b border-border pb-1.5 mb-2.5">
              Money Breakdown
            </h4>
            <ul className="grid gap-0 m-0 p-0 list-none text-sm">
              {ledgerRow.parts.map((tx) => (
                <li
                  key={tx.tx_id}
                  className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0"
                >
                  <span className="min-w-0">
                    <strong className="block">{tx.type}</strong>
                    <span className="block text-xs text-muted truncate">
                      {formatDate(tx.tx_date)} · {tx.category}
                    </span>
                  </span>
                  <strong className={`shrink-0 ${tx.direction === 'In' ? 'text-green' : 'text-red'}`}>
                    {tx.direction === 'In' ? '+' : '−'}
                    {formatMoney(tx.amount_eur)}
                  </strong>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 pt-2">
                <strong>Net to you</strong>
                <strong className={ledgerRow.netEur >= 0 ? 'text-green' : 'text-red'}>
                  {ledgerRow.netEur >= 0 ? '+' : '−'}
                  {formatMoney(Math.abs(ledgerRow.netEur))}
                </strong>
              </li>
            </ul>
          </div>
        )}

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

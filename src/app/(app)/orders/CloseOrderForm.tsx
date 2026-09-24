'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/format';
import { expectedPayout } from '@/lib/orderPricing';
import type { Order } from '@/lib/types';
import { notifyTeam } from '@/lib/notify';

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function num(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function CloseOrderForm({ order }: { order: Order }) {
  const router = useRouter();
  const supabase = createClient();

  // eBay adds 19% VAT to each fee line and rounds per line (e.g. 1.09 → 0.21,
  // 0.35 → 0.07 = 0.28), so the suggestion matches the eBay breakdown.
  const suggestedFeeVat =
    Math.round((round2(Number(order.ebay_fee_eur || 0) * 0.19) + round2(Number(order.payment_fee_eur || 0) * 0.19)) * 100) /
    100;
  const [feeVat, setFeeVat] = useState(String(suggestedFeeVat));
  const expected = expectedPayout(order, num(feeVat));
  const [actual, setActual] = useState(String(expectedPayout(order, suggestedFeeVat)));
  const [payoutDate, setPayoutDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const adjustment = Math.round((num(actual) - expected) * 100) / 100;
  const fees = Number(order.ebay_fee_eur || 0) + Number(order.payment_fee_eur || 0);
  const shipping = Number(order.shipping_packaging_cost_eur || 0);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const { error: closeError } = await supabase.rpc('close_order', {
      p_order_id: order.order_id,
      p_actual_payout_eur: num(actual),
      p_payout_date: payoutDate,
      p_fee_vat_eur: num(feeVat)
    });

    if (closeError) {
      setError(closeError.message);
      setSaving(false);
      return;
    }

    notifyTeam(
      'Order closed',
      `${order.order_id} · received ${formatMoney(num(actual))}`,
      `/orders/${order.order_id}`
    );

    router.push(`/orders/${order.order_id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 max-w-2xl">
      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <PreviewField label="Gross Sale" value={formatMoney(order.gross_sale_eur)} />
          <PreviewField label="Fees" value={formatMoney(fees)} />
          <PreviewField label="Expected Payout" value={formatMoney(expected)} />
          <PreviewField
            label="Adjustment"
            value={formatMoney(adjustment)}
            tone={adjustment < 0 ? 'text-red' : adjustment > 0 ? 'text-green' : ''}
          />
        </div>
      </div>

      <div className="card p-5 grid gap-3.5">
        <div className="grid sm:grid-cols-2 gap-3.5">
          <label className="field-label">
            Amount Received (EUR) *
            <input
              className="field-input"
              type="number"
              min="0"
              step="0.01"
              required
              value={actual}
              onChange={(e) => setActual(e.target.value)}
            />
            <small className="text-muted font-normal text-[11px] -mt-0.5">
              eBay &quot;Sales proceeds less costs&quot;.
            </small>
          </label>

          <label className="field-label">
            VAT on eBay Fees (EUR)
            <input
              className="field-input"
              type="number"
              min="0"
              step="0.01"
              value={feeVat}
              onChange={(e) => setFeeVat(e.target.value)}
            />
            <small className="text-muted font-normal text-[11px] -mt-0.5">
              eBay &quot;VAT (19%)&quot; line.{' '}
              <button
                type="button"
                className="text-blue font-bold underline"
                onClick={() => setFeeVat(String(suggestedFeeVat))}
              >
                Use 19% of fees ({formatMoney(suggestedFeeVat)})
              </button>
            </small>
          </label>

          <label className="field-label">
            Payout Date *
            <input
              className="field-input"
              type="date"
              required
              value={payoutDate}
              onChange={(e) => setPayoutDate(e.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-1 text-[13px]">
          <span className="text-[11px] uppercase text-muted font-bold">Posted to Accounts</span>
          <LedgerLine label="Sale" direction="In" amount={order.gross_sale_eur} />
          <LedgerLine label="Fees" direction="Out" amount={fees} />
          {num(feeVat) > 0 && <LedgerLine label="VAT on Fees" direction="Out" amount={num(feeVat)} />}
          {shipping > 0 && <LedgerLine label="Shipping" direction="Out" amount={shipping} />}
          {adjustment !== 0 && (
            <LedgerLine
              label="Adjustment"
              direction={adjustment > 0 ? 'In' : 'Out'}
              amount={Math.abs(adjustment)}
            />
          )}
        </div>
      </div>

      {error && <p className="text-red font-semibold">{error}</p>}

      <div className="flex justify-end gap-2.5">
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Back
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Closing...' : 'Close Order'}
        </button>
      </div>
    </form>
  );
}

function LedgerLine({ label, direction, amount }: { label: string; direction: 'In' | 'Out'; amount: number }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-1.5 last:border-b-0">
      <span>{label}</span>
      <strong className={direction === 'In' ? 'text-green' : 'text-red'}>
        {direction === 'In' ? '+' : '−'}
        {formatMoney(amount)}
      </strong>
    </div>
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

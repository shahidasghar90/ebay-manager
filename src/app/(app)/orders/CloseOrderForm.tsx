'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/format';
import { expectedPayout } from '@/lib/orderPricing';
import type { Order } from '@/lib/types';
import { notifyTeam } from '@/lib/notify';

/** VAT eBay adds to its fees for sellers without a VAT ID (Germany: 19%). */
const FEE_VAT_RATE = 0.19;

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

  // Only the amount received is needed. Everything eBay kept (gross − received)
  // is fees incl. 19% VAT, so the VAT part is worked out from that; whatever
  // differs from the estimated fees becomes the Adjustment.
  const [actual, setActual] = useState('');
  const [feeVatOverride, setFeeVatOverride] = useState<string | null>(null);
  const [payoutDate, setPayoutDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const hasActual = actual.trim() !== '';
  const deducted = hasActual ? Math.max(round2(Number(order.gross_sale_eur || 0) - num(actual)), 0) : 0;
  const autoFeeVat = round2(deducted - deducted / (1 + FEE_VAT_RATE));
  const feeVat = feeVatOverride ?? String(autoFeeVat);

  const expected = expectedPayout(order, num(feeVat));
  const adjustment = hasActual ? round2(num(actual) - expected) : 0;
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
          <PreviewField label="eBay Kept" value={hasActual ? formatMoney(deducted) : '—'} />
          <PreviewField label="Estimated Fees" value={formatMoney(fees)} />
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
              autoFocus
              placeholder={String(expectedPayout(order))}
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
              onChange={(e) => setFeeVatOverride(e.target.value)}
            />
            <small className="text-muted font-normal text-[11px] -mt-0.5">
              {feeVatOverride === null ? (
                'Worked out automatically. Change it only if eBay shows a different VAT.'
              ) : (
                <button
                  type="button"
                  className="text-blue font-bold underline"
                  onClick={() => setFeeVatOverride(null)}
                >
                  Back to automatic ({formatMoney(autoFeeVat)})
                </button>
              )}
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
          {hasActual && adjustment !== 0 && (
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

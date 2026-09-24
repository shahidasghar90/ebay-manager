'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchSettings } from '@/lib/settings';
import { calculateVatAmount } from '@/lib/vat';
import type { Order, Settings } from '@/lib/types';
import { notifyTeam } from '@/lib/notify';

export default function ReturnForm({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [orderId, setOrderId] = useState('');
  const [caseDate, setCaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [refundEur, setRefundEur] = useState('');
  const [additionalLossEur, setAdditionalLossEur] = useState('0');
  const [status, setStatus] = useState<'Open' | 'Resolved' | 'Rejected'>('Open');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings(supabase).then(setSettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedOrder = useMemo(() => orders.find((o) => o.order_id === orderId), [orders, orderId]);

  function num(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const caseId = `RET-${Date.now().toString(36).toUpperCase()}`;
    const refund = num(refundEur);
    const netLoss = refund + num(additionalLossEur);

    const { error: saveError } = await supabase.from('returns_cases').insert({
      case_id: caseId,
      order_id: orderId || null,
      case_date: caseDate,
      reason,
      status,
      refund_eur: refund,
      net_loss_eur: netLoss,
      notes: null
    });

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    const vatRegistered = settings?.vatRegistered ?? false;
    const vatRatePercent = settings?.vatRatePercent ?? 19;

    const { error: accountError } = await supabase.from('accounts').insert({
      tx_id: `ACC-${Date.now().toString(36).toUpperCase()}`,
      type: 'Refund',
      category: 'Returns',
      amount_eur: refund,
      direction: 'Out',
      vat_rate_percent: vatRegistered ? vatRatePercent : null,
      vat_amount_eur: vatRegistered ? calculateVatAmount(refund, vatRatePercent) : null,
      notes: `Auto: return ${caseId}${orderId ? ` for order ${orderId}` : ''}`
    });

    if (accountError) {
      console.error('Failed to auto-create refund accounts entry:', accountError.message);
    }

    notifyTeam(
      'New return case',
      `${caseId}${orderId ? ` · order ${orderId}` : ''} · ${reason}`,
      '/returns'
    );

    router.push('/returns');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 grid gap-3.5 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-3.5">
        <label className="field-label">
          Order
          <select
            className="field-input"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          >
            <option value="">No linked order</option>
            {orders.map((order) => (
              <option key={order.order_id} value={order.order_id}>
                {order.order_id} — {order.sku} ({order.buyer_username || 'no buyer'})
              </option>
            ))}
          </select>
          {selectedOrder && (
            <small className="text-muted font-normal text-[11px]">
              {selectedOrder.product_name} — sold for {selectedOrder.gross_sale_eur} EUR
            </small>
          )}
        </label>

        <label className="field-label">
          Case Date *
          <input
            className="field-input"
            type="date"
            required
            value={caseDate}
            onChange={(e) => setCaseDate(e.target.value)}
          />
        </label>

        <label className="field-label sm:col-span-2">
          Reason *
          <input
            className="field-input"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>

        <label className="field-label">
          Refund (EUR) *
          <input
            className="field-input"
            type="number"
            min="0"
            step="0.01"
            required
            value={refundEur}
            onChange={(e) => setRefundEur(e.target.value)}
          />
        </label>

        <label className="field-label">
          Additional Loss (EUR)
          <input
            className="field-input"
            type="number"
            min="0"
            step="0.01"
            value={additionalLossEur}
            onChange={(e) => setAdditionalLossEur(e.target.value)}
          />
        </label>

        <label className="field-label">
          Status
          <select
            className="field-input"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="Open">Open</option>
            <option value="Resolved">Resolved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </label>
      </div>

      {error && <p className="text-red font-semibold">{error}</p>}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Return'}
        </button>
      </div>
    </form>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/format';
import type { Order, ReturnCase } from '@/lib/types';
import { notifyTeam } from '@/lib/notify';

function num(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** eBay credits back the percentage selling fee on the refunded share (not the fixed fee). */
function suggestedFeeCredit(order: Order | undefined, refund: number) {
  if (!order || !order.gross_sale_eur) return 0;
  return round2(Number(order.ebay_fee_eur || 0) * Math.min(refund / order.gross_sale_eur, 1));
}

export default function ReturnForm({ orders, returnCase }: { orders: Order[]; returnCase?: ReturnCase }) {
  const isEditing = !!returnCase;
  const router = useRouter();
  const supabase = createClient();

  const [orderId, setOrderId] = useState(returnCase?.order_id || '');
  const [caseDate, setCaseDate] = useState(returnCase?.case_date || new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState(returnCase?.reason || '');
  const [refundEur, setRefundEur] = useState(String(returnCase?.refund_eur ?? ''));
  const [additionalLossEur, setAdditionalLossEur] = useState(String(returnCase?.additional_loss_eur ?? 0));
  const [feeCreditEur, setFeeCreditEur] = useState(String(returnCase?.fee_credit_eur ?? 0));
  const [restock, setRestock] = useState(returnCase?.restock ?? false);
  const [status, setStatus] = useState<ReturnCase['status']>(returnCase?.status || 'Open');
  const [notes, setNotes] = useState(returnCase?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedOrder = useMemo(() => orders.find((o) => o.order_id === orderId), [orders, orderId]);

  const refund = num(refundEur);
  const restockValue = restock && selectedOrder ? Number(selectedOrder.product_cost_eur || 0) : 0;
  const netLoss = round2(refund + num(additionalLossEur) - num(feeCreditEur) - restockValue);

  function selectOrder(nextId: string) {
    setOrderId(nextId);
    const order = orders.find((o) => o.order_id === nextId);
    if (!order) return;

    // Full refund is the usual case; the user can still lower it.
    const gross = Number(order.gross_sale_eur || 0);
    setRefundEur(String(gross));
    setFeeCreditEur(String(suggestedFeeCredit(order, gross)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    if (selectedOrder && refund > Number(selectedOrder.gross_sale_eur || 0)) {
      setError(`Refund is more than the order's gross sale (${formatMoney(selectedOrder.gross_sale_eur)}).`);
      setSaving(false);
      return;
    }

    const caseId = returnCase?.case_id || `RET-${Date.now().toString(36).toUpperCase()}`;

    const payload = {
      case_id: caseId,
      order_id: orderId || null,
      case_date: caseDate,
      reason,
      status,
      refund_eur: refund,
      additional_loss_eur: num(additionalLossEur),
      fee_credit_eur: num(feeCreditEur),
      restock: !!selectedOrder && restock,
      net_loss_eur: netLoss,
      notes: notes || null
    };

    const { error: saveError } = isEditing
      ? await supabase.from('returns_cases').update(payload).eq('case_id', caseId)
      : await supabase.from('returns_cases').insert(payload);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    // Posts (or removes) the ledger, stock and order-profit effects to match the status.
    const { error: syncError } = await supabase.rpc('sync_return', { p_case_id: caseId });

    if (syncError) {
      setError(`Saved, but Accounts could not be updated: ${syncError.message}`);
      setSaving(false);
      return;
    }

    notifyTeam(
      isEditing ? 'Return case edited' : 'New return case',
      `${caseId}${orderId ? ` · order ${orderId}` : ''} · ${status}`,
      `/returns/${caseId}/edit`
    );

    router.push('/returns');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 max-w-2xl">
      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <PreviewField label="Refund" value={formatMoney(refund)} />
          <PreviewField label="Net Loss" value={formatMoney(netLoss)} tone={netLoss > 0 ? 'text-red' : 'text-green'} />
          <PreviewField
            label="Accounts"
            value={status === 'Resolved' ? 'Posted on save' : 'Not posted yet'}
            className="col-span-2 sm:col-span-1"
          />
        </div>
      </div>

      <div className="card p-5 grid gap-3.5">
        <div className="grid sm:grid-cols-2 gap-3.5">
          <label className="field-label">
            Order
            <select
              className="field-input"
              value={orderId}
              onChange={(e) => selectOrder(e.target.value)}
              disabled={isEditing}
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
                {selectedOrder.product_name} — sold for {formatMoney(selectedOrder.gross_sale_eur)}
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
            Refund to Buyer (EUR) *
            <input
              className="field-input"
              type="number"
              min="0"
              step="0.01"
              required
              value={refundEur}
              onChange={(e) => {
                setRefundEur(e.target.value);
                if (selectedOrder) setFeeCreditEur(String(suggestedFeeCredit(selectedOrder, num(e.target.value))));
              }}
            />
          </label>

          <label className="field-label">
            eBay Fee Credit (EUR)
            <input
              className="field-input"
              type="number"
              min="0"
              step="0.01"
              value={feeCreditEur}
              onChange={(e) => setFeeCreditEur(e.target.value)}
            />
            <small className="text-muted font-normal text-[11px] -mt-0.5">
              Selling fee eBay gives back on the refund.
            </small>
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
            <small className="text-muted font-normal text-[11px] -mt-0.5">
              Return label, damage, etc.
            </small>
          </label>

          <label className="field-label">
            Status
            <select
              className="field-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as ReturnCase['status'])}
            >
              <option value="Open">Open</option>
              <option value="Resolved">Resolved</option>
              <option value="Rejected">Rejected</option>
            </select>
            <small className="text-muted font-normal text-[11px] -mt-0.5">
              Refund reaches Accounts only when Resolved.
            </small>
          </label>

          {selectedOrder && (
            <label className="flex items-center gap-2 text-[13px] font-bold text-slate-700 sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={restock}
                onChange={(e) => setRestock(e.target.checked)}
              />
              Item is resellable — put {selectedOrder.quantity} back in stock
            </label>
          )}

          <label className="field-label sm:col-span-2">
            Notes
            <textarea
              className="field-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
      </div>

      {error && <p className="text-red font-semibold">{error}</p>}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : isEditing ? 'Update Return' : 'Save Return'}
        </button>
      </div>
    </form>
  );
}

function PreviewField({
  label,
  value,
  tone,
  className = ''
}: {
  label: string;
  value: string;
  tone?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] uppercase text-muted font-bold">{label}</span>
      <strong className={`text-lg ${tone || ''}`}>{value}</strong>
    </div>
  );
}

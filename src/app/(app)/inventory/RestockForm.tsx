'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/format';
import type { InventoryItem } from '@/lib/types';
import { notifyTeam } from '@/lib/notify';

function num(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function RestockForm({
  item,
  defaultUnitCostEur
}: {
  item: InventoryItem;
  defaultUnitCostEur: number;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState(String(defaultUnitCostEur || ''));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [recordExpense, setRecordExpense] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const qty = Math.trunc(num(quantity));
  const total = qty * num(unitCost);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const { error: restockError } = await supabase.rpc('restock_inventory', {
      p_sku: item.sku,
      p_qty: qty,
      p_unit_cost_eur: num(unitCost),
      p_date: date,
      p_record_expense: recordExpense,
      p_notes: notes || null
    });

    if (restockError) {
      setError(restockError.message);
      setSaving(false);
      return;
    }

    notifyTeam('Stock added', `${item.sku} · +${qty}`, `/inventory/${item.id}/edit`);

    router.push('/inventory');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 grid gap-3.5 max-w-2xl">
      <p className="text-[13px] m-0">
        On hand now <strong>{item.quantity_on_hand}</strong> · after this{' '}
        <strong>{item.quantity_on_hand + qty}</strong>
      </p>

      <div className="grid sm:grid-cols-2 gap-3.5">
        <label className="field-label">
          Quantity Received *
          <input
            className="field-input"
            type="number"
            min="1"
            step="1"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>

        <label className="field-label">
          Unit Cost (EUR)
          <input
            className="field-input"
            type="number"
            min="0"
            step="0.01"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />
          <small className="text-muted font-normal text-[11px] -mt-0.5">
            Pre-filled from the product&apos;s total cost.
          </small>
        </label>

        <label className="field-label">
          Date *
          <input
            className="field-input"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <label className="flex items-center gap-2 text-[13px] font-bold text-slate-700 sm:mt-6">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={recordExpense}
            onChange={(e) => setRecordExpense(e.target.checked)}
          />
          Add {formatMoney(total)} as an expense in Accounts
        </label>

        <label className="field-label sm:col-span-2">
          Notes
          <input
            className="field-input"
            placeholder="Supplier invoice, batch..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="text-red font-semibold">{error}</p>}

      <div className="flex justify-end gap-2.5">
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Back
        </button>
        <button type="submit" className="btn-primary" disabled={saving || qty < 1}>
          {saving ? 'Saving...' : 'Add Stock'}
        </button>
      </div>
    </form>
  );
}

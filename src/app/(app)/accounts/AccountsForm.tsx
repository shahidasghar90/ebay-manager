'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchSettings } from '@/lib/settings';
import { calculateVatAmount } from '@/lib/vat';
import { formatMoney } from '@/lib/format';
import type { AccountTx, Settings } from '@/lib/types';
import { notifyTeam } from '@/lib/notify';

type FormState = {
  txDate: string;
  type: string;
  category: string;
  amountEur: string;
  direction: 'In' | 'Out';
  vatRatePercent: string;
  notes: string;
};

function initialState(tx?: AccountTx, defaultVatRate?: number): FormState {
  return {
    txDate: tx?.tx_date || new Date().toISOString().slice(0, 10),
    type: tx?.type || '',
    category: tx?.category || '',
    amountEur: String(tx?.amount_eur ?? ''),
    direction: tx?.direction || 'Out',
    vatRatePercent: String(tx?.vat_rate_percent ?? defaultVatRate ?? 19),
    notes: tx?.notes || ''
  };
}

function num(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function AccountsForm({ tx }: { tx?: AccountTx }) {
  const isEditing = !!tx;
  const router = useRouter();
  const supabase = createClient();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<FormState>(() => initialState(tx));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings(supabase).then((loaded) => {
      setSettings(loaded);
      setForm((prev) => (tx ? prev : { ...prev, vatRatePercent: String(loaded.vatRatePercent) }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const vatAmountEur = useMemo(
    () => (settings?.vatRegistered ? calculateVatAmount(num(form.amountEur), num(form.vatRatePercent)) : null),
    [settings, form.amountEur, form.vatRatePercent]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const txId = tx?.tx_id || `ACC-${Date.now().toString(36).toUpperCase()}`;

    const payload = {
      tx_id: txId,
      tx_date: form.txDate,
      type: form.type,
      category: form.category,
      amount_eur: num(form.amountEur),
      direction: form.direction,
      vat_rate_percent: settings?.vatRegistered ? num(form.vatRatePercent) : tx?.vat_rate_percent ?? null,
      vat_amount_eur: settings?.vatRegistered ? vatAmountEur : tx?.vat_amount_eur ?? null,
      notes: form.notes || null
    };

    const { error: saveError } = isEditing
      ? await supabase.from('accounts').update(payload).eq('tx_id', txId)
      : await supabase.from('accounts').insert(payload);

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    notifyTeam(
      isEditing ? 'Transaction edited' : 'New transaction',
      `${form.type} · ${form.direction} ${formatMoney(num(form.amountEur))}`,
      '/accounts'
    );

    router.push('/accounts');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 grid gap-3.5 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-3.5">
        <label className="field-label">
          Date *
          <input
            className="field-input"
            type="date"
            required
            value={form.txDate}
            onChange={(e) => setField('txDate', e.target.value)}
          />
        </label>

        <label className="field-label">
          Direction *
          <select
            className="field-input"
            value={form.direction}
            onChange={(e) => setField('direction', e.target.value as FormState['direction'])}
          >
            <option value="In">In (Income)</option>
            <option value="Out">Out (Expense)</option>
          </select>
        </label>

        <label className="field-label">
          Type *
          <input
            className="field-input"
            required
            placeholder="Sale, Purchase, Refund, Fee..."
            value={form.type}
            onChange={(e) => setField('type', e.target.value)}
          />
        </label>

        <label className="field-label">
          Category *
          <input
            className="field-input"
            required
            placeholder="eBay Sales, Inventory, Returns..."
            value={form.category}
            onChange={(e) => setField('category', e.target.value)}
          />
        </label>

        <label className="field-label">
          Amount (EUR) *
          <input
            className="field-input"
            type="number"
            min="0"
            step="0.01"
            required
            value={form.amountEur}
            onChange={(e) => setField('amountEur', e.target.value)}
          />
        </label>

        {settings?.vatRegistered && (
          <label className="field-label">
            VAT Rate %
            <input
              className="field-input"
              type="number"
              step="0.01"
              value={form.vatRatePercent}
              onChange={(e) => setField('vatRatePercent', e.target.value)}
            />
          </label>
        )}

        <label className="field-label sm:col-span-2">
          Notes
          <textarea
            className="field-input"
            rows={3}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </label>
      </div>

      {settings?.vatRegistered && vatAmountEur != null && (
        <p className="text-muted text-sm">VAT amount: {formatMoney(vatAmountEur)}</p>
      )}

      {error && <p className="text-red font-semibold">{error}</p>}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : isEditing ? 'Update Transaction' : 'Save Transaction'}
        </button>
      </div>
    </form>
  );
}

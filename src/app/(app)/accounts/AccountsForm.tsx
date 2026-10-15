'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchSettings } from '@/lib/settings';
import { calculateVatAmount } from '@/lib/vat';
import { formatMoney } from '@/lib/format';
import type { AccountTx, Settings } from '@/lib/types';
import { notifyTeam } from '@/lib/notify';

const TYPE_PRESETS = [
  'Sale',
  'Purchase',
  'Refund',
  'Return',
  'Fees',
  'Fee VAT',
  'Shipping',
  'Adjustment',
  'Expense',
  'Other'
];

const CATEGORY_PRESETS = [
  'eBay Sales',
  'Inventory',
  'Returns',
  'Packing Material',
  'Shipping',
  'Fees',
  'Advertising',
  'Software',
  'Office',
  'Taxes',
  'Other'
];

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

function mergeOptions(presets: string[], saved: (string | null)[]) {
  const seen = new Set(presets.map((option) => option.toLowerCase()));
  const extra: string[] = [];
  for (const value of saved) {
    const trimmed = value?.trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      extra.push(trimmed);
    }
  }
  return [...presets, ...extra.sort((a, b) => a.localeCompare(b))];
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
  // New transactions are entered as a list of rows; editing always has exactly one.
  const [rows, setRows] = useState<FormState[]>(() => [initialState(tx)]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [typeOptions, setTypeOptions] = useState<string[]>(TYPE_PRESETS);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(CATEGORY_PRESETS);

  // Every type or category ever saved joins the presets, so new ones appear in the list by themselves.
  useEffect(() => {
    supabase
      .from('accounts')
      .select('type, category')
      .then(({ data }) => {
        const saved = (data || []) as { type: string | null; category: string | null }[];
        setTypeOptions(mergeOptions(TYPE_PRESETS, saved.map((row) => row.type)));
        setCategoryOptions(mergeOptions(CATEGORY_PRESETS, saved.map((row) => row.category)));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSettings(supabase).then((loaded) => {
      setSettings(loaded);
      setRows((prev) =>
        tx ? prev : prev.map((row) => ({ ...row, vatRatePercent: String(loaded.vatRatePercent) }))
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setRowField<K extends keyof FormState>(index: number, key: K, value: FormState[K]) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  // The next row starts from the last one, so only amount and notes usually need typing.
  function addRow() {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      return [...prev, { ...last, amountEur: '', notes: '' }];
    });
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function vatAmountFor(row: FormState) {
    return settings?.vatRegistered ? calculateVatAmount(num(row.amountEur), num(row.vatRatePercent)) : null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const stamp = Date.now().toString(36).toUpperCase();

    const payloads = rows.map((row, index) => {
      const txId = tx?.tx_id || (rows.length === 1 ? `ACC-${stamp}` : `ACC-${stamp}-${index + 1}`);
      return {
        tx_id: txId,
        tx_date: row.txDate,
        type: row.type,
        category: row.category,
        amount_eur: num(row.amountEur),
        direction: row.direction,
        vat_rate_percent: settings?.vatRegistered ? num(row.vatRatePercent) : tx?.vat_rate_percent ?? null,
        vat_amount_eur: settings?.vatRegistered ? vatAmountFor(row) : tx?.vat_amount_eur ?? null,
        notes: row.notes || null
      };
    });

    const { error: saveError } = isEditing
      ? await supabase.from('accounts').update(payloads[0]).eq('tx_id', payloads[0].tx_id)
      : await supabase.from('accounts').insert(payloads);

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    if (isEditing) {
      notifyTeam(
        'Transaction edited',
        `${rows[0].type} · ${rows[0].direction} ${formatMoney(num(rows[0].amountEur))}`,
        `/accounts/${payloads[0].tx_id}/edit`
      );
    } else if (payloads.length === 1) {
      notifyTeam(
        'New transaction',
        `${rows[0].type} · ${rows[0].direction} ${formatMoney(num(rows[0].amountEur))}`,
        `/accounts/${payloads[0].tx_id}/edit`
      );
    } else {
      notifyTeam('New transactions', `${payloads.length} transactions added`, '/accounts');
    }

    router.push('/accounts');
    router.refresh();
  }

  const multiple = rows.length > 1;

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 max-w-2xl">
      {rows.map((row, index) => {
        const vatAmountEur = vatAmountFor(row);
        return (
          <div key={index} className="card p-5 grid gap-3.5">
            {!isEditing && (
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm">Transaction {index + 1}</strong>
                {multiple && (
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="text-xs font-bold text-red border border-border rounded px-2.5 py-1.5"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3.5">
              <label className="field-label">
                Date *
                <input
                  className="field-input"
                  type="date"
                  required
                  value={row.txDate}
                  onChange={(e) => setRowField(index, 'txDate', e.target.value)}
                />
              </label>

              <label className="field-label">
                Direction *
                <select
                  className="field-input"
                  value={row.direction}
                  onChange={(e) => setRowField(index, 'direction', e.target.value as FormState['direction'])}
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
                  list="typeOptions"
                  placeholder="Select or type a type"
                  value={row.type}
                  onChange={(e) => setRowField(index, 'type', e.target.value)}
                />
              </label>

              <label className="field-label">
                Category *
                <input
                  className="field-input"
                  required
                  list="categoryOptions"
                  placeholder="Select or type a category"
                  value={row.category}
                  onChange={(e) => setRowField(index, 'category', e.target.value)}
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
                  value={row.amountEur}
                  onChange={(e) => setRowField(index, 'amountEur', e.target.value)}
                />
              </label>

              {settings?.vatRegistered && (
                <label className="field-label">
                  VAT Rate %
                  <input
                    className="field-input"
                    type="number"
                    step="0.01"
                    value={row.vatRatePercent}
                    onChange={(e) => setRowField(index, 'vatRatePercent', e.target.value)}
                  />
                </label>
              )}

              <label className="field-label sm:col-span-2">
                Notes
                <textarea
                  className="field-input"
                  rows={multiple ? 2 : 3}
                  value={row.notes}
                  onChange={(e) => setRowField(index, 'notes', e.target.value)}
                />
              </label>
            </div>

            {settings?.vatRegistered && vatAmountEur != null && (
              <p className="text-muted text-sm m-0">VAT amount: {formatMoney(vatAmountEur)}</p>
            )}
          </div>
        );
      })}

      <datalist id="typeOptions">
        {typeOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <datalist id="categoryOptions">
        {categoryOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>

      {error && <p className="text-red font-semibold m-0">{error}</p>}

      <div className="flex flex-wrap justify-between gap-2.5">
        {!isEditing ? (
          <button type="button" className="btn-secondary" onClick={addRow} disabled={saving}>
            + Add Another Transaction
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving
            ? 'Saving...'
            : isEditing
              ? 'Update Transaction'
              : multiple
                ? `Save ${rows.length} Transactions`
                : 'Save Transaction'}
        </button>
      </div>
    </form>
  );
}

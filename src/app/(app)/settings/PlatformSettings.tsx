'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SalesPlatform } from '@/lib/types';

type Row = {
  code: string;
  label: string;
  selling_fee_percent: string;
  payment_fee_percent: string;
  fixed_payment_fee_eur: string;
};

function toRow(platform: SalesPlatform): Row {
  return {
    code: platform.code,
    label: platform.label,
    selling_fee_percent: String(platform.selling_fee_percent),
    payment_fee_percent: String(platform.payment_fee_percent),
    fixed_payment_fee_eur: String(platform.fixed_payment_fee_eur)
  };
}

const EMPTY_ROW: Row = {
  code: '',
  label: '',
  selling_fee_percent: '0',
  payment_fee_percent: '0',
  fixed_payment_fee_eur: '0'
};

function num(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function PlatformSettings() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [newRow, setNewRow] = useState<Row>(EMPTY_ROW);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const { data } = await supabase
      .from('sales_platforms')
      .select('code, label, selling_fee_percent, payment_fee_percent, fixed_payment_fee_eur')
      .order('label');
    setRows(((data as SalesPlatform[]) || []).map(toRow));
  }

  useEffect(() => {
    load();
  }, []);

  function updateRow(index: number, field: keyof Row, value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function saveRow(row: Row) {
    setSaving(true);
    setError('');

    const { data: workspaceId } = await supabase.rpc('current_workspace_id');

    const { error: saveError } = await supabase.from('sales_platforms').upsert(
      {
        workspace_id: workspaceId,
        code: row.code,
        label: row.label,
        selling_fee_percent: num(row.selling_fee_percent),
        payment_fee_percent: num(row.payment_fee_percent),
        fixed_payment_fee_eur: num(row.fixed_payment_fee_eur)
      },
      { onConflict: 'workspace_id,code' }
    );

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    load();
  }

  async function removeRow(code: string) {
    setError('');
    const { error: deleteError } = await supabase.from('sales_platforms').delete().eq('code', code);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    load();
  }

  async function addRow() {
    if (!newRow.code || !newRow.label) return;
    await saveRow(newRow);
    setNewRow(EMPTY_ROW);
  }

  return (
    <div className="card p-5 grid gap-3.5">
      <div>
        <h2 className="font-bold text-base">Sales Platforms</h2>
        <p className="text-muted text-sm">
          Each platform (eBay, Amazon, TikTok, ...) has its own selling fee % and payment fee %.
          Product forms pick from this list.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
              <th className="p-2">Code</th>
              <th className="p-2">Label</th>
              <th className="p-2">Selling Fee %</th>
              <th className="p-2">Payment Fee %</th>
              <th className="p-2">Fixed Fee €</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.code} className="border-b border-border">
                <td className="p-2 font-mono text-xs">{row.code}</td>
                <td className="p-2">
                  <input
                    className="field-input py-1"
                    value={row.label}
                    onChange={(e) => updateRow(index, 'label', e.target.value)}
                    onBlur={() => saveRow(rows[index])}
                  />
                </td>
                <td className="p-2">
                  <input
                    className="field-input py-1 max-w-[100px]"
                    type="number"
                    step="0.001"
                    value={row.selling_fee_percent}
                    onChange={(e) => updateRow(index, 'selling_fee_percent', e.target.value)}
                    onBlur={() => saveRow(rows[index])}
                  />
                </td>
                <td className="p-2">
                  <input
                    className="field-input py-1 max-w-[100px]"
                    type="number"
                    step="0.001"
                    value={row.payment_fee_percent}
                    onChange={(e) => updateRow(index, 'payment_fee_percent', e.target.value)}
                    onBlur={() => saveRow(rows[index])}
                  />
                </td>
                <td className="p-2">
                  <input
                    className="field-input py-1 max-w-[100px]"
                    type="number"
                    step="0.01"
                    value={row.fixed_payment_fee_eur}
                    onChange={(e) => updateRow(index, 'fixed_payment_fee_eur', e.target.value)}
                    onBlur={() => saveRow(rows[index])}
                  />
                </td>
                <td className="p-2">
                  <button
                    type="button"
                    className="text-red font-bold px-2"
                    onClick={() => removeRow(row.code)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td className="p-2">
                <input
                  className="field-input py-1"
                  placeholder="Amazon_US"
                  value={newRow.code}
                  onChange={(e) => setNewRow((prev) => ({ ...prev, code: e.target.value }))}
                />
              </td>
              <td className="p-2">
                <input
                  className="field-input py-1"
                  placeholder="Amazon USA"
                  value={newRow.label}
                  onChange={(e) => setNewRow((prev) => ({ ...prev, label: e.target.value }))}
                />
              </td>
              <td className="p-2">
                <input
                  className="field-input py-1 max-w-[100px]"
                  type="number"
                  step="0.001"
                  value={newRow.selling_fee_percent}
                  onChange={(e) => setNewRow((prev) => ({ ...prev, selling_fee_percent: e.target.value }))}
                />
              </td>
              <td className="p-2">
                <input
                  className="field-input py-1 max-w-[100px]"
                  type="number"
                  step="0.001"
                  value={newRow.payment_fee_percent}
                  onChange={(e) => setNewRow((prev) => ({ ...prev, payment_fee_percent: e.target.value }))}
                />
              </td>
              <td className="p-2">
                <input
                  className="field-input py-1 max-w-[100px]"
                  type="number"
                  step="0.01"
                  value={newRow.fixed_payment_fee_eur}
                  onChange={(e) => setNewRow((prev) => ({ ...prev, fixed_payment_fee_eur: e.target.value }))}
                />
              </td>
              <td className="p-2">
                <button type="button" className="btn-secondary py-1 px-2 text-xs" onClick={addRow}>
                  + Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {saving && <p className="text-muted text-sm">Saving...</p>}
      {error && <p className="text-red font-semibold text-sm">{error}</p>}
    </div>
  );
}

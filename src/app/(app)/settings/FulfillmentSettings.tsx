'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { FulfillmentModel } from '@/lib/types';

type Row = {
  code: string;
  label: string;
  fulfillment_fee_eur: string;
  storage_fee_eur_per_month: string;
};

function toRow(model: FulfillmentModel): Row {
  return {
    code: model.code,
    label: model.label,
    fulfillment_fee_eur: String(model.fulfillment_fee_eur),
    storage_fee_eur_per_month: String(model.storage_fee_eur_per_month)
  };
}

const EMPTY_ROW: Row = {
  code: '',
  label: '',
  fulfillment_fee_eur: '0',
  storage_fee_eur_per_month: '0'
};

function num(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function FulfillmentSettings() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [newRow, setNewRow] = useState<Row>(EMPTY_ROW);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const { data } = await supabase
      .from('fulfillment_models')
      .select('code, label, fulfillment_fee_eur, storage_fee_eur_per_month')
      .order('label');
    setRows(((data as FulfillmentModel[]) || []).map(toRow));
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

    const { error: saveError } = await supabase.from('fulfillment_models').upsert(
      {
        workspace_id: workspaceId,
        code: row.code,
        label: row.label,
        fulfillment_fee_eur: num(row.fulfillment_fee_eur),
        storage_fee_eur_per_month: num(row.storage_fee_eur_per_month)
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
    const { error: deleteError } = await supabase.from('fulfillment_models').delete().eq('code', code);

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
        <h2 className="font-bold text-base">Fulfillment Models</h2>
        <p className="text-muted text-sm">
          How an order ships — Self, Dropship, Amazon FBA, TikTok Fulfillment, 3PL, etc. Each has its
          own per-unit fulfillment fee and monthly storage fee. Product forms pick from this list.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
              <th className="p-2">Code</th>
              <th className="p-2">Label</th>
              <th className="p-2">Fulfillment Fee €</th>
              <th className="p-2">Storage Fee €/month</th>
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
                    className="field-input py-1 max-w-[110px]"
                    type="number"
                    step="0.01"
                    value={row.fulfillment_fee_eur}
                    onChange={(e) => updateRow(index, 'fulfillment_fee_eur', e.target.value)}
                    onBlur={() => saveRow(rows[index])}
                  />
                </td>
                <td className="p-2">
                  <input
                    className="field-input py-1 max-w-[110px]"
                    type="number"
                    step="0.01"
                    value={row.storage_fee_eur_per_month}
                    onChange={(e) => updateRow(index, 'storage_fee_eur_per_month', e.target.value)}
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
                  placeholder="3PL_EU"
                  value={newRow.code}
                  onChange={(e) => setNewRow((prev) => ({ ...prev, code: e.target.value }))}
                />
              </td>
              <td className="p-2">
                <input
                  className="field-input py-1"
                  placeholder="3PL Europe"
                  value={newRow.label}
                  onChange={(e) => setNewRow((prev) => ({ ...prev, label: e.target.value }))}
                />
              </td>
              <td className="p-2">
                <input
                  className="field-input py-1 max-w-[110px]"
                  type="number"
                  step="0.01"
                  value={newRow.fulfillment_fee_eur}
                  onChange={(e) => setNewRow((prev) => ({ ...prev, fulfillment_fee_eur: e.target.value }))}
                />
              </td>
              <td className="p-2">
                <input
                  className="field-input py-1 max-w-[110px]"
                  type="number"
                  step="0.01"
                  value={newRow.storage_fee_eur_per_month}
                  onChange={(e) =>
                    setNewRow((prev) => ({ ...prev, storage_fee_eur_per_month: e.target.value }))
                  }
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

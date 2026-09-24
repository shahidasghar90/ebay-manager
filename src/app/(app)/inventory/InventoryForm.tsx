'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { InventoryItem, Product } from '@/lib/types';
import { notifyTeam } from '@/lib/notify';

type FormState = {
  sku: string;
  variant: string;
  inventoryType: 'On Hand' | 'Dropship' | 'Virtual';
  locationBin: string;
  quantityOnHand: string;
  quantityReserved: string;
  reorderLevel: string;
  leadTimeDays: string;
  lastRestockDate: string;
  notes: string;
};

function initialState(item?: InventoryItem): FormState {
  return {
    sku: item?.sku || '',
    variant: item?.variant || '',
    inventoryType: item?.inventory_type || 'On Hand',
    locationBin: item?.location_bin || '',
    quantityOnHand: String(item?.quantity_on_hand ?? 0),
    quantityReserved: String(item?.quantity_reserved ?? 0),
    reorderLevel: String(item?.reorder_level ?? 0),
    leadTimeDays: String(item?.lead_time_days ?? ''),
    lastRestockDate: item?.last_restock_date || '',
    notes: item?.notes || ''
  };
}

function num(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function InventoryForm({
  item,
  products
}: {
  item?: InventoryItem;
  products: Product[];
}) {
  const isEditing = !!item;
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<FormState>(() => initialState(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const product = products.find((p) => p.sku === form.sku);

    const payload = {
      sku: form.sku,
      product_name: product?.product_name || item?.product_name || '',
      variant: form.variant || null,
      inventory_type: form.inventoryType,
      location_bin: form.locationBin || null,
      quantity_on_hand: num(form.quantityOnHand),
      quantity_reserved: num(form.quantityReserved),
      reorder_level: num(form.reorderLevel),
      supplier_name: product?.supplier_name || null,
      supplier_link: product?.supplier_link || null,
      lead_time_days: num(form.leadTimeDays),
      last_restock_date: form.lastRestockDate || null,
      notes: form.notes || null
    };

    const { error: saveError } = isEditing
      ? await supabase.from('inventory').update(payload).eq('id', item!.id)
      : await supabase.from('inventory').insert(payload);

    if (saveError) {
      if (!isEditing && saveError.code === '23505') {
        setError('An inventory record for this SKU already exists — edit it instead of creating a new one.');
      } else {
        setError(saveError.message);
      }
      setSaving(false);
      return;
    }

    notifyTeam(
      isEditing ? 'Inventory edited' : 'New inventory record',
      `${payload.sku} · ${payload.product_name}`,
      '/inventory'
    );

    router.push('/inventory');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 grid gap-3.5">
      <div className="grid sm:grid-cols-2 gap-3.5">
        <label className="field-label">
          SKU *
          <select
            className="field-input"
            required
            value={form.sku}
            onChange={(e) => setField('sku', e.target.value)}
            disabled={isEditing}
          >
            <option value="">Select a product</option>
            {products.map((product) => (
              <option key={product.sku} value={product.sku}>
                {product.sku} — {product.product_name}
              </option>
            ))}
          </select>
        </label>

        <label className="field-label">
          Variant
          <input
            className="field-input"
            value={form.variant}
            onChange={(e) => setField('variant', e.target.value)}
          />
        </label>

        <label className="field-label">
          Inventory Type *
          <select
            className="field-input"
            value={form.inventoryType}
            onChange={(e) => setField('inventoryType', e.target.value as FormState['inventoryType'])}
          >
            <option value="On Hand">On Hand</option>
            <option value="Dropship">Dropship</option>
            <option value="Virtual">Virtual</option>
          </select>
        </label>

        <label className="field-label">
          Location / Bin
          <input
            className="field-input"
            value={form.locationBin}
            onChange={(e) => setField('locationBin', e.target.value)}
          />
        </label>

        <label className="field-label">
          Quantity On Hand
          <input
            className="field-input"
            type="number"
            min="0"
            value={form.quantityOnHand}
            onChange={(e) => setField('quantityOnHand', e.target.value)}
          />
        </label>

        <label className="field-label">
          Quantity Reserved
          <input
            className="field-input"
            type="number"
            min="0"
            value={form.quantityReserved}
            onChange={(e) => setField('quantityReserved', e.target.value)}
          />
        </label>

        <label className="field-label">
          Reorder Level
          <input
            className="field-input"
            type="number"
            min="0"
            value={form.reorderLevel}
            onChange={(e) => setField('reorderLevel', e.target.value)}
          />
        </label>

        <label className="field-label">
          Lead Time (days)
          <input
            className="field-input"
            type="number"
            min="0"
            value={form.leadTimeDays}
            onChange={(e) => setField('leadTimeDays', e.target.value)}
          />
        </label>

        <label className="field-label">
          Last Restock Date
          <input
            className="field-input"
            type="date"
            value={form.lastRestockDate}
            onChange={(e) => setField('lastRestockDate', e.target.value)}
          />
        </label>

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

      {error && <p className="text-red font-semibold">{error}</p>}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : isEditing ? 'Update Inventory Item' : 'Save Inventory Item'}
        </button>
      </div>
    </form>
  );
}

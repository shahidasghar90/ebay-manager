'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const initial = {
  keyword: '',
  productTitle: '',
  category: '',
  potentialModel: 'Stock' as 'Stock' | 'Dropship' | 'Used',
  currency: 'EUR' as 'EUR' | 'USD' | 'PKR',
  productPriceLocal: '',
  shippingLocal: '',
  mainListingUrl: '',
  imageUrl: '',
  notes: ''
};

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default function ResearchForm() {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setField<K extends keyof typeof initial>(key: K, value: (typeof initial)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const { error: insertError } = await supabase.from('product_research').insert({
      keyword: form.keyword,
      product_title: form.productTitle || null,
      category: form.category || null,
      potential_model: form.potentialModel,
      currency: form.currency,
      product_price_local: Number(form.productPriceLocal) || 0,
      shipping_local: Number(form.shippingLocal) || 0,
      main_listing_url: normalizeUrl(form.mainListingUrl),
      image_url: normalizeUrl(form.imageUrl),
      notes: form.notes || null
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setForm(initial);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 grid gap-3.5">
      <p className="text-muted text-sm -mt-1 mb-1">
        Quick capture for a sourcing idea. Fill it out later as a full Product once it&apos;s worth pursuing.
      </p>

      <div className="grid sm:grid-cols-2 gap-3.5">
        <label className="field-label">
          Search Keyword *
          <input
            className="field-input"
            required
            value={form.keyword}
            onChange={(e) => setField('keyword', e.target.value)}
            placeholder="e.g. USB desk fan"
          />
        </label>

        <label className="field-label">
          Product Title
          <input
            className="field-input"
            value={form.productTitle}
            onChange={(e) => setField('productTitle', e.target.value)}
          />
        </label>

        <label className="field-label">
          Potential Model *
          <select
            className="field-input"
            value={form.potentialModel}
            onChange={(e) => setField('potentialModel', e.target.value as typeof form.potentialModel)}
          >
            <option value="Stock">Stock</option>
            <option value="Dropship">Dropship</option>
            <option value="Used">Used</option>
          </select>
        </label>

        <label className="field-label">
          Currency
          <select
            className="field-input"
            value={form.currency}
            onChange={(e) => setField('currency', e.target.value as typeof form.currency)}
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="PKR">PKR</option>
          </select>
        </label>

        <label className="field-label">
          Product Price
          <input
            className="field-input"
            type="number"
            min="0"
            step="0.01"
            value={form.productPriceLocal}
            onChange={(e) => setField('productPriceLocal', e.target.value)}
          />
        </label>

        <label className="field-label">
          Shipping Price
          <input
            className="field-input"
            type="number"
            min="0"
            step="0.01"
            value={form.shippingLocal}
            onChange={(e) => setField('shippingLocal', e.target.value)}
          />
        </label>

        <label className="field-label sm:col-span-2">
          Main Listing / Supplier URL
          <input
            className="field-input"
            type="url"
            value={form.mainListingUrl}
            onChange={(e) => setField('mainListingUrl', e.target.value)}
          />
        </label>

        <label className="field-label sm:col-span-2">
          Image URL
          <input
            className="field-input"
            type="url"
            value={form.imageUrl}
            onChange={(e) => setField('imageUrl', e.target.value)}
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
          {saving ? 'Saving...' : 'Save Research'}
        </button>
      </div>
    </form>
  );
}

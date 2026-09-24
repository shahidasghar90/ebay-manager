'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { compressImage } from '@/lib/compressImage';
import { createClient } from '@/lib/supabase/client';
import type { ResearchItem } from '@/lib/types';
import { notifyTeam } from '@/lib/notify';

type FormState = {
  keyword: string;
  productTitle: string;
  category: string;
  potentialModel: 'Stock' | 'Dropship' | 'Used';
  currency: 'EUR' | 'USD' | 'PKR' | 'CNY';
  productPriceLocal: string;
  shippingLocal: string;
  moq: string;
  mainListingUrl: string;
  imageUrl: string;
  competitorPrices: { platform: string; price: string }[];
  notes: string;
};

const initial: FormState = {
  keyword: '',
  productTitle: '',
  category: '',
  potentialModel: 'Stock',
  currency: 'EUR',
  productPriceLocal: '',
  shippingLocal: '',
  moq: '1',
  mainListingUrl: '',
  imageUrl: '',
  competitorPrices: [],
  notes: ''
};

function stateFromResearch(research?: ResearchItem): FormState {
  if (!research) return initial;
  return {
    keyword: research.keyword,
    productTitle: research.product_title || '',
    category: research.category || '',
    potentialModel: research.potential_model,
    currency: research.currency,
    productPriceLocal: String(research.product_price_local ?? ''),
    shippingLocal: String(research.shipping_local ?? ''),
    moq: String(research.moq ?? 1),
    mainListingUrl: research.main_listing_url || '',
    imageUrl: research.image_url || '',
    competitorPrices: (research.competitor_prices || []).map((row) => ({
      platform: row.platform,
      price: String(row.price)
    })),
    notes: research.notes || ''
  };
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default function ResearchForm({
  research,
  onSaved
}: {
  research?: ResearchItem;
  onSaved?: () => void;
}) {
  const isEditing = !!research;
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState<FormState>(() => stateFromResearch(research));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  function setField<K extends keyof typeof initial>(key: K, value: (typeof initial)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addCompetitorPrice() {
    setForm((prev) => ({
      ...prev,
      competitorPrices: [...prev.competitorPrices, { platform: '', price: '' }]
    }));
  }

  function updateCompetitorPrice(index: number, field: 'platform' | 'price', value: string) {
    setForm((prev) => ({
      ...prev,
      competitorPrices: prev.competitorPrices.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      )
    }));
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;

    setUploading(true);
    setError('');

    const file = await compressImage(picked);
    const folder = form.keyword.replace(/[\\/:*?"<>|]/g, '-') || 'Uncategorized';
    const path = `research/${folder}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(path, file, { upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(path);
    setField('imageUrl', publicUrlData.publicUrl);
    setUploading(false);
  }

  function removeCompetitorPrice(index: number) {
    setForm((prev) => ({
      ...prev,
      competitorPrices: prev.competitorPrices.filter((_, i) => i !== index)
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      keyword: form.keyword,
      product_title: form.productTitle || null,
      category: form.category || null,
      potential_model: form.potentialModel,
      currency: form.currency,
      product_price_local: Number(form.productPriceLocal) || 0,
      shipping_local: Number(form.shippingLocal) || 0,
      moq: Number(form.moq) || 1,
      main_listing_url: normalizeUrl(form.mainListingUrl),
      image_url: normalizeUrl(form.imageUrl),
      competitor_prices: form.competitorPrices
        .filter((row) => row.platform && Number(row.price) > 0)
        .map((row) => ({ platform: row.platform, price: Number(row.price) })),
      notes: form.notes || null
    };

    const { data: saved, error: saveError } = isEditing
      ? await supabase.from('product_research').update(payload).eq('id', research!.id).select('id').single()
      : await supabase.from('product_research').insert(payload).select('id').single();

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    notifyTeam(
      isEditing ? 'Research edited' : 'New product research',
      form.keyword,
      saved ? `/research/${saved.id}` : '/research'
    );

    if (isEditing) {
      router.push('/research');
      router.refresh();
      return;
    }

    setForm(initial);
    router.refresh();
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 grid gap-3.5">
      <p className="text-muted text-sm -mt-1 mb-1">
        {isEditing
          ? 'Update this sourcing idea.'
          : "Quick capture for a sourcing idea. Fill it out later as a full Product once it's worth pursuing."}
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
            <option value="CNY">CNY</option>
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

        <label className="field-label">
          Units (MOQ)
          <input
            className="field-input"
            type="number"
            min="1"
            step="1"
            value={form.moq}
            onChange={(e) => setField('moq', e.target.value)}
            placeholder="1"
          />
          {Number(form.productPriceLocal) > 0 && Number(form.moq) > 1 && (
            <small className="text-muted font-normal text-[11px] -mt-0.5">
              ≈ {(Number(form.productPriceLocal) / Number(form.moq)).toFixed(2)} {form.currency} per unit
            </small>
          )}
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

        <div className="field-label sm:col-span-2">
          Image URL
          <div className="flex flex-wrap sm:flex-nowrap gap-2 items-start">
            <input
              className="field-input basis-full sm:basis-auto"
              type="url"
              value={form.imageUrl}
              onChange={(e) => setField('imageUrl', e.target.value)}
              placeholder="Paste an image URL or upload below"
            />
            <label className="btn-secondary whitespace-nowrap cursor-pointer">
              📷 Camera
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={uploading}
                onChange={handleImageUpload}
              />
            </label>
            <label className="btn-secondary whitespace-nowrap cursor-pointer">
              {uploading ? 'Uploading...' : 'Upload'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={handleImageUpload}
              />
            </label>
          </div>
          {form.imageUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={form.imageUrl}
              alt="Preview"
              onClick={() => setPreviewOpen(true)}
              className="mt-2 w-[72px] h-[72px] object-cover rounded-lg border border-border cursor-zoom-in"
            />
          )}
        </div>

        <div className="field-label sm:col-span-2">
          Competitor Prices (other platforms)
          <div className="grid gap-2 mt-1">
            {form.competitorPrices.map((row, index) => (
              <div key={index} className="flex gap-2">
                <input
                  className="field-input"
                  placeholder="Platform (e.g. Amazon.de)"
                  value={row.platform}
                  onChange={(e) => updateCompetitorPrice(index, 'platform', e.target.value)}
                />
                <input
                  className="field-input max-w-[140px]"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price"
                  value={row.price}
                  onChange={(e) => updateCompetitorPrice(index, 'price', e.target.value)}
                />
                <button
                  type="button"
                  className="text-red font-bold px-2"
                  onClick={() => removeCompetitorPrice(index)}
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="btn-secondary w-fit" onClick={addCompetitorPrice}>
              + Add Competitor Price
            </button>
          </div>
        </div>

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

      <div className="flex justify-end gap-2">
        {isEditing ? (
          <button type="button" className="btn-secondary" onClick={() => router.push('/research')}>
            Cancel
          </button>
        ) : (
          onSaved && (
            <button type="button" className="btn-secondary" onClick={onSaved}>
              Cancel
            </button>
          )
        )}
        <button type="submit" className="btn-primary" disabled={saving || uploading}>
          {saving
            ? 'Saving...'
            : uploading
              ? 'Uploading image...'
              : isEditing
                ? 'Update Research'
                : 'Save Research'}
        </button>
      </div>

      {previewOpen && form.imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setPreviewOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={form.imageUrl}
            alt="Preview enlarged"
            className="max-w-full max-h-full rounded-lg"
          />
        </div>
      )}
    </form>
  );
}

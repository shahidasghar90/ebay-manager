'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { compressImage } from '@/lib/compressImage';
import { createClient } from '@/lib/supabase/client';
import { fetchSettings } from '@/lib/settings';
import { fetchSalesPlatforms, fetchFulfillmentModels } from '@/lib/platformConfig';
import { calculatePricing } from '@/lib/pricing';
import { calculateVatAmount } from '@/lib/vat';
import { formatMoney } from '@/lib/format';
import type { Product, ResearchItem, Settings, SalesPlatform, FulfillmentModel } from '@/lib/types';
import { notifyTeam } from '@/lib/notify';

const CATEGORY_PRESETS = [
  'Electronics',
  'Audio',
  'Cables',
  'Computer Parts',
  'Mobile Accessories',
  'Home & Garden',
  'Kitchen',
  'Tools',
  'Toys',
  'Clothing',
  'Sports & Outdoors',
  'Automotive',
  'Other'
];

type FormState = {
  sku: string;
  productName: string;
  category: string;
  condition: 'New' | 'Used' | 'Refurbished';
  businessModel: string;
  productStatus: string;
  salesPlatform: string;
  supplierName: string;
  supplierPlatform: string;
  supplierLink: string;
  mainEbayListingUrl: string;
  currency: 'EUR' | 'USD' | 'PKR' | 'CNY';
  purchasePriceLocal: string;
  shippingLocal: string;
  customsEur: string;
  packagingEur: string;
  refurbishmentEur: string;
  dropshipCustomerShippingEur: string;
  dropshipHandlingFeeEur: string;
  fulfillmentFeeEur: string;
  storageFeeEurPerMonth: string;
  currentSalePriceEur: string;
  targetProfitPercent: string;
  supplierMoq: string;
  leadTimeDays: string;
  dropshipSupported: boolean;
  acquisitionSource: string;
  acquisitionDate: string;
  notes: string;
};

function initialStateFromProduct(product?: Product, research?: ResearchItem): FormState {
  if (research) {
    return {
      sku: '',
      productName: research.product_title || research.keyword,
      category: research.category || '',
      condition: research.potential_model === 'Used' ? 'Used' : 'New',
      businessModel: research.potential_model === 'Used' ? 'Stock' : research.potential_model,
      productStatus: 'Research',
      salesPlatform: 'eBay_DE',
      supplierName: research.seller_supplier || '',
      supplierPlatform: research.supplier_platform || '',
      supplierLink: research.main_listing_url || '',
      mainEbayListingUrl: '',
      currency: research.currency || 'EUR',
      purchasePriceLocal: String(research.product_price_local ?? ''),
      shippingLocal: String(research.shipping_local ?? ''),
      customsEur: '',
      packagingEur: '',
      refurbishmentEur: '',
      dropshipCustomerShippingEur: '',
      dropshipHandlingFeeEur: '',
      fulfillmentFeeEur: '',
      storageFeeEurPerMonth: '',
      currentSalePriceEur: '',
      targetProfitPercent: '0.25',
      supplierMoq: String(research.moq ?? 1),
      leadTimeDays: String(research.lead_time_days ?? ''),
      dropshipSupported: research.dropship_available ?? false,
      acquisitionSource: research.seller_supplier || '',
      acquisitionDate: '',
      notes: research.notes || ''
    };
  }

  return {
    sku: product?.sku || '',
    productName: product?.product_name || '',
    category: product?.category || '',
    condition: product?.condition || 'New',
    businessModel: product?.business_model || 'Stock',
    productStatus: product?.product_status || 'Research',
    salesPlatform: product?.sales_platform || 'eBay_DE',
    supplierName: product?.supplier_name || '',
    supplierPlatform: product?.supplier_platform || '',
    supplierLink: product?.supplier_link || '',
    mainEbayListingUrl: product?.main_ebay_listing_url || '',
    currency: (product?.source_currency as 'EUR' | 'USD' | 'PKR' | 'CNY') || 'EUR',
    purchasePriceLocal: String(
      product ? Number(product.purchase_price_local || 0) * (product.supplier_moq || 1) : ''
    ),
    shippingLocal: String(
      product ? Number(product.shipping_local || 0) * (product.supplier_moq || 1) : ''
    ),
    customsEur: String(product?.customs_eur ?? ''),
    packagingEur: String(product?.packaging_eur ?? ''),
    refurbishmentEur: String(product?.refurbishment_eur ?? ''),
    dropshipCustomerShippingEur: String(product?.dropship_customer_shipping_eur ?? ''),
    dropshipHandlingFeeEur: String(product?.dropship_handling_fee_eur ?? ''),
    fulfillmentFeeEur: String(product?.fulfillment_fee_eur ?? ''),
    storageFeeEurPerMonth: String(product?.storage_fee_eur_per_month ?? ''),
    currentSalePriceEur: String(product?.current_sale_price_eur ?? ''),
    targetProfitPercent: String(product?.target_profit_percent ?? 0.25),
    supplierMoq: String(product?.supplier_moq ?? 1),
    leadTimeDays: String(product?.lead_time_days ?? ''),
    dropshipSupported: product?.dropship_supported ?? false,
    acquisitionSource: product?.acquisition_source || '',
    acquisitionDate: product?.acquisition_date || '',
    notes: product?.notes || ''
  };
}

function num(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function ProductForm({
  product,
  research
}: {
  product?: Product;
  research?: ResearchItem;
}) {
  const isEditing = !!product;
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<FormState>(() => initialStateFromProduct(product, research));
  const [settings, setSettings] = useState<Settings>({
    fxRates: { EUR: 1, USD: 1.08, PKR: 310, CNY: 7.8 },
    ebayFeePercent: 0.129,
    paymentFeePercent: 0.029,
    fixedPaymentFeeEur: 0.35,
    vatRegistered: false,
    vatRatePercent: 19
  });
  const [images, setImages] = useState<{ url: string; path: string }[]>(() => {
    if (product?.image_urls?.length) {
      return product.image_urls.map((url, index) => ({
        url,
        path: product.image_file_ids?.[index] || ''
      }));
    }
    if (research?.image_url) {
      return [{ url: research.image_url, path: '' }];
    }
    return [];
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [salesPlatforms, setSalesPlatforms] = useState<SalesPlatform[]>([]);
  const [fulfillmentModels, setFulfillmentModels] = useState<FulfillmentModel[]>([]);

  useEffect(() => {
    fetchSettings(supabase).then(setSettings);
    fetchSalesPlatforms(supabase).then(setSalesPlatforms);
    fetchFulfillmentModels(supabase).then(setFulfillmentModels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const selectedPlatform = salesPlatforms.find((platform) => platform.code === form.salesPlatform);
  const selectedFulfillment = fulfillmentModels.find((model) => model.code === form.businessModel);

  function handleFulfillmentChange(code: string) {
    const model = fulfillmentModels.find((m) => m.code === code);
    setForm((prev) => ({
      ...prev,
      businessModel: code,
      fulfillmentFeeEur: model ? String(model.fulfillment_fee_eur) : prev.fulfillmentFeeEur,
      storageFeeEurPerMonth: model ? String(model.storage_fee_eur_per_month) : prev.storageFeeEurPerMonth
    }));
  }

  const unitsPerPurchase = num(form.supplierMoq) || 1;

  const pricing = useMemo(
    () =>
      calculatePricing({
        currency: form.currency,
        fxRates: settings.fxRates,
        purchasePriceLocal: num(form.purchasePriceLocal) / unitsPerPurchase,
        shippingLocal: num(form.shippingLocal) / unitsPerPurchase,
        customsEur: num(form.customsEur),
        packagingEur: num(form.packagingEur),
        refurbishmentEur: num(form.refurbishmentEur),
        dropshipCustomerShippingEur: num(form.dropshipCustomerShippingEur),
        dropshipHandlingFeeEur: num(form.dropshipHandlingFeeEur),
        fulfillmentFeeEur: num(form.fulfillmentFeeEur),
        storageFeeEurPerMonth: num(form.storageFeeEurPerMonth),
        ebayFeePercent: selectedPlatform?.selling_fee_percent ?? settings.ebayFeePercent,
        paymentFeePercent: selectedPlatform?.payment_fee_percent ?? settings.paymentFeePercent,
        fixedPaymentFeeEur: selectedPlatform?.fixed_payment_fee_eur ?? settings.fixedPaymentFeeEur,
        targetProfitPercent: num(form.targetProfitPercent),
        currentSalePriceEur: num(form.currentSalePriceEur)
      }),
    [form, settings, selectedPlatform]
  );

  const showRefurbishment = form.condition === 'Refurbished';
  const showDropshipFields = form.businessModel === 'Dropship' || form.businessModel === 'Hybrid';
  const showFulfillmentFields =
    (selectedFulfillment &&
      (selectedFulfillment.fulfillment_fee_eur > 0 || selectedFulfillment.storage_fee_eur_per_month > 0)) ||
    num(form.fulfillmentFeeEur) > 0 ||
    num(form.storageFeeEurPerMonth) > 0;

  async function handleImageSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';

    if (selected.length === 0) return;

    const remaining = 5 - images.length;

    if (remaining <= 0) {
      setError('Maximum 5 photos per product. Remove one before adding another.');
      return;
    }

    const files = selected.slice(0, remaining);

    setUploading(true);
    setError('');

    for (const original of files) {
      const file = await compressImage(original);
      const folder = [form.condition || 'Uncategorized', form.category || 'Uncategorized', form.productName || 'product']
        .map((segment) => segment.replace(/[\\/:*?"<>|]/g, '-'))
        .join('/');
      const path = `${folder}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, file, { upsert: false });

      if (uploadError) {
        setError(uploadError.message);
        continue;
      }

      const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(path);
      setImages((prev) => [...prev, { url: publicUrlData.publicUrl, path }]);
    }

    setUploading(false);
  }

  async function removeImage(index: number) {
    const image = images[index];
    setImages((prev) => prev.filter((_, i) => i !== index));

    if (image?.path) {
      const { error: removeError } = await supabase.storage
        .from('product-images')
        .remove([image.path]);

      if (removeError) {
        console.error('Failed to delete image from storage:', removeError.message);
      }
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const sku = form.sku || `SKU-${Date.now().toString(36).toUpperCase()}`;

    const payload = {
      sku,
      product_name: form.productName,
      category: form.category || null,
      condition: form.condition,
      business_model: form.businessModel,
      product_status: form.productStatus,
      sales_platform: form.salesPlatform,
      supplier_name: form.supplierName || null,
      supplier_platform: form.supplierPlatform || null,
      supplier_link: normalizeUrl(form.supplierLink),
      main_ebay_listing_url: normalizeUrl(form.mainEbayListingUrl),
      image_urls: images.map((image) => image.url),
      image_file_ids: images.map((image) => image.path),
      source_currency: form.currency,
      fx_rate: pricing.fxRate,
      purchase_price_local: num(form.purchasePriceLocal) / unitsPerPurchase,
      purchase_price_eur: pricing.purchasePriceEur,
      shipping_local: num(form.shippingLocal) / unitsPerPurchase,
      shipping_eur: pricing.shippingEur,
      customs_eur: num(form.customsEur),
      packaging_eur: num(form.packagingEur),
      refurbishment_eur: num(form.refurbishmentEur),
      dropship_customer_shipping_eur: num(form.dropshipCustomerShippingEur),
      dropship_handling_fee_eur: num(form.dropshipHandlingFeeEur),
      fulfillment_fee_eur: num(form.fulfillmentFeeEur),
      storage_fee_eur_per_month: num(form.storageFeeEurPerMonth),
      total_cost_eur: pricing.totalCostEur,
      ebay_fee_percent: selectedPlatform?.selling_fee_percent ?? settings.ebayFeePercent,
      payment_fee_percent: selectedPlatform?.payment_fee_percent ?? settings.paymentFeePercent,
      fixed_payment_fee_eur: selectedPlatform?.fixed_payment_fee_eur ?? settings.fixedPaymentFeeEur,
      target_profit_percent: num(form.targetProfitPercent),
      recommended_sale_price_eur: pricing.recommendedSalePriceEur,
      minimum_sale_price_eur: pricing.minimumSalePriceEur,
      current_sale_price_eur: num(form.currentSalePriceEur),
      estimated_ebay_fee_eur: pricing.estimatedEbayFeeEur,
      estimated_payment_fee_eur: pricing.estimatedPaymentFeeEur,
      estimated_net_profit_eur: pricing.estimatedNetProfitEur,
      estimated_profit_margin: pricing.estimatedProfitMargin,
      supplier_moq: num(form.supplierMoq) || 1,
      lead_time_days: num(form.leadTimeDays),
      dropship_supported: form.dropshipSupported,
      acquisition_source: form.acquisitionSource || null,
      acquisition_date: form.acquisitionDate || null,
      notes: form.notes || null,
      updated_at: new Date().toISOString()
    };

    const { error: saveError } = isEditing
      ? await supabase.from('products').update(payload).eq('sku', sku)
      : await supabase.from('products').insert(payload);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    if (!isEditing) {
      const { error: inventoryError } = await supabase.from('inventory').insert({
        sku,
        product_name: form.productName,
        inventory_type: 'On Hand',
        quantity_on_hand: 0,
        quantity_reserved: 0,
        reorder_level: 0
      });

      if (inventoryError) {
        console.error('Failed to auto-create inventory row:', inventoryError.message);
      }
    }

    if (!isEditing && research) {
      await supabase
        .from('product_research')
        .update({ final_sku: sku, research_status: 'Converted' })
        .eq('id', research.id);
    }

    if (!isEditing && pricing.totalCostEur > 0) {
      await supabase.from('accounts').insert({
        tx_id: `ACC-${Date.now().toString(36).toUpperCase()}`,
        type: 'Purchase',
        category: 'Inventory',
        amount_eur: pricing.totalCostEur,
        direction: 'Out',
        vat_rate_percent: settings.vatRegistered ? settings.vatRatePercent : null,
        vat_amount_eur: settings.vatRegistered
          ? calculateVatAmount(pricing.totalCostEur, settings.vatRatePercent)
          : null,
        notes: `Auto: purchase cost for ${sku} (${form.productName})`
      });
    }

    notifyTeam(
      isEditing ? 'Product edited' : 'New product',
      `${sku} · ${form.productName}`,
      `/products/${sku}`
    );

    router.push('/products');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <PreviewField label="Total Cost (per unit)" value={formatMoney(pricing.totalCostEur)} />
          <PreviewField label="Breakeven Price" value={formatMoney(pricing.minimumSalePriceEur)} />
          <PreviewField label="Recommended Price" value={formatMoney(pricing.recommendedSalePriceEur)} />
          <PreviewField
            label="Net Profit"
            value={formatMoney(pricing.estimatedNetProfitEur)}
            tone={pricing.estimatedNetProfitEur < 0 ? 'text-red' : 'text-green'}
          />
          <PreviewField
            label="Margin"
            value={`${(pricing.estimatedProfitMargin * 100).toFixed(1)}%`}
            tone={pricing.estimatedProfitMargin < 0 ? 'text-red' : 'text-green'}
          />
        </div>
      </div>

      <FormSection title="Basic Info">
        <label className="field-label">
          Product Name *
          <input
            className="field-input"
            required
            value={form.productName}
            onChange={(e) => setField('productName', e.target.value)}
          />
        </label>

        <label className="field-label">
          Category
          <input
            className="field-input"
            list="categoryOptions"
            value={form.category}
            onChange={(e) => setField('category', e.target.value)}
            placeholder="Select or type a new category"
          />
          <datalist id="categoryOptions">
            {CATEGORY_PRESETS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>

        <label className="field-label">
          Condition *
          <select
            className="field-input"
            value={form.condition}
            onChange={(e) => setField('condition', e.target.value as FormState['condition'])}
          >
            <option value="New">New</option>
            <option value="Used">Used</option>
            <option value="Refurbished">Refurbished</option>
          </select>
        </label>

        <label className="field-label">
          Product Status
          <select
            className="field-input"
            value={form.productStatus}
            onChange={(e) => setField('productStatus', e.target.value)}
          >
            <option value="Research">Research</option>
            <option value="Active">Active</option>
            <option value="Paused">Paused</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </label>
      </FormSection>

      <FormSection
        title="Platform & Fulfillment"
        hint="Where you sell it, and how it gets to the buyer."
      >
        <label className="field-label">
          Sales Platform *
          <select
            className="field-input"
            value={form.salesPlatform}
            onChange={(e) => setField('salesPlatform', e.target.value)}
          >
            {salesPlatforms.length === 0 && <option value={form.salesPlatform}>{form.salesPlatform}</option>}
            {salesPlatforms.map((platform) => (
              <option key={platform.code} value={platform.code}>
                {platform.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-label">
          Fulfillment Model *
          <select
            className="field-input"
            value={form.businessModel}
            onChange={(e) => handleFulfillmentChange(e.target.value)}
          >
            {fulfillmentModels.length === 0 && <option value={form.businessModel}>{form.businessModel}</option>}
            {fulfillmentModels.map((model) => (
              <option key={model.code} value={model.code}>
                {model.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-label sm:col-span-2">
          Main eBay Listing Link
          <input
            className="field-input"
            type="url"
            value={form.mainEbayListingUrl}
            onChange={(e) => setField('mainEbayListingUrl', e.target.value)}
            placeholder="https://www.ebay.de/itm/..."
          />
        </label>

        {showDropshipFields && (
          <>
            <NumberField
              label="Dropship Customer Shipping (EUR)"
              value={form.dropshipCustomerShippingEur}
              onChange={(v) => setField('dropshipCustomerShippingEur', v)}
            />
            <NumberField
              label="Dropship Handling Fee (EUR)"
              value={form.dropshipHandlingFeeEur}
              onChange={(v) => setField('dropshipHandlingFeeEur', v)}
            />
            <label className="field-label">
              Dropship Supported?
              <select
                className="field-input"
                value={form.dropshipSupported ? 'Yes' : 'No'}
                onChange={(e) => setField('dropshipSupported', e.target.value === 'Yes')}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </label>
          </>
        )}

        {showFulfillmentFields && (
          <>
            <NumberField
              label="Fulfillment Fee (EUR)"
              value={form.fulfillmentFeeEur}
              onChange={(v) => setField('fulfillmentFeeEur', v)}
              hint="Per-unit fee charged by the fulfillment provider (e.g. Amazon FBA, 3PL)."
            />
            <NumberField
              label="Storage Fee / month (EUR)"
              value={form.storageFeeEurPerMonth}
              onChange={(v) => setField('storageFeeEurPerMonth', v)}
            />
          </>
        )}
      </FormSection>

      <FormSection title="Supplier / Sourcing">
        <label className="field-label">
          Supplier Name
          <input
            className="field-input"
            value={form.supplierName}
            onChange={(e) => setField('supplierName', e.target.value)}
          />
        </label>

        <label className="field-label">
          Supplier Platform
          <select
            className="field-input"
            value={form.supplierPlatform}
            onChange={(e) => setField('supplierPlatform', e.target.value)}
          >
            <option value="">Select supplier platform</option>
            <option value="AliExpress">AliExpress</option>
            <option value="Alibaba">Alibaba</option>
            <option value="Kleinanzeigen">Kleinanzeigen</option>
            <option value="Local">Local</option>
            <option value="Wholesale">Wholesale</option>
            <option value="Other">Other</option>
          </select>
        </label>

        <label className="field-label sm:col-span-2">
          Supplier Product Link
          <input
            className="field-input"
            type="url"
            value={form.supplierLink}
            onChange={(e) => setField('supplierLink', e.target.value)}
            placeholder="https://..."
          />
        </label>

        <label className="field-label">
          Acquisition Source
          <input
            className="field-input"
            value={form.acquisitionSource}
            onChange={(e) => setField('acquisitionSource', e.target.value)}
            placeholder="Alibaba, Local, Kleinanzeigen"
          />
        </label>

        <label className="field-label">
          Acquisition Date
          <input
            className="field-input"
            type="date"
            value={form.acquisitionDate}
            onChange={(e) => setField('acquisitionDate', e.target.value)}
          />
        </label>

        <NumberField
          label="Supplier MOQ"
          value={form.supplierMoq}
          onChange={(v) => setField('supplierMoq', v)}
          hint="Bulk import suppliers only - leave at 1 for a single local/used purchase."
        />
        <NumberField
          label="Lead Time (days)"
          value={form.leadTimeDays}
          onChange={(v) => setField('leadTimeDays', v)}
          hint="Shipping/production time from supplier - usually 0 for local pickup."
        />
      </FormSection>

      <FormSection title="Photos">
        <div className="field-label sm:col-span-2">
          Product Photos (up to 5)
          <div className="flex flex-wrap gap-2">
            <label className="btn-secondary cursor-pointer">
              📷 Take Photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImageSelect}
              />
            </label>
            <label className="btn-secondary cursor-pointer">
              🖼 Choose Files
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2.5 mt-2">
            {images.map((image, index) => (
              <div key={`${image.path}-${index}`} className="relative w-[72px] h-[72px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt=""
                  className="w-full h-full object-cover rounded-lg border border-border"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red text-white text-[11px] border-2 border-white"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </FormSection>

      <FormSection title="Costing" hint="What it costs you, and what you plan to sell it for.">
        <label className="field-label">
          Source Currency *
          <select
            className="field-input"
            value={form.currency}
            onChange={(e) => setField('currency', e.target.value as FormState['currency'])}
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="PKR">PKR</option>
            <option value="CNY">CNY</option>
          </select>
        </label>

        <NumberField
          label="Purchase Price (local currency)"
          value={form.purchasePriceLocal}
          onChange={(v) => setField('purchasePriceLocal', v)}
          hint={
            unitsPerPurchase > 1
              ? `Total for ${unitsPerPurchase} units (Supplier MOQ below) — ≈ ${(
                  num(form.purchasePriceLocal) / unitsPerPurchase
                ).toFixed(2)} ${form.currency} per unit.`
              : 'Price for one unit.'
          }
        />
        <NumberField
          label="Shipping to You (local currency)"
          value={form.shippingLocal}
          onChange={(v) => setField('shippingLocal', v)}
          hint={
            unitsPerPurchase > 1
              ? `Total shipping for ${unitsPerPurchase} units — ≈ ${(
                  num(form.shippingLocal) / unitsPerPurchase
                ).toFixed(2)} ${form.currency} per unit.`
              : undefined
          }
        />
        <NumberField
          label="Customs / Duty (EUR)"
          value={form.customsEur}
          onChange={(v) => setField('customsEur', v)}
          hint="Leave 0 for local/domestic suppliers - only applies to international imports."
        />
        <NumberField label="Packaging (EUR)" value={form.packagingEur} onChange={(v) => setField('packagingEur', v)} />

        {showRefurbishment && (
          <NumberField
            label="Refurbishment Cost (EUR)"
            value={form.refurbishmentEur}
            onChange={(v) => setField('refurbishmentEur', v)}
            hint="Only applies when Condition is Refurbished."
          />
        )}

        <NumberField label="Current Sale Price (EUR)" value={form.currentSalePriceEur} onChange={(v) => setField('currentSalePriceEur', v)} />
        <NumberField label="Target Profit %" value={form.targetProfitPercent} onChange={(v) => setField('targetProfitPercent', v)} step="0.01" />
      </FormSection>

      <FormSection title="Notes">
        <label className="field-label sm:col-span-2">
          Notes
          <textarea
            className="field-input"
            rows={4}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </label>
      </FormSection>

      {error && <p className="text-red font-semibold">{error}</p>}

      <div className="flex justify-end gap-2.5">
        <button type="submit" className="btn-primary" disabled={saving || uploading}>
          {saving ? 'Saving...' : uploading ? 'Uploading image...' : isEditing ? 'Update Product' : 'Save Product'}
        </button>
      </div>
    </form>
  );
}

function FormSection({
  title,
  hint,
  children
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="mb-3.5">
        <h3 className="font-bold text-base m-0">{title}</h3>
        {hint && <p className="text-muted text-[13px] mt-0.5 m-0">{hint}</p>}
      </div>
      <div className="grid sm:grid-cols-2 gap-3.5">{children}</div>
    </div>
  );
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function PreviewField({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase text-muted font-bold">{label}</span>
      <strong className={`text-lg ${tone || ''}`}>{value}</strong>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  hint,
  step = '0.01'
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  step?: string;
}) {
  return (
    <label className="field-label">
      {label}
      <input
        className="field-input"
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <small className="text-muted font-normal text-[11px] -mt-0.5">{hint}</small>}
    </label>
  );
}

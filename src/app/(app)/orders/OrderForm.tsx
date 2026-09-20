'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchSettings } from '@/lib/settings';
import { calculateOrderPricing } from '@/lib/orderPricing';
import { formatMoney } from '@/lib/format';
import type { Order, Product, Settings } from '@/lib/types';

type FormState = {
  sku: string;
  buyerUsername: string;
  quantity: string;
  salesPlatform: string;
  saleCurrency: 'EUR' | 'USD' | 'PKR';
  itemPriceLocal: string;
  shippingChargedLocal: string;
  fulfillmentType: 'Self' | 'Dropship';
  orderStatus: string;
  orderDate: string;
  supplierOrderId: string;
  supplierTrackingNumber: string;
  carrier: string;
  buyerTrackingNumber: string;
  deliveredDate: string;
  notes: string;
};

function initialState(order?: Order): FormState {
  return {
    sku: order?.sku || '',
    buyerUsername: order?.buyer_username || '',
    quantity: String(order?.quantity ?? 1),
    salesPlatform: order?.sales_platform || 'eBay_DE',
    saleCurrency: (order?.sale_currency as FormState['saleCurrency']) || 'EUR',
    itemPriceLocal: String(order?.item_price_local ?? ''),
    shippingChargedLocal: String(order?.shipping_charged_local ?? ''),
    fulfillmentType: (order?.fulfillment_type as FormState['fulfillmentType']) || 'Self',
    orderStatus: order?.order_status || 'New',
    orderDate: order?.order_date || new Date().toISOString().slice(0, 10),
    supplierOrderId: '',
    supplierTrackingNumber: '',
    carrier: order?.carrier || '',
    buyerTrackingNumber: order?.buyer_tracking_number || '',
    deliveredDate: order?.delivered_date || '',
    notes: order?.notes || ''
  };
}

function num(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function OrderForm({ products, order }: { products: Product[]; order?: Order }) {
  const isEditing = !!order;
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<FormState>(() => initialState(order));
  const [settings, setSettings] = useState<Settings>({
    fxRates: { EUR: 1, USD: 1.08, PKR: 310 },
    ebayFeePercent: 0.129,
    paymentFeePercent: 0.029,
    fixedPaymentFeeEur: 0.35,
    vatRegistered: false,
    vatRatePercent: 19
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings(supabase).then(setSettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const selectedProduct = useMemo(
    () => products.find((product) => product.sku === form.sku),
    [products, form.sku]
  );

  const pricing = useMemo(
    () =>
      calculateOrderPricing({
        fxRate: settings.fxRates[form.saleCurrency] || 1,
        itemPriceLocal: num(form.itemPriceLocal),
        shippingChargedLocal: num(form.shippingChargedLocal),
        ebayFeePercent: selectedProduct?.ebay_fee_percent ?? settings.ebayFeePercent,
        paymentFeePercent: selectedProduct?.payment_fee_percent ?? settings.paymentFeePercent,
        fixedPaymentFeeEur: selectedProduct?.fixed_payment_fee_eur ?? settings.fixedPaymentFeeEur,
        productCostEur: selectedProduct?.total_cost_eur ?? 0,
        shippingPackagingCostEur: 0
      }),
    [form.itemPriceLocal, form.shippingChargedLocal, form.saleCurrency, selectedProduct, settings]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    if (!selectedProduct) {
      setError('Select a valid SKU.');
      setSaving(false);
      return;
    }

    const orderId = order?.order_id || `EB-${Date.now().toString(36).toUpperCase()}`;
    const quantity = num(form.quantity) || 1;

    const vatAmountEur = settings.vatRegistered
      ? Math.round((pricing.grossSaleEur * settings.vatRatePercent / 100 + Number.EPSILON) * 100) / 100
      : null;

    const payload = {
      order_id: orderId,
      order_date: form.orderDate,
      sales_platform: form.salesPlatform,
      buyer_username: form.buyerUsername || null,
      sku: form.sku,
      product_name: selectedProduct.product_name,
      condition: selectedProduct.condition,
      quantity,
      sale_currency: form.saleCurrency,
      fx_rate: settings.fxRates[form.saleCurrency] || 1,
      item_price_local: num(form.itemPriceLocal),
      shipping_charged_local: num(form.shippingChargedLocal),
      gross_sale_eur: pricing.grossSaleEur,
      fulfillment_type: form.fulfillmentType,
      order_status: form.orderStatus,
      ebay_fee_percent: selectedProduct.ebay_fee_percent,
      ebay_fee_eur: pricing.ebayFeeEur,
      payment_fee_percent: selectedProduct.payment_fee_percent,
      fixed_payment_fee_eur: selectedProduct.fixed_payment_fee_eur,
      payment_fee_eur: pricing.paymentFeeEur,
      product_cost_eur: selectedProduct.total_cost_eur,
      shipping_packaging_cost_eur: 0,
      total_order_cost_eur: pricing.totalOrderCostEur,
      net_profit_eur: pricing.netProfitEur,
      net_margin: pricing.netMargin,
      carrier: form.carrier || null,
      buyer_tracking_number: form.buyerTrackingNumber || null,
      delivered_date: form.deliveredDate || null,
      notes: form.notes || null
    };

    const { error: saveError } = isEditing
      ? await supabase.from('orders').update(payload).eq('order_id', orderId)
      : await supabase.from('orders').insert(payload);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    const previousQuantity = isEditing ? order!.quantity : 0;
    const quantityDelta = quantity - previousQuantity;

    if (quantityDelta !== 0) {
      const { data: inventoryRow } = await supabase
        .from('inventory')
        .select('id, quantity_on_hand')
        .eq('sku', form.sku)
        .maybeSingle();

      if (inventoryRow) {
        const { error: inventoryError } = await supabase
          .from('inventory')
          .update({ quantity_on_hand: inventoryRow.quantity_on_hand - quantityDelta })
          .eq('id', inventoryRow.id);

        if (inventoryError) {
          console.error('Failed to adjust inventory:', inventoryError.message);
        }
      } else {
        console.warn(`No inventory row for SKU ${form.sku} — skipping stock deduction.`);
      }
    }

    if (!isEditing) {
      const { error: accountError } = await supabase.from('accounts').insert({
        tx_id: `ACC-${Date.now().toString(36).toUpperCase()}`,
        type: 'Sale',
        category: 'eBay Sales',
        amount_eur: pricing.grossSaleEur,
        direction: 'In',
        vat_rate_percent: settings.vatRegistered ? settings.vatRatePercent : null,
        vat_amount_eur: vatAmountEur,
        notes: `Auto: order ${orderId} (${form.sku})`
      });

      if (accountError) {
        console.error('Failed to auto-create accounts entry:', accountError.message);
      }
    }

    router.push('/orders');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <PreviewField label="Gross Sale" value={formatMoney(pricing.grossSaleEur)} />
          <PreviewField label="eBay Fee" value={formatMoney(pricing.ebayFeeEur)} />
          <PreviewField label="Payment Fee" value={formatMoney(pricing.paymentFeeEur)} />
          <PreviewField
            label="Net Profit"
            value={formatMoney(pricing.netProfitEur)}
            tone={pricing.netProfitEur < 0 ? 'text-red' : 'text-green'}
          />
        </div>
      </div>

      <div className="card p-5">
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
            Order Date *
            <input
              className="field-input"
              type="date"
              required
              value={form.orderDate}
              onChange={(e) => setField('orderDate', e.target.value)}
            />
          </label>

          <label className="field-label">
            Buyer Username
            <input
              className="field-input"
              value={form.buyerUsername}
              onChange={(e) => setField('buyerUsername', e.target.value)}
            />
          </label>

          <label className="field-label">
            Quantity *
            <input
              className="field-input"
              type="number"
              min="1"
              step="1"
              required
              value={form.quantity}
              onChange={(e) => setField('quantity', e.target.value)}
            />
          </label>

          <label className="field-label">
            Sales Platform
            <select
              className="field-input"
              value={form.salesPlatform}
              onChange={(e) => setField('salesPlatform', e.target.value)}
            >
              <option value="eBay_DE">eBay Germany</option>
              <option value="eBay_US">eBay USA</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <label className="field-label">
            Sale Currency *
            <select
              className="field-input"
              value={form.saleCurrency}
              onChange={(e) => setField('saleCurrency', e.target.value as FormState['saleCurrency'])}
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="PKR">PKR</option>
            </select>
          </label>

          <label className="field-label">
            Item Price (sale currency) *
            <input
              className="field-input"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.itemPriceLocal}
              onChange={(e) => setField('itemPriceLocal', e.target.value)}
            />
          </label>

          <label className="field-label">
            Shipping Charged (sale currency)
            <input
              className="field-input"
              type="number"
              min="0"
              step="0.01"
              value={form.shippingChargedLocal}
              onChange={(e) => setField('shippingChargedLocal', e.target.value)}
            />
          </label>

          <label className="field-label">
            Fulfillment Type
            <select
              className="field-input"
              value={form.fulfillmentType}
              onChange={(e) => setField('fulfillmentType', e.target.value as FormState['fulfillmentType'])}
            >
              <option value="Self">Self</option>
              <option value="Dropship">Dropship</option>
            </select>
          </label>

          <label className="field-label">
            Order Status
            <select
              className="field-input"
              value={form.orderStatus}
              onChange={(e) => setField('orderStatus', e.target.value)}
            >
              <option value="New">New</option>
              <option value="Shipped">Shipped</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </label>

          <label className="field-label">
            Carrier
            <input
              className="field-input"
              value={form.carrier}
              onChange={(e) => setField('carrier', e.target.value)}
            />
          </label>

          <label className="field-label">
            Buyer Tracking Number
            <input
              className="field-input"
              value={form.buyerTrackingNumber}
              onChange={(e) => setField('buyerTrackingNumber', e.target.value)}
            />
          </label>

          <label className="field-label">
            Delivered Date
            <input
              className="field-input"
              type="date"
              value={form.deliveredDate}
              onChange={(e) => setField('deliveredDate', e.target.value)}
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

        {error && <p className="text-red font-semibold mt-4">{error}</p>}

        <div className="flex justify-end gap-2.5 mt-5 pt-4 border-t border-border">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isEditing ? 'Update Order' : 'Save Order'}
          </button>
        </div>
      </div>
    </form>
  );
}

function PreviewField({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase text-muted font-bold">{label}</span>
      <strong className={`text-lg ${tone || ''}`}>{value}</strong>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/client';
import { fetchSettings } from '@/lib/settings';
import { calculateOrderPricing } from '@/lib/orderPricing';
import { parseOrderCsv, type OrderCsvInvalidRow, type OrderCsvRow } from '@/lib/orderCsv';
import type { Product, Settings } from '@/lib/types';
import { notifyTeam } from '@/lib/notify';

export default function ImportOrdersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [validRows, setValidRows] = useState<OrderCsvRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<OrderCsvInvalidRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [imported, setImported] = useState(0);

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const text = await file.text();
    const { data: products } = await supabase.from('products').select('sku');
    const knownSkus = new Set((products || []).map((p: { sku: string }) => p.sku));

    const result = parseOrderCsv(text, knownSkus);
    setValidRows(result.valid);
    setInvalidRows(result.invalid);
    setImported(0);
    setError('');
  }

  async function handleImport() {
    setImporting(true);
    setError('');

    const settings: Settings = await fetchSettings(supabase);
    const { data: productRows } = await supabase.from('products').select('*');
    const products = (productRows as Product[]) || [];
    let successCount = 0;

    for (const row of validRows) {
      const product = products.find((p) => p.sku === row.sku);
      if (!product) continue;

      const fxRate = settings.fxRates[row.sale_currency as keyof Settings['fxRates']] || 1;
      const pricing = calculateOrderPricing({
        fxRate,
        itemPriceLocal: row.item_price_local,
        shippingChargedLocal: row.shipping_charged_local,
        ebayFeePercent: product.ebay_fee_percent,
        paymentFeePercent: product.payment_fee_percent,
        fixedPaymentFeeEur: product.fixed_payment_fee_eur,
        productCostEur: product.total_cost_eur,
        shippingPackagingCostEur: 0
      });

      const orderId = `EB-${Date.now().toString(36).toUpperCase()}-${successCount}`;
      const { error: insertError } = await supabase.from('orders').insert({
        order_id: orderId,
        order_date: row.order_date,
        sales_platform: row.sales_platform,
        buyer_username: row.buyer_username || null,
        sku: row.sku,
        product_name: product.product_name,
        condition: product.condition,
        quantity: row.quantity,
        sale_currency: row.sale_currency,
        fx_rate: fxRate,
        item_price_local: row.item_price_local,
        shipping_charged_local: row.shipping_charged_local,
        gross_sale_eur: pricing.grossSaleEur,
        fulfillment_type: row.fulfillment_type,
        // Closing needs the real payout, so closed rows come in as Delivered.
        order_status: ['Closed', 'Returned'].includes(row.order_status) ? 'Delivered' : row.order_status,
        ebay_fee_percent: product.ebay_fee_percent,
        ebay_fee_eur: pricing.ebayFeeEur,
        payment_fee_percent: product.payment_fee_percent,
        fixed_payment_fee_eur: product.fixed_payment_fee_eur,
        payment_fee_eur: pricing.paymentFeeEur,
        product_cost_eur: product.total_cost_eur,
        shipping_packaging_cost_eur: 0,
        total_order_cost_eur: pricing.totalOrderCostEur,
        net_profit_eur: pricing.netProfitEur,
        net_margin: pricing.netMargin,
        notes: row.notes || null
      });

      if (insertError) {
        console.error(`Failed to import row for SKU ${row.sku}:`, insertError.message);
        continue;
      }

      // Money reaches Accounts only when the order is closed (see close_order).
      if (row.order_status !== 'Cancelled') {
        await supabase.rpc('apply_stock_movement', {
          p_sku: row.sku,
          p_qty_change: -row.quantity,
          p_reason: 'sale',
          p_ref_type: 'order',
          p_ref_id: orderId
        });
      }

      successCount++;
    }

    setImporting(false);
    setImported(successCount);

    if (successCount > 0) {
      notifyTeam(
        'Orders imported',
        `${successCount} order${successCount === 1 ? '' : 's'} imported from CSV`,
        '/orders'
      );
      router.push('/orders');
      router.refresh();
    }
  }

  return (
    <div>
      <PageHeader title="Import Orders" subtitle="Bulk-upload orders from a CSV file" />

      <div className="card p-5 grid gap-4">
        <p className="text-muted text-sm">
          Required columns: order_date, sales_platform, buyer_username, sku,
          quantity, sale_currency, item_price_local, shipping_charged_local,
          fulfillment_type, order_status, notes.
        </p>

        <input type="file" accept=".csv,text/csv" onChange={handleFileSelect} />

        {(validRows.length > 0 || invalidRows.length > 0) && (
          <div className="grid gap-2">
            <p className="text-sm font-semibold">
              {validRows.length} valid row(s), {invalidRows.length} invalid row(s)
            </p>

            {invalidRows.length > 0 && (
              <ul className="text-sm text-red list-disc pl-5">
                {invalidRows.map((row) => (
                  <li key={row.line}>
                    Line {row.line}: {row.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <p className="text-red font-semibold">{error}</p>}
        {imported > 0 && <p className="text-green font-semibold">Imported {imported} order(s).</p>}

        <div className="flex justify-end">
          <button
            type="button"
            className="btn-primary"
            disabled={validRows.length === 0 || importing}
            onClick={handleImport}
          >
            {importing ? 'Importing...' : `Import ${validRows.length} Valid Row(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

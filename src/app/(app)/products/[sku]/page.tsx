import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import { formatMoney } from '@/lib/format';
import type { Product } from '@/lib/types';

function pct(value: number) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function Field({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase text-muted font-bold">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener" className="text-blue font-semibold break-words">
          {value}
        </a>
      ) : (
        <strong className="text-sm break-words">{value || '—'}</strong>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs uppercase tracking-wide text-blue font-bold border-b border-border pb-1.5 mb-2.5">
        {title}
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

export default async function ProductDetailPage({
  params
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('products').select('*').eq('sku', sku).maybeSingle();

  if (!data) notFound();

  const product = data as Product;

  return (
    <div>
      <PageHeader
        title={product.product_name}
        subtitle={product.sku}
        actions={
          <>
            <Link href={`/products/${product.sku}/edit`} className="btn-secondary">
              Edit
            </Link>
            <Link href="/products" className="btn-secondary">
              Back to Products
            </Link>
          </>
        }
      />

      <div className="card p-5 grid gap-6">
        {product.image_urls?.length > 0 && (
          <div className="flex flex-wrap gap-2.5">
            {product.image_urls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-[100px] h-[100px] object-cover rounded-lg" />
              </a>
            ))}
          </div>
        )}

        <Section title="Overview">
          <Field label="SKU" value={product.sku} />
          <Field label="Category" value={product.category || ''} />
          <Field label="Condition" value={product.condition} />
          <Field label="Fulfillment Model" value={product.business_model} />
          <Field label="Status" value={product.product_status} />
          <Field label="Platform" value={product.sales_platform} />
        </Section>

        <Section title="Pricing & Profit Analysis">
          <Field label="Total Cost" value={formatMoney(product.total_cost_eur)} />
          <Field label="Minimum (Breakeven) Price" value={formatMoney(product.minimum_sale_price_eur)} />
          <Field label="Recommended Price" value={formatMoney(product.recommended_sale_price_eur)} />
          <Field label="Current Sale Price" value={formatMoney(product.current_sale_price_eur)} />
          <Field label="Target Profit %" value={pct(product.target_profit_percent)} />
          <Field label="Estimated Net Profit" value={formatMoney(product.estimated_net_profit_eur)} />
          <Field label="Estimated Margin" value={pct(product.estimated_profit_margin)} />
        </Section>

        <Section title="Cost Breakdown">
          <Field label="Source Currency" value={product.source_currency} />
          <Field label="FX Rate to EUR" value={String(product.fx_rate)} />
          <Field label="Purchase Price" value={formatMoney(product.purchase_price_eur)} />
          <Field label="Shipping to You" value={formatMoney(product.shipping_eur)} />
          <Field label="Customs/Duty" value={formatMoney(product.customs_eur)} />
          <Field label="Packaging" value={formatMoney(product.packaging_eur)} />
          <Field label="Refurbishment" value={formatMoney(product.refurbishment_eur)} />
          <Field label="Dropship Customer Shipping" value={formatMoney(product.dropship_customer_shipping_eur)} />
          <Field label="Dropship Handling Fee" value={formatMoney(product.dropship_handling_fee_eur)} />
          <Field label="Fulfillment Fee" value={formatMoney(product.fulfillment_fee_eur)} />
          <Field label="Storage Fee / month" value={formatMoney(product.storage_fee_eur_per_month)} />
        </Section>

        <Section title="Fees">
          <Field label="Selling Fee %" value={pct(product.ebay_fee_percent)} />
          <Field label="Estimated Selling Fee" value={formatMoney(product.estimated_ebay_fee_eur)} />
          <Field label="Payment Fee %" value={pct(product.payment_fee_percent)} />
          <Field label="Fixed Payment Fee" value={formatMoney(product.fixed_payment_fee_eur)} />
          <Field label="Estimated Payment Fee" value={formatMoney(product.estimated_payment_fee_eur)} />
        </Section>

        <Section title="Supplier & Logistics">
          <Field label="Supplier Name" value={product.supplier_name || ''} />
          <Field label="Supplier Platform" value={product.supplier_platform || ''} />
          <Field label="Supplier MOQ" value={String(product.supplier_moq ?? '')} />
          <Field label="Lead Time (days)" value={String(product.lead_time_days ?? '')} />
          <Field label="Dropship Supported" value={product.dropship_supported ? 'Yes' : 'No'} />
          <Field label="Acquisition Source" value={product.acquisition_source || ''} />
          <Field label="Acquisition Date" value={product.acquisition_date || ''} />
        </Section>

        <Section title="Links">
          {product.supplier_link && (
            <Field label="Supplier Link" value={product.supplier_link} href={product.supplier_link} />
          )}
          {product.main_ebay_listing_url && (
            <Field label="Listing Link" value={product.main_ebay_listing_url} href={product.main_ebay_listing_url} />
          )}
        </Section>

        {product.notes && (
          <Section title="Notes">
            <p className="col-span-full text-sm">{product.notes}</p>
          </Section>
        )}
      </div>
    </div>
  );
}

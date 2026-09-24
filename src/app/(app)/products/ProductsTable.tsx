'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchFulfillmentModels } from '@/lib/platformConfig';
import { formatMoney, statusClassName } from '@/lib/format';
import type { FulfillmentModel, Product } from '@/lib/types';
import { notifyTeam } from '@/lib/notify';
import { RecordAuthorCell } from '@/components/RecordAuthor';

// "All" deliberately leaves out Archived: archived products only live in their own tab.
const STATUS_TABS = ['All', 'Active', 'Research', 'Paused', 'Out of Stock', 'Archived'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

function inTab(product: Product, tab: StatusTab) {
  if (tab === 'All') return product.product_status !== 'Archived';
  return product.product_status === tab;
}

export default function ProductsTable({ products }: { products: Product[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('All');
  const [conditionFilter, setConditionFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [fulfillmentModels, setFulfillmentModels] = useState<FulfillmentModel[]>([]);

  useEffect(() => {
    fetchFulfillmentModels(supabase).then(setFulfillmentModels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search, condition and model narrow every tab; the tab then picks the status.
  const searched = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      if (conditionFilter && product.condition !== conditionFilter) return false;
      if (modelFilter && product.business_model !== modelFilter) return false;

      if (!query) return true;

      return [product.sku, product.product_name, product.supplier_name, product.business_model]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [products, search, conditionFilter, modelFilter]);

  const tabCounts = useMemo(
    () =>
      Object.fromEntries(
        STATUS_TABS.map((tab) => [tab, searched.filter((product) => inTab(product, tab)).length])
      ) as Record<StatusTab, number>,
    [searched]
  );

  const filtered = useMemo(
    () => searched.filter((product) => inTab(product, statusTab)),
    [searched, statusTab]
  );

  async function setProductStatus(sku: string, status: 'Archived' | 'Active') {
    const archiving = status === 'Archived';
    const question = archiving
      ? `Archive product ${sku}? It will move to the Archived tab.`
      : `Restore product ${sku}? It will move back to the Active tab.`;
    if (!confirm(question)) return;

    const { error } = await supabase
      .from('products')
      .update({ product_status: status })
      .eq('sku', sku);

    if (error) {
      alert(error.message);
      return;
    }

    notifyTeam(archiving ? 'Product archived' : 'Product restored', sku, '/products');
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2.5 mb-3 sm:mb-4">
        <input
          className="field-input sm:max-w-[420px]"
          placeholder="Search SKU, product name, supplier..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div
        role="tablist"
        className="no-scrollbar flex gap-2 mb-3 overflow-x-auto overflow-y-hidden sm:flex-wrap sm:mb-4"
      >
        {STATUS_TABS.map((tab) => {
          const active = tab === statusTab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatusTab(tab)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[13px] sm:px-3.5 sm:py-1.5 sm:text-sm font-bold transition-colors ${
                active
                  ? 'bg-blue border-blue text-white'
                  : 'bg-white border-border text-muted hover:border-blue hover:text-blue'
              }`}
            >
              {tab}
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] ${
                  active ? 'bg-white/20' : 'bg-slate-100'
                }`}
              >
                {tabCounts[tab]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 sm:flex sm:flex-wrap sm:gap-2.5 sm:mb-4">
        <select className="field-input sm:w-auto sm:min-w-[150px]" value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}>
          <option value="">All Conditions</option>
          <option value="New">New</option>
          <option value="Used">Used</option>
          <option value="Refurbished">Refurbished</option>
        </select>

        <select className="field-input sm:w-auto sm:min-w-[150px]" value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
          <option value="">All Models</option>
          {fulfillmentModels.map((model) => (
            <option key={model.code} value={model.code}>
              {model.label}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="responsive-table w-full text-sm md:min-w-[720px]">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
                <th className="p-3">Image</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Product</th>
                <th className="p-3">Condition</th>
                <th className="p-3">Model</th>
                <th className="p-3">Cost EUR</th>
                <th className="p-3">Sale Price</th>
                <th className="p-3">Profit</th>
                <th className="p-3">Last Edited</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="cell-empty text-center text-muted p-5">
                    {statusTab === 'All' ? 'No products found.' : `No ${statusTab.toLowerCase()} products.`}
                  </td>
                </tr>
              ) : (
                filtered.map((product) => (
                  <tr key={product.sku} className="border-b border-border">
                    <td className="p-3 cell-image">
                      {product.image_urls?.[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.image_urls[0]}
                          alt=""
                          className="w-10 h-10 object-cover rounded"
                        />
                      )}
                    </td>
                    <td className="p-3" data-label="SKU">{product.sku}</td>
                    <td className="p-3 font-semibold" data-label="Product">{product.product_name}</td>
                    <td className="p-3" data-label="Condition">{product.condition}</td>
                    <td className="p-3" data-label="Model">{product.business_model}</td>
                    <td className="p-3" data-label="Cost EUR">{formatMoney(product.total_cost_eur)}</td>
                    <td className="p-3" data-label="Sale Price">{formatMoney(product.current_sale_price_eur)}</td>
                    <td className="p-3" data-label="Profit">{formatMoney(product.estimated_net_profit_eur)}</td>
                    <td className="p-3" data-label="Last Edited">
                      <RecordAuthorCell record={product} />
                    </td>
                    <td className="p-3" data-label="Status">
                      <span className={statusClassName(product.product_status)}>
                        {product.product_status}
                      </span>
                    </td>
                    <td className="p-3 cell-actions">
                      <div className="flex gap-1.5">
                        <Link
                          href={`/products/${product.sku}`}
                          className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue"
                        >
                          View
                        </Link>
                        <Link
                          href={`/products/${product.sku}/edit`}
                          className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue"
                        >
                          Edit
                        </Link>
                        {product.product_status === 'Archived' ? (
                          <button
                            className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-green hover:text-green"
                            onClick={() => setProductStatus(product.sku, 'Active')}
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-red hover:text-red"
                            onClick={() => setProductStatus(product.sku, 'Archived')}
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

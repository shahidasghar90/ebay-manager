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

export default function ProductsTable({ products }: { products: Product[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [fulfillmentModels, setFulfillmentModels] = useState<FulfillmentModel[]>([]);

  useEffect(() => {
    fetchFulfillmentModels(supabase).then(setFulfillmentModels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      if (!statusFilter && product.product_status === 'Archived') return false;
      if (statusFilter && product.product_status !== statusFilter) return false;
      if (conditionFilter && product.condition !== conditionFilter) return false;
      if (modelFilter && product.business_model !== modelFilter) return false;

      if (!query) return true;

      return [product.sku, product.product_name, product.supplier_name, product.business_model]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [products, search, statusFilter, conditionFilter, modelFilter]);

  async function archiveProduct(sku: string) {
    if (!confirm(`Archive product ${sku}? It will be hidden from the active list.`)) return;

    const { error } = await supabase
      .from('products')
      .update({ product_status: 'Archived' })
      .eq('sku', sku);

    if (error) {
      alert(error.message);
      return;
    }

    notifyTeam('Product archived', sku, '/products');
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <input
          className="field-input sm:max-w-[420px]"
          placeholder="Search SKU, product name, supplier..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <select className="field-input w-auto min-w-[150px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="Research">Research</option>
          <option value="Active">Active</option>
          <option value="Paused">Paused</option>
          <option value="Out of Stock">Out of Stock</option>
          <option value="Archived">Archived</option>
        </select>

        <select className="field-input w-auto min-w-[150px]" value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}>
          <option value="">All Conditions</option>
          <option value="New">New</option>
          <option value="Used">Used</option>
          <option value="Refurbished">Refurbished</option>
        </select>

        <select className="field-input w-auto min-w-[150px]" value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
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
                    No products found.
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
                        {product.product_status !== 'Archived' && (
                          <button
                            className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-red hover:text-red"
                            onClick={() => archiveProduct(product.sku)}
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

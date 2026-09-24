'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { InventoryItem } from '@/lib/types';

function reorderAlert(item: InventoryItem): { label: string; className: string } {
  if (item.inventory_type === 'Dropship') {
    return { label: 'Supplier stock check', className: 'status-badge bg-slate-100 text-slate-600' };
  }

  const available = item.quantity_on_hand - item.quantity_reserved;

  return available <= item.reorder_level
    ? { label: 'REORDER', className: 'status-badge bg-[#fee2e2] text-[#991b1b]' }
    : { label: 'OK', className: 'status-badge bg-[#dcfce7] text-[#166534]' };
}

export default function InventoryTable({ items }: { items: InventoryItem[] }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) =>
      [item.sku, item.product_name, item.variant, item.location_bin]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [items, search]);

  return (
    <div>
      <input
        className="field-input sm:max-w-[420px] mb-4"
        placeholder="Search SKU, product name, bin..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="responsive-table w-full text-sm md:min-w-[720px]">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
                <th className="p-3">SKU</th>
                <th className="p-3">Product</th>
                <th className="p-3">Type</th>
                <th className="p-3">On Hand</th>
                <th className="p-3">Reserved</th>
                <th className="p-3">Available</th>
                <th className="p-3">Alert</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="cell-empty text-center text-muted p-5">
                    No inventory records found.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const alert = reorderAlert(item);
                  const available =
                    item.inventory_type === 'Dropship'
                      ? 'N/A'
                      : String(item.quantity_on_hand - item.quantity_reserved);

                  return (
                    <tr key={item.id} className="border-b border-border">
                      <td className="p-3" data-label="SKU">{item.sku}</td>
                      <td className="p-3 font-semibold" data-label="Product">{item.product_name}</td>
                      <td className="p-3" data-label="Type">{item.inventory_type}</td>
                      <td className="p-3" data-label="On Hand">{item.quantity_on_hand}</td>
                      <td className="p-3" data-label="Reserved">{item.quantity_reserved}</td>
                      <td className="p-3" data-label="Available">{available}</td>
                      <td className="p-3" data-label="Alert">
                        <span className={alert.className}>{alert.label}</span>
                      </td>
                      <td className="p-3 cell-actions">
                        <Link
                          href={`/inventory/${item.id}/edit`}
                          className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

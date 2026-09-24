'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { InventoryItem } from '@/lib/types';
import { RecordAuthorCell, RecordAuthorShort } from '@/components/RecordAuthor';

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

      {/* Phones: one compact card per stock record. */}
      <ul className="md:hidden grid gap-2.5">
        {filtered.length === 0 ? (
          <li className="card p-6 text-center text-muted">No inventory records found.</li>
        ) : (
          filtered.map((item) => {
            const alert = reorderAlert(item);
            const available =
              item.inventory_type === 'Dropship'
                ? 'N/A'
                : String(item.quantity_on_hand - item.quantity_reserved);

            return (
              <li key={item.id} className="card p-3">
                <div className="flex items-start justify-between gap-2">
                  <strong className="text-sm leading-snug line-clamp-2 break-words">{item.product_name}</strong>
                  <span className={`${alert.className} shrink-0`}>{alert.label}</span>
                </div>
                <p className="text-muted text-xs m-0 mt-0.5 truncate">
                  {item.sku} · {item.inventory_type}
                </p>
                <p className="text-[13px] m-0 mt-1.5 flex flex-wrap gap-x-3">
                  <span>
                    On hand <strong>{item.quantity_on_hand}</strong>
                  </span>
                  <span>
                    Reserved <strong>{item.quantity_reserved}</strong>
                  </span>
                  <span>
                    Available <strong>{available}</strong>
                  </span>
                </p>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <RecordAuthorShort record={item} />
                  <Link href={`/inventory/${item.id}/edit`} className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue shrink-0">
                    Edit
                  </Link>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <div className="hidden md:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="responsive-table data-table w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
                <th className="p-3">Product</th>
                <th className="p-3">Type</th>
                <th className="p-3">On Hand</th>
                <th className="p-3">Reserved</th>
                <th className="p-3">Available</th>
                <th className="p-3">Last Edited</th>
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
                      <td className="p-3 cell-wrap w-full" data-label="Product">
                        <span className="min-w-0">
                          <span className="font-semibold leading-snug line-clamp-2" title={item.product_name}>
                            {item.product_name}
                          </span>
                          <span className="block text-xs text-muted">{item.sku}</span>
                        </span>
                      </td>
                      <td className="p-3" data-label="Type">{item.inventory_type}</td>
                      <td className="p-3" data-label="On Hand">{item.quantity_on_hand}</td>
                      <td className="p-3" data-label="Reserved">{item.quantity_reserved}</td>
                      <td className="p-3" data-label="Available">{available}</td>
                      <td className="p-3" data-label="Last Edited">
                        <RecordAuthorCell record={item} />
                      </td>
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

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDate, formatMoney, statusClassName } from '@/lib/format';
import type { Order } from '@/lib/types';

export default function OrdersTable({ orders }: { orders: Order[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (statusFilter && order.order_status !== statusFilter) return false;
      if (!query) return true;

      return [order.order_id, order.sku, order.buyer_username, order.product_name]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [orders, search, statusFilter]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <input
          className="field-input sm:max-w-[420px]"
          placeholder="Search order ID, SKU, buyer..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="field-input w-auto min-w-[150px]"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">All Status</option>
          <option value="New">New</option>
          <option value="Shipped">Shipped</option>
          <option value="Delivered">Delivered</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="responsive-table w-full text-sm md:min-w-[760px]">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
                <th className="p-3">Order ID</th>
                <th className="p-3">Date</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Buyer</th>
                <th className="p-3">Qty</th>
                <th className="p-3">Sale</th>
                <th className="p-3">Profit</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="cell-empty text-center text-muted p-5">
                    No orders found.
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.order_id} className="border-b border-border">
                    <td className="p-3 font-semibold" data-label="Order ID">{order.order_id}</td>
                    <td className="p-3" data-label="Date">{formatDate(order.order_date)}</td>
                    <td className="p-3" data-label="SKU">{order.sku}</td>
                    <td className="p-3" data-label="Buyer">{order.buyer_username || '—'}</td>
                    <td className="p-3" data-label="Qty">{order.quantity}</td>
                    <td className="p-3" data-label="Sale">{formatMoney(order.gross_sale_eur)}</td>
                    <td className="p-3" data-label="Profit">{formatMoney(order.net_profit_eur)}</td>
                    <td className="p-3" data-label="Status">
                      <span className={statusClassName(order.order_status)}>
                        {order.order_status}
                      </span>
                    </td>
                    <td className="p-3 cell-actions">
                      <div className="flex gap-1.5">
                        <Link
                          href={`/orders/${order.order_id}`}
                          className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue"
                        >
                          View
                        </Link>
                        <Link
                          href={`/orders/${order.order_id}/edit`}
                          className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue"
                        >
                          Edit
                        </Link>
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

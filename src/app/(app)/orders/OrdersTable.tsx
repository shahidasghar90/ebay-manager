'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDate, formatMoney, statusClassName } from '@/lib/format';
import type { Order } from '@/lib/types';
import { RecordAuthorCell, RecordAuthorShort } from '@/components/RecordAuthor';

/** Closed, cancelled and returned orders are booked in Accounts and can't be edited. */
function isLocked(order: Order) {
  return !!order.closed_at || order.order_status === 'Cancelled' || order.order_status === 'Returned';
}

function actionHref(order: Order) {
  return isLocked(order) ? `/orders/${order.order_id}` : `/orders/${order.order_id}/edit`;
}

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
          className="field-input sm:!w-auto sm:min-w-[150px]"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">All Status</option>
          <option value="New">New</option>
          <option value="Shipped">Shipped</option>
          <option value="Delivered">Delivered</option>
          <option value="Closed">Closed</option>
          <option value="Returned">Returned</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* Phones: one compact card per order. */}
      <ul className="md:hidden grid gap-2.5 mb-0">
        {filtered.length === 0 ? (
          <li className="card p-6 text-center text-muted">No orders found.</li>
        ) : (
          filtered.map((order) => {
            const profit = Number(order.net_profit_eur || 0);
            return (
              <li key={order.order_id} className="card p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/orders/${order.order_id}`} className="font-bold text-sm break-all">
                    {order.order_id}
                  </Link>
                  <span className={`${statusClassName(order.order_status)} shrink-0`}>
                    {order.order_status}
                  </span>
                </div>
                <p className="text-muted text-xs m-0 mt-0.5 truncate">
                  {formatDate(order.order_date)} · {order.sku} · Qty {order.quantity}
                  {order.buyer_username ? ` · ${order.buyer_username}` : ''}
                </p>
                <p className="text-[13px] m-0 mt-1.5 flex flex-wrap gap-x-3">
                  <span>
                    Sale <strong>{formatMoney(order.gross_sale_eur)}</strong>
                  </span>
                  <span>
                    Profit{' '}
                    <strong className={profit < 0 ? 'text-red' : 'text-green'}>{formatMoney(profit)}</strong>
                  </span>
                </p>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <RecordAuthorShort record={order} />
                  <Link href={actionHref(order)} className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue shrink-0">
                    {isLocked(order) ? 'View' : 'Edit'}
                  </Link>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <div className="hidden md:block card overflow-hidden">
        <div className="table-scroll">
          <table className="responsive-table data-table w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
                <th className="p-3">Order ID</th>
                <th className="p-3">Date</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Buyer</th>
                <th className="p-3">Qty</th>
                <th className="p-3">Sale</th>
                <th className="p-3">Profit</th>
                <th className="p-3">Last Edited</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="cell-empty text-center text-muted p-5">
                    No orders found.
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.order_id} className="border-b border-border">
                    <td className="p-3 font-semibold" data-label="Order ID">
                      <Link href={`/orders/${order.order_id}`} className="hover:text-blue">
                        {order.order_id}
                      </Link>
                    </td>
                    <td className="p-3" data-label="Date">{formatDate(order.order_date)}</td>
                    <td className="p-3" data-label="SKU">{order.sku}</td>
                    <td className="p-3 cell-wrap" data-label="Buyer">
                      <span className="line-clamp-2 break-all" title={order.buyer_username || undefined}>
                        {order.buyer_username || '—'}
                      </span>
                    </td>
                    <td className="p-3" data-label="Qty">{order.quantity}</td>
                    <td className="p-3" data-label="Sale">{formatMoney(order.gross_sale_eur)}</td>
                    <td className="p-3" data-label="Profit">{formatMoney(order.net_profit_eur)}</td>
                    <td className="p-3" data-label="Last Edited">
                      <RecordAuthorCell record={order} />
                    </td>
                    <td className="p-3" data-label="Status">
                      <span className={statusClassName(order.order_status)}>
                        {order.order_status}
                      </span>
                    </td>
                    <td className="p-3 cell-actions">
                      <div className="flex gap-1.5">
                        <Link
                          href={actionHref(order)}
                          className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue"
                        >
                          {isLocked(order) ? 'View' : 'Edit'}
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

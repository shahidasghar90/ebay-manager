import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { createClient } from '@/lib/supabase/server';
import { formatMoney, statusClassName } from '@/lib/format';
import type { Order } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ORDER_STATUS_ORDER = ['New', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

export default async function DashboardPage() {
  const supabase = await createClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const startOfMonthIso = startOfMonth.toISOString().slice(0, 10);

  const [
    { count: totalProducts },
    { count: activeProducts },
    { data: monthOrders },
    { data: recentOrders },
    { data: allOrderStatuses },
    { count: lowStockCount },
    { data: openReturns },
    { data: accountRows },
    { data: inventoryWithCost },
    { count: activeResearchCount }
  ] = await Promise.all([
    supabase.from('products').select('sku', { count: 'exact', head: true }),
    supabase
      .from('products')
      .select('sku', { count: 'exact', head: true })
      .eq('product_status', 'Active'),
    supabase
      .from('orders')
      .select('gross_sale_eur, net_profit_eur')
      .gte('order_date', startOfMonthIso),
    supabase
      .from('orders')
      .select('order_id, sku, gross_sale_eur, net_profit_eur, order_status, order_date')
      .order('order_date', { ascending: false })
      .limit(5),
    supabase.from('orders').select('order_status'),
    supabase
      .from('inventory')
      .select('id', { count: 'exact', head: true })
      .lte('quantity_on_hand', 0),
    supabase.from('returns_cases').select('refund_eur').eq('status', 'Open'),
    supabase.from('accounts').select('amount_eur, direction, tx_date'),
    supabase.from('inventory').select('quantity_on_hand, products(total_cost_eur)'),
    supabase
      .from('product_research')
      .select('id', { count: 'exact', head: true })
      .neq('research_status', 'Converted')
  ]);

  const netProfitThisMonth = (monthOrders || []).reduce(
    (sum, order) => sum + Number(order.net_profit_eur || 0),
    0
  );

  const revenueThisMonth = (monthOrders || []).reduce(
    (sum, order) => sum + Number(order.gross_sale_eur || 0),
    0
  );

  const cashBalance = (accountRows || []).reduce(
    (sum, row) => sum + (row.direction === 'In' ? Number(row.amount_eur) : -Number(row.amount_eur)),
    0
  );

  const cashInThisMonth = (accountRows || [])
    .filter((row) => row.direction === 'In' && row.tx_date >= startOfMonthIso)
    .reduce((sum, row) => sum + Number(row.amount_eur), 0);

  const cashOutThisMonth = (accountRows || [])
    .filter((row) => row.direction === 'Out' && row.tx_date >= startOfMonthIso)
    .reduce((sum, row) => sum + Number(row.amount_eur), 0);

  const inventoryValue = (
    (inventoryWithCost || []) as unknown as {
      quantity_on_hand: number;
      products: { total_cost_eur: number } | { total_cost_eur: number }[] | null;
    }[]
  ).reduce((sum, row) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    return sum + row.quantity_on_hand * Number(product?.total_cost_eur || 0);
  }, 0);

  const refundExposure = (openReturns || []).reduce((sum, row) => sum + Number(row.refund_eur || 0), 0);

  const statusCounts: Record<string, number> = {};
  for (const row of allOrderStatuses || []) {
    statusCounts[row.order_status] = (statusCounts[row.order_status] || 0) + 1;
  }
  const orderedStatuses = [
    ...ORDER_STATUS_ORDER.filter((status) => status in statusCounts),
    ...Object.keys(statusCounts).filter((status) => !ORDER_STATUS_ORDER.includes(status))
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Your eBay business overview" />

      {/* Phones: two small cards per row; the two cash cards take a full row. */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
        <StatCard label="Total Products" value={totalProducts ?? 0} hint="All product records" />
        <StatCard label="Active Products" value={activeProducts ?? 0} hint="Ready for sale" />
        <StatCard
          label="Orders This Month"
          value={(monthOrders || []).length}
          hint="Current month"
        />
        <StatCard
          label="Revenue This Month"
          value={formatMoney(revenueThisMonth)}
          hint="Gross sales"
        />
        <StatCard
          label="Net Profit This Month"
          value={formatMoney(netProfitThisMonth)}
          hint="After costs and fees"
          tone="success"
        />
        <StatCard
          label="Inventory Value"
          value={formatMoney(inventoryValue)}
          hint="Stock on hand at cost"
        />
        <StatCard
          label="Cash Balance"
          value={formatMoney(cashBalance)}
          hint="All-time in minus out"
          tone={cashBalance < 0 ? 'danger' : 'default'}
          className="col-span-2 sm:col-span-1"
        />
        <StatCard
          label="Cash In / Out This Month"
          value={`${formatMoney(cashInThisMonth)} / ${formatMoney(cashOutThisMonth)}`}
          hint="Accounts ledger"
          className="col-span-2 sm:col-span-1"
        />
        <StatCard
          label="Active Research Ideas"
          value={activeResearchCount ?? 0}
          hint="Not yet converted"
        />
        <StatCard
          label="Reorder Alerts"
          value={lowStockCount ?? 0}
          hint="Stock needs attention"
          tone="warning"
        />
        <StatCard
          label="Open Returns"
          value={(openReturns || []).length}
          hint="Cases to resolve"
          tone="danger"
        />
        <StatCard
          label="Refund Exposure"
          value={formatMoney(refundExposure)}
          hint="Open returns, pending refunds"
          tone="danger"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-2.5 sm:gap-4 mt-2.5 sm:mt-4">
        <div className="card p-3.5 sm:p-[18px]">
          <div className="flex justify-between items-start gap-4 mb-2 sm:mb-4">
            <div>
              <h3 className="font-bold text-base sm:text-lg m-0">Recent Orders</h3>
              <p className="hidden sm:block text-muted text-[13px] mt-1 m-0">Latest eBay sales records</p>
            </div>
            <Link href="/orders" className="text-blue font-semibold text-sm">
              View all
            </Link>
          </div>

          {!recentOrders || recentOrders.length === 0 ? (
            <div className="text-muted text-center py-4">No orders yet.</div>
          ) : (
            <>
              {/* Phones: one compact line per order. */}
              <ul className="md:hidden grid m-0 p-0 list-none divide-y divide-border">
                {(recentOrders as Order[]).map((order) => (
                  <li key={order.order_id}>
                    <Link href={`/orders/${order.order_id}`} className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-sm truncate">{order.order_id}</span>
                        <span className="block text-muted text-xs truncate">{order.sku}</span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block font-bold text-sm">{formatMoney(order.gross_sale_eur)}</span>
                        <span
                          className={`block text-xs ${Number(order.net_profit_eur) < 0 ? 'text-red' : 'text-green'}`}
                        >
                          {formatMoney(order.net_profit_eur)}
                        </span>
                      </span>
                      <span className={`${statusClassName(order.order_status)} shrink-0`}>{order.order_status}</span>
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="hidden md:block overflow-x-auto">
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
                      <th className="p-3">Order ID</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Sale</th>
                      <th className="p-3">Profit</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recentOrders as Order[]).map((order) => (
                      <tr key={order.order_id} className="border-b border-border">
                        <td className="p-3 font-semibold">
                          <Link href={`/orders/${order.order_id}`} className="hover:text-blue">
                            {order.order_id}
                          </Link>
                        </td>
                        <td className="p-3">{order.sku}</td>
                        <td className="p-3">{formatMoney(order.gross_sale_eur)}</td>
                        <td className="p-3">{formatMoney(order.net_profit_eur)}</td>
                        <td className="p-3">
                          <span className={statusClassName(order.order_status)}>
                            {order.order_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="grid gap-2.5 sm:gap-4">
          <div className="card p-3.5 sm:p-[18px]">
            <h3 className="font-bold text-base sm:text-lg m-0 mb-3 sm:mb-4">Orders by Status</h3>
            {orderedStatuses.length === 0 ? (
              <div className="text-muted text-center py-2">No orders yet.</div>
            ) : (
              <div className="grid gap-2">
                {orderedStatuses.map((status) => (
                  <div key={status} className="flex justify-between items-center text-sm">
                    <span className={statusClassName(status)}>{status}</span>
                    <span className="font-bold">{statusCounts[status]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-3.5 sm:p-[18px]">
            <h3 className="font-bold text-base sm:text-lg m-0 mb-3 sm:mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-2.5">
              <Link href="/products/new" className="btn-secondary text-left justify-start text-sm">
                + Add New Product
              </Link>
              <Link href="/research" className="btn-secondary text-left justify-start text-sm">
                ⌕ Research Product
              </Link>
              <Link href="/orders" className="btn-secondary text-left justify-start text-sm">
                ▤ Add Order
              </Link>
              <Link href="/inventory" className="btn-secondary text-left justify-start text-sm">
                ▣ Check Inventory
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

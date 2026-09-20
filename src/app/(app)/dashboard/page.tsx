import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { createClient } from '@/lib/supabase/server';
import { formatMoney, statusClassName } from '@/lib/format';
import type { Order } from '@/lib/types';

export const dynamic = 'force-dynamic';

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
    { count: lowStockCount },
    { count: openReturnsCount }
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
    supabase
      .from('inventory')
      .select('id', { count: 'exact', head: true })
      .lte('quantity_on_hand', 0),
    supabase
      .from('returns_cases')
      .select('case_id', { count: 'exact', head: true })
      .eq('status', 'Open')
  ]);

  const netProfitThisMonth = (monthOrders || []).reduce(
    (sum, order) => sum + Number(order.net_profit_eur || 0),
    0
  );

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Your eBay business overview" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Products" value={totalProducts ?? 0} hint="All product records" />
        <StatCard label="Active Products" value={activeProducts ?? 0} hint="Ready for sale" />
        <StatCard
          label="Orders This Month"
          value={(monthOrders || []).length}
          hint="Current month"
        />
        <StatCard
          label="Net Profit This Month"
          value={formatMoney(netProfitThisMonth)}
          hint="After costs and fees"
          tone="success"
        />
        <StatCard
          label="Reorder Alerts"
          value={lowStockCount ?? 0}
          hint="Stock needs attention"
          tone="warning"
        />
        <StatCard
          label="Open Returns"
          value={openReturnsCount ?? 0}
          hint="Cases to resolve"
          tone="danger"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 mt-4">
        <div className="card p-[18px]">
          <div className="flex justify-between items-start gap-4 mb-4">
            <div>
              <h3 className="font-bold text-lg m-0">Recent Orders</h3>
              <p className="text-muted text-[13px] mt-1 m-0">Latest eBay sales records</p>
            </div>
            <Link href="/orders" className="text-blue font-semibold text-sm">
              View all
            </Link>
          </div>

          {!recentOrders || recentOrders.length === 0 ? (
            <div className="text-muted text-center py-4">No orders yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
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
                      <td className="p-3">{order.order_id}</td>
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
          )}
        </div>

        <div className="card p-[18px]">
          <h3 className="font-bold text-lg m-0 mb-4">Quick Actions</h3>
          <div className="grid gap-2.5">
            <Link href="/products/new" className="btn-secondary text-left justify-start">
              + Add New Product
            </Link>
            <Link href="/research" className="btn-secondary text-left justify-start">
              ⌕ Research Product
            </Link>
            <Link href="/orders" className="btn-secondary text-left justify-start">
              ▤ Add Order
            </Link>
            <Link href="/inventory" className="btn-secondary text-left justify-start">
              ▣ Check Inventory
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

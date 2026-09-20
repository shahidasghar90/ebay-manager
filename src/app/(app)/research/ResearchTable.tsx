'use client';

import Link from 'next/link';
import { formatMoney, statusClassName } from '@/lib/format';
import type { ResearchItem } from '@/lib/types';

export default function ResearchTable({ items }: { items: ResearchItem[] }) {
  if (items.length === 0) {
    return <div className="card p-6 text-center text-muted">No research records yet.</div>;
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
              <th className="p-3">Keyword</th>
              <th className="p-3">Model</th>
              <th className="p-3">Price</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border">
                <td className="p-3">{item.keyword}</td>
                <td className="p-3">{item.potential_model}</td>
                <td className="p-3">{formatMoney(item.product_price_local)}</td>
                <td className="p-3">
                  <span className={statusClassName(item.research_status)}>
                    {item.research_status}
                  </span>
                </td>
                <td className="p-3">
                  <Link
                    href={`/products/new?researchId=${item.id}`}
                    className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue"
                  >
                    Convert to Product
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

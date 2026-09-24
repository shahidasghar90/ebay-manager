'use client';

import Link from 'next/link';
import { formatDate, formatMoney, statusClassName } from '@/lib/format';
import type { ReturnCase } from '@/lib/types';

export default function ReturnsTable({ cases }: { cases: ReturnCase[] }) {
  if (cases.length === 0) {
    return <div className="card p-6 text-center text-muted">No return cases yet.</div>;
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="responsive-table w-full text-sm md:min-w-[720px]">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
              <th className="p-3">Case ID</th>
              <th className="p-3">Order ID</th>
              <th className="p-3">Date</th>
              <th className="p-3">Reason</th>
              <th className="p-3">Refund</th>
              <th className="p-3">Net Loss</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((item) => (
              <tr key={item.case_id} className="border-b border-border">
                <td className="p-3 font-semibold" data-label="Case ID">{item.case_id}</td>
                <td className="p-3" data-label="Order ID">{item.order_id || '—'}</td>
                <td className="p-3" data-label="Date">{formatDate(item.case_date)}</td>
                <td className="p-3" data-label="Reason">{item.reason}</td>
                <td className="p-3" data-label="Refund">{formatMoney(item.refund_eur)}</td>
                <td className="p-3" data-label="Net Loss">{formatMoney(item.net_loss_eur)}</td>
                <td className="p-3" data-label="Status">
                  <span className={statusClassName(item.status)}>{item.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

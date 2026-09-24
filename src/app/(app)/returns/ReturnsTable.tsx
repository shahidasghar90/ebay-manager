'use client';

import Link from 'next/link';
import { formatDate, formatMoney, statusClassName } from '@/lib/format';
import type { ReturnCase } from '@/lib/types';
import { RecordAuthorCell, RecordAuthorShort } from '@/components/RecordAuthor';

export default function ReturnsTable({ cases }: { cases: ReturnCase[] }) {
  if (cases.length === 0) {
    return <div className="card p-6 text-center text-muted">No return cases yet.</div>;
  }

  return (
    <>
      {/* Phones: one compact card per return case. */}
      <ul className="md:hidden grid gap-2.5">
        {cases.map((item) => (
          <li key={item.case_id} className="card p-3">
            <div className="flex items-start justify-between gap-2">
              <strong className="text-sm break-all">{item.case_id}</strong>
              <span className={`${statusClassName(item.status)} shrink-0`}>{item.status}</span>
            </div>
            <p className="text-muted text-xs m-0 mt-0.5 truncate">
              {formatDate(item.case_date)}
              {item.order_id ? ` · Order ${item.order_id}` : ''}
            </p>
            <p className="text-[13px] m-0 mt-1.5 break-words">{item.reason}</p>
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <p className="text-[13px] m-0 flex flex-wrap gap-x-3">
                <span>
                  Refund <strong>{formatMoney(item.refund_eur)}</strong>
                </span>
                <span>
                  Loss <strong className="text-red">{formatMoney(item.net_loss_eur)}</strong>
                </span>
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 mt-2">
              <RecordAuthorShort record={item} />
              <Link href={`/returns/${item.case_id}/edit`} className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue shrink-0">
                Edit
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden md:block card overflow-hidden">
        <div className="table-scroll">
          <table className="responsive-table data-table w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
                <th className="p-3">Case ID</th>
                <th className="p-3">Order ID</th>
                <th className="p-3">Date</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Refund</th>
                <th className="p-3">Net Loss</th>
                <th className="p-3">Last Edited</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((item) => (
                <tr key={item.case_id} className="border-b border-border">
                  <td className="p-3 font-semibold" data-label="Case ID">{item.case_id}</td>
                  <td className="p-3" data-label="Order ID">{item.order_id || '—'}</td>
                  <td className="p-3" data-label="Date">{formatDate(item.case_date)}</td>
                  <td className="p-3 cell-wrap w-full" data-label="Reason">
                    <span className="line-clamp-2" title={item.reason}>{item.reason}</span>
                  </td>
                  <td className="p-3" data-label="Refund">{formatMoney(item.refund_eur)}</td>
                  <td className="p-3" data-label="Net Loss">{formatMoney(item.net_loss_eur)}</td>
                  <td className="p-3" data-label="Last Edited">
                    <RecordAuthorCell record={item} />
                  </td>
                  <td className="p-3" data-label="Status">
                    <span className={statusClassName(item.status)}>{item.status}</span>
                  </td>
                  <td className="p-3 cell-actions">
                    <Link
                      href={`/returns/${item.case_id}/edit`}
                      className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

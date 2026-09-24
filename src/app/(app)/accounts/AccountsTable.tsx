'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDate, formatMoney } from '@/lib/format';
import { summarizeVat } from '@/lib/vat';
import { buildLedgerRows, signedAmount } from '@/lib/ledgerRows';
import type { AccountTx } from '@/lib/types';
import { RecordAuthorCell, RecordAuthorShort } from '@/components/RecordAuthor';

export default function AccountsTable({
  transactions,
  vatRegistered
}: {
  transactions: AccountTx[];
  vatRegistered: boolean;
}) {
  const [directionFilter, setDirectionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const typeFiltered = useMemo(
    () => (typeFilter ? transactions.filter((tx) => tx.type === typeFilter) : transactions),
    [transactions, typeFilter]
  );

  // A type filter looks at single entries (e.g. every Fee VAT line); otherwise
  // each order/return is one row with its net amount.
  const rows = useMemo(() => {
    const all = typeFilter ? typeFiltered.map((tx) => buildLedgerRows([tx])[0]) : buildLedgerRows(typeFiltered);
    if (!directionFilter) return all;
    return all.filter((row) => (directionFilter === 'In' ? row.netEur >= 0 : row.netEur < 0));
  }, [typeFiltered, typeFilter, directionFilter]);

  const totals = useMemo(() => {
    const totalIn = rows.filter((row) => row.netEur >= 0).reduce((sum, row) => sum + row.netEur, 0);
    const totalOut = rows.filter((row) => row.netEur < 0).reduce((sum, row) => sum - row.netEur, 0);

    // VAT eBay charged on its fees: a cost, not reclaimable without VAT registration.
    const feeVat = rows
      .flatMap((row) => row.parts)
      .filter((tx) => tx.type === 'Fee VAT')
      .reduce((sum, tx) => sum + Number(tx.amount_eur || 0), 0);

    return { totalIn, totalOut, net: totalIn - totalOut, feeVat };
  }, [rows]);

  const vatSummary = useMemo(() => summarizeVat(rows.flatMap((row) => row.parts)), [rows]);

  const types = useMemo(
    () => Array.from(new Set(transactions.map((tx) => tx.type))).sort(),
    [transactions]
  );

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <SummaryCard label="Total In" value={formatMoney(totals.totalIn)} tone="text-green" />
        <SummaryCard label="Total Out" value={formatMoney(totals.totalOut)} tone="text-red" />
        <SummaryCard
          label="Net"
          value={formatMoney(totals.net)}
          tone={totals.net < 0 ? 'text-red' : 'text-green'}
        />
        <SummaryCard label="VAT on eBay Fees" value={formatMoney(totals.feeVat)} tone="text-red" />
      </div>

      {vatRegistered && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
          <SummaryCard label="VAT Collected" value={formatMoney(vatSummary.vatCollectedEur)} />
          <SummaryCard label="VAT Paid" value={formatMoney(vatSummary.vatPaidEur)} />
          <SummaryCard
            label="VAT Payable"
            value={formatMoney(vatSummary.vatPayableEur)}
            tone={vatSummary.vatPayableEur < 0 ? 'text-red' : ''}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2.5 mb-4">
        <select
          className="field-input !w-auto min-w-[150px]"
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value)}
        >
          <option value="">All Directions</option>
          <option value="In">In</option>
          <option value="Out">Out</option>
        </select>

        <select
          className="field-input !w-auto min-w-[150px]"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Phones: one compact card per row. */}
      <ul className="md:hidden grid gap-2.5">
        {rows.length === 0 ? (
          <li className="card p-6 text-center text-muted">No transactions found.</li>
        ) : (
          rows.map((row) => {
            const grouped = row.parts.length > 1;
            return (
              <li key={row.key} className="card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="text-sm block truncate">
                      {row.title}
                      {grouped && <span className="font-normal"> · {row.category}</span>}
                    </strong>
                    <span className="text-muted text-xs block truncate">
                      {formatDate(row.date)}
                      {!grouped && ` · ${row.category}`}
                    </span>
                  </div>
                  <Amount value={row.netEur} className="shrink-0 text-base" />
                </div>
                {grouped ? (
                  <Breakdown parts={row.parts} />
                ) : (
                  (row.notes || (vatRegistered && row.vatEur != null)) && (
                    <p className="text-[13px] text-muted m-0 mt-1.5 break-words line-clamp-2">
                      {vatRegistered && row.vatEur != null && `VAT ${formatMoney(row.vatEur)}`}
                      {vatRegistered && row.vatEur != null && row.notes && ' · '}
                      {row.notes}
                    </p>
                  )
                )}
                <div className="flex items-center justify-between gap-2 mt-2">
                  <RecordAuthorShort record={row.author} />
                  <Link
                    href={row.href}
                    className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue shrink-0"
                  >
                    {grouped ? 'View' : 'Edit'}
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
                <th className="p-3">Date</th>
                <th className="p-3">Type</th>
                <th className="p-3">Category</th>
                <th className="p-3">Amount</th>
                {vatRegistered && <th className="p-3">VAT</th>}
                <th className="p-3">Details</th>
                <th className="p-3">Last Edited</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={vatRegistered ? 8 : 7} className="cell-empty text-center text-muted p-5">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const grouped = row.parts.length > 1;
                  return (
                    <tr key={row.key} className="border-b border-border">
                      <td className="p-3" data-label="Date">{formatDate(row.date)}</td>
                      <td className="p-3 font-semibold" data-label="Type">{row.title}</td>
                      <td className="p-3" data-label="Category">
                        {grouped ? (
                          <Link href={row.href} className="font-semibold hover:text-blue">
                            {row.category}
                          </Link>
                        ) : (
                          row.category
                        )}
                      </td>
                      <td className="p-3" data-label="Amount">
                        <Amount value={row.netEur} />
                      </td>
                      {vatRegistered && (
                        <td className="p-3" data-label="VAT">
                          {row.vatEur != null ? formatMoney(row.vatEur) : '—'}
                        </td>
                      )}
                      <td className="p-3 cell-wrap w-full" data-label="Details">
                        {grouped ? (
                          <Breakdown parts={row.parts} />
                        ) : (
                          <span className="line-clamp-2" title={row.notes || undefined}>
                            {row.notes || '—'}
                          </span>
                        )}
                      </td>
                      <td className="p-3" data-label="Last Edited">
                        <RecordAuthorCell record={row.author} />
                      </td>
                      <td className="p-3 cell-actions">
                        <Link
                          href={row.href}
                          className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue"
                        >
                          {grouped ? 'View' : 'Edit'}
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

function Amount({ value, className = '' }: { value: number; className?: string }) {
  return (
    <strong className={`${value >= 0 ? 'text-green' : 'text-red'} ${className}`}>
      {value >= 0 ? '+' : '−'}
      {formatMoney(Math.abs(value))}
    </strong>
  );
}

/** "Sale +7,80 € · Fees -1,59 € · ..." for one order or return. */
function Breakdown({ parts }: { parts: AccountTx[] }) {
  return (
    <p className="text-xs text-muted m-0 mt-1.5 md:mt-0 flex flex-wrap gap-x-2.5 gap-y-0.5">
      {parts.map((tx) => (
        <span key={tx.tx_id} className="whitespace-nowrap">
          {tx.type} <Amount value={signedAmount(tx)} />
        </span>
      ))}
    </p>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <span className="text-[11px] uppercase text-muted font-bold">{label}</span>
      <strong className={`text-lg ${tone || ''}`}>{value}</strong>
    </div>
  );
}

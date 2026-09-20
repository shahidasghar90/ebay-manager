'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDate, formatMoney } from '@/lib/format';
import { summarizeVat } from '@/lib/vat';
import type { AccountTx } from '@/lib/types';

export default function AccountsTable({
  transactions,
  vatRegistered
}: {
  transactions: AccountTx[];
  vatRegistered: boolean;
}) {
  const [directionFilter, setDirectionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (directionFilter && tx.direction !== directionFilter) return false;
      if (typeFilter && tx.type !== typeFilter) return false;
      return true;
    });
  }, [transactions, directionFilter, typeFilter]);

  const totals = useMemo(() => {
    const totalIn = filtered
      .filter((tx) => tx.direction === 'In')
      .reduce((sum, tx) => sum + Number(tx.amount_eur || 0), 0);
    const totalOut = filtered
      .filter((tx) => tx.direction === 'Out')
      .reduce((sum, tx) => sum + Number(tx.amount_eur || 0), 0);

    return { totalIn, totalOut, net: totalIn - totalOut };
  }, [filtered]);

  const vatSummary = useMemo(() => summarizeVat(filtered), [filtered]);

  const types = useMemo(
    () => Array.from(new Set(transactions.map((tx) => tx.type))).sort(),
    [transactions]
  );

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
        <SummaryCard label="Total In" value={formatMoney(totals.totalIn)} tone="text-green" />
        <SummaryCard label="Total Out" value={formatMoney(totals.totalOut)} tone="text-red" />
        <SummaryCard
          label="Net"
          value={formatMoney(totals.net)}
          tone={totals.net < 0 ? 'text-red' : 'text-green'}
        />
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
          className="field-input w-auto min-w-[150px]"
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value)}
        >
          <option value="">All Directions</option>
          <option value="In">In</option>
          <option value="Out">Out</option>
        </select>

        <select
          className="field-input w-auto min-w-[150px]"
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

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
                <th className="p-3">Date</th>
                <th className="p-3">Type</th>
                <th className="p-3">Category</th>
                <th className="p-3">Amount</th>
                {vatRegistered && <th className="p-3">VAT</th>}
                <th className="p-3">Direction</th>
                <th className="p-3">Notes</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={vatRegistered ? 8 : 7} className="text-center text-muted p-5">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                  <tr key={tx.tx_id} className="border-b border-border">
                    <td className="p-3">{formatDate(tx.tx_date)}</td>
                    <td className="p-3">{tx.type}</td>
                    <td className="p-3">{tx.category}</td>
                    <td className={`p-3 ${tx.direction === 'In' ? 'text-green' : 'text-red'}`}>
                      {formatMoney(tx.amount_eur)}
                    </td>
                    {vatRegistered && (
                      <td className="p-3">
                        {tx.vat_amount_eur != null ? formatMoney(tx.vat_amount_eur) : '—'}
                      </td>
                    )}
                    <td className="p-3">{tx.direction}</td>
                    <td className="p-3">{tx.notes || '—'}</td>
                    <td className="p-3">
                      <Link
                        href={`/accounts/${tx.tx_id}/edit`}
                        className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue"
                      >
                        Edit
                      </Link>
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

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <span className="text-[11px] uppercase text-muted font-bold">{label}</span>
      <strong className={`text-lg ${tone || ''}`}>{value}</strong>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { formatMoney } from '@/lib/format';
import type { AccountTx } from '@/lib/types';

type Head = 'category' | 'type';
type Preset = 'month' | 'lastMonth' | 'year' | 'all';

function isoDate(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function presetRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  if (preset === 'month') {
    return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(now) };
  }
  if (preset === 'lastMonth') {
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: isoDate(new Date(now.getFullYear(), now.getMonth(), 0))
    };
  }
  if (preset === 'year') {
    return { from: isoDate(new Date(now.getFullYear(), 0, 1)), to: isoDate(now) };
  }
  return { from: '', to: '' };
}

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' }
];

export default function HeadWiseDashboard({ transactions }: { transactions: AccountTx[] }) {
  const [head, setHead] = useState<Head>('category');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preset, setPreset] = useState<Preset | ''>('all');

  function applyPreset(next: Preset) {
    const range = presetRange(next);
    setFrom(range.from);
    setTo(range.to);
    setPreset(next);
  }

  const inRange = useMemo(
    () => transactions.filter((tx) => (!from || tx.tx_date >= from) && (!to || tx.tx_date <= to)),
    [transactions, from, to]
  );

  const totals = useMemo(() => {
    const totalIn = inRange
      .filter((tx) => tx.direction === 'In')
      .reduce((sum, tx) => sum + Number(tx.amount_eur || 0), 0);
    const totalOut = inRange
      .filter((tx) => tx.direction === 'Out')
      .reduce((sum, tx) => sum + Number(tx.amount_eur || 0), 0);
    return { totalIn, totalOut, net: totalIn - totalOut };
  }, [inRange]);

  const heads = useMemo(() => {
    const map = new Map<string, { name: string; inEur: number; outEur: number; count: number }>();
    for (const tx of inRange) {
      const name = (head === 'category' ? tx.category : tx.type)?.trim() || 'Uncategorized';
      const entry = map.get(name) || { name, inEur: 0, outEur: 0, count: 0 };
      const amount = Number(tx.amount_eur || 0);
      if (tx.direction === 'In') entry.inEur += amount;
      else entry.outEur += amount;
      entry.count += 1;
      map.set(name, entry);
    }
    return Array.from(map.values())
      .map((entry) => ({ ...entry, net: entry.inEur - entry.outEur }))
      .sort((a, b) => b.inEur + b.outEur - (a.inEur + a.outEur));
  }, [inRange, head]);

  const maxFlow = Math.max(1, ...heads.map((entry) => Math.max(entry.inEur, entry.outEur)));
  const headLabel = head === 'category' ? 'Category' : 'Type';

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2.5 mb-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-full">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => applyPreset(item.id)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold ${
                preset === item.id ? 'bg-blue text-white border-blue' : 'bg-white text-muted border-border'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="field-label">
          From
          <input
            type="date"
            className="field-input"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPreset('');
            }}
          />
        </label>
        <label className="field-label">
          To
          <input
            type="date"
            className="field-input"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPreset('');
            }}
          />
        </label>

        <select
          className="field-input !w-auto min-w-[150px]"
          value={head}
          onChange={(e) => setHead(e.target.value as Head)}
          aria-label="Group by"
        >
          <option value="category">By Category</option>
          <option value="type">By Type</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4">
        <SummaryCard label="Total In" value={formatMoney(totals.totalIn)} tone="text-green" />
        <SummaryCard label="Total Out" value={formatMoney(totals.totalOut)} tone="text-red" />
        <SummaryCard
          label="Net"
          value={formatMoney(totals.net)}
          tone={totals.net < 0 ? 'text-red' : 'text-green'}
        />
      </div>

      {heads.length === 0 ? (
        <div className="card p-6 text-center text-muted">No transactions in this period.</div>
      ) : (
        <>
          {/* Phones: one card per head. */}
          <ul className="md:hidden grid gap-2.5">
            {heads.map((entry) => (
              <li key={entry.name} className="card p-3">
                <div className="flex items-start justify-between gap-2">
                  <strong className="text-sm min-w-0 break-words">{entry.name}</strong>
                  <strong className={entry.net < 0 ? 'text-red' : 'text-green'}>{formatMoney(entry.net)}</strong>
                </div>
                <p className="text-[13px] m-0 mt-1.5 flex flex-wrap gap-x-3">
                  <span>
                    In <strong className="text-green">{formatMoney(entry.inEur)}</strong>
                  </span>
                  <span>
                    Out <strong className="text-red">{formatMoney(entry.outEur)}</strong>
                  </span>
                  <span className="text-muted">{entry.count} entries</span>
                </p>
                <FlowBar inEur={entry.inEur} outEur={entry.outEur} max={maxFlow} />
              </li>
            ))}
          </ul>

          <div className="hidden md:block card overflow-hidden">
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
                    <th className="p-3">{headLabel}</th>
                    <th className="p-3 text-right">Entries</th>
                    <th className="p-3 text-right">In</th>
                    <th className="p-3 text-right">Out</th>
                    <th className="p-3 text-right">Net</th>
                    <th className="p-3 w-[28%]">In vs Out</th>
                  </tr>
                </thead>
                <tbody>
                  {heads.map((entry) => (
                    <tr key={entry.name} className="border-b border-border">
                      <td className="p-3 font-semibold">{entry.name}</td>
                      <td className="p-3 text-right">{entry.count}</td>
                      <td className="p-3 text-right text-green">{formatMoney(entry.inEur)}</td>
                      <td className="p-3 text-right text-red">{formatMoney(entry.outEur)}</td>
                      <td className={`p-3 text-right font-bold ${entry.net < 0 ? 'text-red' : 'text-green'}`}>
                        {formatMoney(entry.net)}
                      </td>
                      <td className="p-3">
                        <FlowBar inEur={entry.inEur} outEur={entry.outEur} max={maxFlow} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold">
                    <td className="p-3">Total</td>
                    <td className="p-3 text-right">{inRange.length}</td>
                    <td className="p-3 text-right text-green">{formatMoney(totals.totalIn)}</td>
                    <td className="p-3 text-right text-red">{formatMoney(totals.totalOut)}</td>
                    <td className={`p-3 text-right ${totals.net < 0 ? 'text-red' : 'text-green'}`}>
                      {formatMoney(totals.net)}
                    </td>
                    <td className="p-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FlowBar({ inEur, outEur, max }: { inEur: number; outEur: number; max: number }) {
  return (
    <div className="grid gap-1 mt-2 md:mt-0" aria-hidden>
      <div className="h-1.5 rounded bg-slate-100">
        <div className="h-full rounded bg-green" style={{ width: `${(inEur / max) * 100}%` }} />
      </div>
      <div className="h-1.5 rounded bg-slate-100">
        <div className="h-full rounded bg-red" style={{ width: `${(outEur / max) * 100}%` }} />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card p-3 sm:p-4 flex flex-col gap-1 min-w-0">
      <span className="text-[11px] uppercase text-muted font-bold">{label}</span>
      <strong className={`text-base sm:text-lg ${tone || ''}`}>{value}</strong>
    </div>
  );
}

import type { AccountTx } from './types';

const HEADERS = [
  'Date',
  'Transaction ID',
  'Reference',
  'Type',
  'Category',
  'Direction',
  'Amount EUR',
  'Signed Amount EUR',
  'VAT Rate %',
  'VAT Amount EUR',
  'Notes'
];

function text(value: string | null | undefined) {
  let out = value ?? '';
  // Stop spreadsheet apps from running a note that starts like a formula.
  if (/^[=+\-@\t\r]/.test(out)) out = `'${out}`;
  return `"${out.replace(/"/g, '""')}"`;
}

function amount(value: number | null | undefined) {
  return value == null ? '' : String(Number(value));
}

/** One CSV line per ledger entry, so the file can be summed or pivoted in a spreadsheet. */
export function buildAccountsCsv(transactions: AccountTx[]): string {
  const lines = transactions.map((tx) => {
    const value = Number(tx.amount_eur || 0);
    return [
      tx.tx_date,
      tx.tx_id,
      text(tx.ref_id),
      text(tx.type),
      text(tx.category),
      tx.direction,
      amount(value),
      amount(tx.direction === 'In' ? value : -value),
      amount(tx.vat_rate_percent),
      amount(tx.vat_amount_eur),
      text(tx.notes)
    ].join(',');
  });

  // BOM so Excel reads the file as UTF-8.
  return `﻿${[HEADERS.join(','), ...lines].join('\r\n')}\r\n`;
}

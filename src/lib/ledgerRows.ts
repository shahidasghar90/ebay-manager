import type { AccountTx } from './types';

/**
 * One line in the Accounts list. Auto entries that belong to the same order or
 * return (Sale, Fees, Fee VAT, Shipping, Adjustment...) are shown as a single
 * line with their net amount; the individual entries stay in `parts`.
 */
export type LedgerRow = {
  key: string;
  date: string;
  title: string;
  category: string;
  /** Signed: positive = money in, negative = money out. */
  netEur: number;
  vatEur: number | null;
  notes: string | null;
  href: string;
  parts: AccountTx[];
  author: AccountTx;
};

const PART_ORDER = ['Sale', 'Fees', 'Fee VAT', 'Shipping', 'Adjustment', 'Refund', 'Return Cost', 'Fee Credit'];

const GROUPED_REFS: Record<string, { title: string; href: (id: string) => string }> = {
  order: { title: 'Order', href: (id) => `/orders/${id}` },
  return: { title: 'Return', href: (id) => `/returns/${id}/edit` }
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function signedAmount(tx: AccountTx) {
  const amount = Number(tx.amount_eur || 0);
  return tx.direction === 'In' ? amount : -amount;
}

function partRank(tx: AccountTx) {
  const index = PART_ORDER.indexOf(tx.type);
  return index === -1 ? PART_ORDER.length : index;
}

function singleRow(tx: AccountTx): LedgerRow {
  return {
    key: tx.tx_id,
    date: tx.tx_date,
    title: tx.type,
    category: tx.category,
    netEur: signedAmount(tx),
    vatEur: tx.vat_amount_eur,
    notes: tx.notes,
    href: `/accounts/${tx.tx_id}/edit`,
    parts: [tx],
    author: tx
  };
}

/** Groups order/return auto entries into one row each; everything else stays as is. */
export function buildLedgerRows(transactions: AccountTx[]): LedgerRow[] {
  const groups = new Map<string, AccountTx[]>();
  const rows: LedgerRow[] = [];

  for (const tx of transactions) {
    if (tx.ref_type && tx.ref_id && GROUPED_REFS[tx.ref_type]) {
      const key = `${tx.ref_type}:${tx.ref_id}`;
      if (!groups.has(key)) {
        groups.set(key, []);
        // Placeholder keeps the group where its first entry appeared.
        rows.push({ key } as LedgerRow);
      }
      groups.get(key)!.push(tx);
    } else {
      rows.push(singleRow(tx));
    }
  }

  return rows.map((row) => {
    const parts = groups.get(row.key);
    if (!parts) return row;

    const [refType, refId] = row.key.split(':');
    const ref = GROUPED_REFS[refType];
    const sorted = [...parts].sort((a, b) => partRank(a) - partRank(b));
    const vatParts = sorted.filter((tx) => tx.vat_amount_eur != null);
    const latest = sorted.reduce((a, b) => ((b.updated_at || '') > (a.updated_at || '') ? b : a));

    return {
      key: row.key,
      date: sorted.reduce((max, tx) => (tx.tx_date > max ? tx.tx_date : max), sorted[0].tx_date),
      title: ref.title,
      category: refId,
      netEur: round2(sorted.reduce((sum, tx) => sum + signedAmount(tx), 0)),
      vatEur: vatParts.length ? round2(vatParts.reduce((sum, tx) => sum + Number(tx.vat_amount_eur), 0)) : null,
      notes: null,
      href: ref.href(refId),
      parts: sorted,
      author: latest
    };
  });
}

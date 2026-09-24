import { describe, expect, it } from 'vitest';
import { buildLedgerRows } from './ledgerRows';
import type { AccountTx } from './types';

function tx(partial: Partial<AccountTx>): AccountTx {
  return {
    tx_id: partial.tx_id || Math.random().toString(36),
    tx_date: '2026-09-24',
    type: 'Sale',
    category: 'eBay Sales',
    amount_eur: 0,
    direction: 'In',
    vat_rate_percent: null,
    vat_amount_eur: null,
    notes: null,
    ref_type: null,
    ref_id: null,
    ...partial
  };
}

describe('buildLedgerRows', () => {
  it('turns one closed order into a single row with its net payout', () => {
    const order = { ref_type: 'order', ref_id: 'EB-1' };
    const rows = buildLedgerRows([
      tx({ ...order, type: 'Fees', amount_eur: 1.59, direction: 'Out' }),
      tx({ ...order, type: 'Shipping', amount_eur: 1.8, direction: 'Out' }),
      tx({ ...order, type: 'Adjustment', amount_eur: 0.08, direction: 'In' }),
      tx({ ...order, type: 'Sale', amount_eur: 7.8, direction: 'In' }),
      tx({ ...order, type: 'Fee VAT', amount_eur: 0.21, direction: 'Out' }),
      tx({ type: 'Rent', category: 'Office', amount_eur: 100, direction: 'Out' })
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe('Order');
    expect(rows[0].category).toBe('EB-1');
    expect(rows[0].netEur).toBe(4.28);
    expect(rows[0].href).toBe('/orders/EB-1');
    expect(rows[0].parts.map((p) => p.type)).toEqual(['Sale', 'Fees', 'Fee VAT', 'Shipping', 'Adjustment']);
    expect(rows[1].title).toBe('Rent');
    expect(rows[1].netEur).toBe(-100);
  });
});

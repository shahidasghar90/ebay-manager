import { describe, expect, it } from 'vitest';
import { calculateVatAmount, summarizeVat } from './vat';

describe('calculateVatAmount', () => {
  it('computes VAT from a gross amount and rate', () => {
    expect(calculateVatAmount(119, 19)).toBe(22.61);
  });

  it('returns 0 for a 0 amount', () => {
    expect(calculateVatAmount(0, 19)).toBe(0);
  });
});

describe('summarizeVat', () => {
  it('sums collected (In) and paid (Out) VAT separately and computes payable', () => {
    const summary = summarizeVat([
      { direction: 'In', vat_amount_eur: 20 },
      { direction: 'In', vat_amount_eur: 5 },
      { direction: 'Out', vat_amount_eur: 8 },
      { direction: 'Out', vat_amount_eur: null }
    ]);

    expect(summary.vatCollectedEur).toBe(25);
    expect(summary.vatPaidEur).toBe(8);
    expect(summary.vatPayableEur).toBe(17);
  });

  it('returns zeros for an empty ledger', () => {
    const summary = summarizeVat([]);

    expect(summary).toEqual({ vatCollectedEur: 0, vatPaidEur: 0, vatPayableEur: 0 });
  });
});

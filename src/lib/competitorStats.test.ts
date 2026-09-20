import { describe, expect, it } from 'vitest';
import { summarizeCompetitorPrices } from './competitorStats';

describe('summarizeCompetitorPrices', () => {
  it('computes min, max, and avg for multiple prices', () => {
    const result = summarizeCompetitorPrices([
      { platform: 'eBay.de', price: 25 },
      { platform: 'Amazon.de', price: 30 },
      { platform: 'Kleinanzeigen', price: 20 }
    ]);

    expect(result.min).toBe(20);
    expect(result.max).toBe(30);
    expect(result.avg).toBe(25);
  });

  it('ignores zero or negative prices', () => {
    const result = summarizeCompetitorPrices([
      { platform: 'eBay.de', price: 25 },
      { platform: 'Bad Entry', price: 0 }
    ]);

    expect(result.min).toBe(25);
    expect(result.max).toBe(25);
  });

  it('returns nulls for an empty list', () => {
    const result = summarizeCompetitorPrices([]);

    expect(result).toEqual({ min: null, max: null, avg: null });
  });
});

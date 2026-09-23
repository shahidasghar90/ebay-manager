import { describe, expect, it } from 'vitest';
import { mapSettingsRows } from './settings';

describe('mapSettingsRows', () => {
  it('maps known keys and applies defaults for missing ones', () => {
    const result = mapSettingsRows([
      { key: 'fx_usd', value: 1.1 },
      { key: 'vat_registered', value: 1 },
      { key: 'vat_rate_percent', value: 7 }
    ]);

    expect(result.fxRates).toEqual({ EUR: 1, USD: 1.1, PKR: 310, CNY: 7.8 });
    expect(result.vatRegistered).toBe(true);
    expect(result.vatRatePercent).toBe(7);
  });

  it('defaults vatRegistered to false and vatRatePercent to 19 when absent', () => {
    const result = mapSettingsRows([]);

    expect(result.vatRegistered).toBe(false);
    expect(result.vatRatePercent).toBe(19);
  });
});

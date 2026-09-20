import { SupabaseClient } from '@supabase/supabase-js';
import type { Settings } from './types';

const DEFAULT_SETTINGS: Settings = {
  fxRates: { EUR: 1, USD: 1.08, PKR: 310 },
  ebayFeePercent: 0.129,
  paymentFeePercent: 0.029,
  fixedPaymentFeeEur: 0.35,
  vatRegistered: false,
  vatRatePercent: 19
};

export function mapSettingsRows(rows: { key: string; value: number }[]): Settings {
  const byKey = Object.fromEntries(rows.map((row) => [row.key, Number(row.value)]));

  return {
    fxRates: {
      EUR: 1,
      USD: byKey.fx_usd ?? DEFAULT_SETTINGS.fxRates.USD,
      PKR: byKey.fx_pkr ?? DEFAULT_SETTINGS.fxRates.PKR
    },
    ebayFeePercent: byKey.ebay_fee_percent ?? DEFAULT_SETTINGS.ebayFeePercent,
    paymentFeePercent: byKey.payment_fee_percent ?? DEFAULT_SETTINGS.paymentFeePercent,
    fixedPaymentFeeEur: byKey.fixed_payment_fee_eur ?? DEFAULT_SETTINGS.fixedPaymentFeeEur,
    vatRegistered: (byKey.vat_registered ?? 0) === 1,
    vatRatePercent: byKey.vat_rate_percent ?? DEFAULT_SETTINGS.vatRatePercent
  };
}

export async function fetchSettings(supabase: SupabaseClient): Promise<Settings> {
  const { data } = await supabase.from('settings').select('key, value');

  if (!data) return DEFAULT_SETTINGS;

  return mapSettingsRows(data as { key: string; value: number }[]);
}

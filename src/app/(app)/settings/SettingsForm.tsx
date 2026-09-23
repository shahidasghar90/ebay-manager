'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Settings } from '@/lib/types';

export default function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const supabase = createClient();

  const [fxUsd, setFxUsd] = useState(String(settings.fxRates.USD));
  const [fxPkr, setFxPkr] = useState(String(settings.fxRates.PKR));
  const [ebayFeePercent, setEbayFeePercent] = useState(String(settings.ebayFeePercent));
  const [paymentFeePercent, setPaymentFeePercent] = useState(String(settings.paymentFeePercent));
  const [fixedPaymentFeeEur, setFixedPaymentFeeEur] = useState(String(settings.fixedPaymentFeeEur));
  const [vatRegistered, setVatRegistered] = useState(settings.vatRegistered);
  const [vatRatePercent, setVatRatePercent] = useState(String(settings.vatRatePercent));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function num(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);

    const rows = [
      { key: 'fx_usd', value: num(fxUsd) },
      { key: 'fx_pkr', value: num(fxPkr) },
      { key: 'ebay_fee_percent', value: num(ebayFeePercent) },
      { key: 'payment_fee_percent', value: num(paymentFeePercent) },
      { key: 'fixed_payment_fee_eur', value: num(fixedPaymentFeeEur) },
      { key: 'vat_registered', value: vatRegistered ? 1 : 0 },
      { key: 'vat_rate_percent', value: num(vatRatePercent) }
    ];

    const { error: saveError } = await supabase
      .from('settings')
      .upsert(rows, { onConflict: 'workspace_id,key' });

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 grid gap-3.5 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-3.5">
        <label className="field-label">
          USD to EUR Rate
          <input
            className="field-input"
            type="number"
            step="0.0001"
            value={fxUsd}
            onChange={(e) => setFxUsd(e.target.value)}
          />
        </label>

        <label className="field-label">
          PKR to EUR Rate
          <input
            className="field-input"
            type="number"
            step="0.0001"
            value={fxPkr}
            onChange={(e) => setFxPkr(e.target.value)}
          />
        </label>

        <label className="field-label">
          eBay Fee %
          <input
            className="field-input"
            type="number"
            step="0.001"
            value={ebayFeePercent}
            onChange={(e) => setEbayFeePercent(e.target.value)}
          />
        </label>

        <label className="field-label">
          Payment Fee %
          <input
            className="field-input"
            type="number"
            step="0.001"
            value={paymentFeePercent}
            onChange={(e) => setPaymentFeePercent(e.target.value)}
          />
        </label>

        <label className="field-label">
          Fixed Payment Fee (EUR)
          <input
            className="field-input"
            type="number"
            step="0.01"
            value={fixedPaymentFeeEur}
            onChange={(e) => setFixedPaymentFeeEur(e.target.value)}
          />
        </label>
      </div>

      <div className="border-t border-border pt-3.5 grid sm:grid-cols-2 gap-3.5">
        <label className="field-label flex-row items-center gap-2 flex">
          <input
            type="checkbox"
            checked={vatRegistered}
            onChange={(e) => setVatRegistered(e.target.checked)}
          />
          VAT Registered (Regelbesteuerung)
        </label>

        {vatRegistered && (
          <label className="field-label">
            VAT Rate %
            <input
              className="field-input"
              type="number"
              step="0.01"
              value={vatRatePercent}
              onChange={(e) => setVatRatePercent(e.target.value)}
            />
          </label>
        )}
      </div>

      <p className="text-muted text-[13px] -mt-1">
        Leave VAT Registered unchecked if operating as a Kleinunternehmer
        (§19 UStG) — no VAT fields will appear on Accounts entries.
      </p>

      {error && <p className="text-red font-semibold">{error}</p>}
      {saved && <p className="text-green font-semibold">Settings saved.</p>}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}

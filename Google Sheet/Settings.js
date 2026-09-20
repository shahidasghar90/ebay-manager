/* =========================
   SETTINGS
========================= */

function getSettingsData_() {
  const settings = {
    fxRates: { EUR: 1, USD: 1, PKR: 1 },
    ebayFeePercent: 0.129,
    paymentFeePercent: 0.029,
    fixedPaymentFeeEur: 0.35
  };

  let sheet;

  try {
    sheet = getSheet_(SHEETS.SETTINGS);
  } catch (error) {
    return settings;
  }

  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const section = String(values[i][0] || '').trim();
    const key = String(values[i][1] || '').trim();
    const value = values[i][2];

    if (section === 'Currency' && key) {
      settings.fxRates[key] = toNumber_(value, 1);
    }

    if (section === 'Fees' && key === 'eBayFeePercent') {
      settings.ebayFeePercent = toNumber_(value, 0.129);
    }

    if (section === 'Fees' && key === 'PaymentFeePercent') {
      settings.paymentFeePercent = toNumber_(value, 0.029);
    }

    if (section === 'Fees' && key === 'FixedPaymentFeeEur') {
      settings.fixedPaymentFeeEur = toNumber_(value, 0.35);
    }
  }

  return settings;
}

function getSettings() {
  return getSettingsData_();
}

function getFxRate_(currency) {
  if (!currency || currency === 'EUR') return 1;

  const settings = getSheet_(SHEETS.SETTINGS);
  const values = settings.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const section = String(values[i][0] || '').trim();
    const key = String(values[i][1] || '').trim();
    const value = values[i][2];

    if (section === 'Currency' && key === currency) {
      return toNumber_(value, 1);
    }
  }

  return 1;
}

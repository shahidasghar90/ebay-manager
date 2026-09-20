function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateVatAmount(amountEur: number, vatRatePercent: number): number {
  return round2((amountEur * vatRatePercent) / 100);
}

export type VatLedgerRow = {
  direction: 'In' | 'Out';
  vat_amount_eur: number | null;
};

export type VatSummary = {
  vatCollectedEur: number;
  vatPaidEur: number;
  vatPayableEur: number;
};

export function summarizeVat(rows: VatLedgerRow[]): VatSummary {
  const vatCollectedEur = rows
    .filter((row) => row.direction === 'In')
    .reduce((sum, row) => sum + Number(row.vat_amount_eur || 0), 0);
  const vatPaidEur = rows
    .filter((row) => row.direction === 'Out')
    .reduce((sum, row) => sum + Number(row.vat_amount_eur || 0), 0);

  return {
    vatCollectedEur: round2(vatCollectedEur),
    vatPaidEur: round2(vatPaidEur),
    vatPayableEur: round2(vatCollectedEur - vatPaidEur)
  };
}

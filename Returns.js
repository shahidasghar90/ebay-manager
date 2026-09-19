/* =========================
   RETURNS
========================= */

function saveReturnCase(item) {
  validateRequired_(item, ['orderId', 'reason']);

  const sheet = getSheet_(SHEETS.RETURNS);
  const caseId = nextPrefixedId_(sheet, 'RET-', 0);

  const refund = toNumber_(item.refundEur);
  const netLoss = refund + toNumber_(item.additionalLossEur);

  sheet.appendRow([
    caseId,
    item.orderId || '',
    new Date(item.date || new Date()),
    item.reason || '',
    item.returnStatus || 'Open',
    refund,
    netLoss,
    item.notes || ''
  ]);

  return { success: true, caseId: caseId };
}

function getReturns() {
  return getSheetObjects_(SHEETS.RETURNS);
}

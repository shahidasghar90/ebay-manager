/* =========================
   RETURNS
========================= */

function saveReturnCase(item, password) {
  verifyAppPassword_(password);
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

  recordAutoAccountEntry_({
    type: 'Refund',
    category: 'Returns',
    amountEur: refund,
    direction: 'Out',
    notes: 'Auto: return ' + caseId + (item.orderId ? ' for order ' + item.orderId : '')
  });

  return { success: true, caseId: caseId };
}

function getReturns() {
  return getSheetObjects_(SHEETS.RETURNS);
}

/* =========================
   ACCOUNTS
========================= */

function saveAccountTx(tx) {
  validateRequired_(tx, ['type', 'category', 'amountEur', 'direction']);

  const sheet = getSheet_(SHEETS.ACCOUNTS);
  const txId = nextPrefixedId_(sheet, 'ACC-', 0);

  sheet.appendRow([
    txId,
    new Date(tx.date || new Date()),
    tx.type || '',
    tx.category || '',
    toNumber_(tx.amountEur),
    tx.direction || 'Out',
    tx.notes || ''
  ]);

  return { success: true, txId: txId };
}

function getAccounts() {
  return getSheetObjects_(SHEETS.ACCOUNTS);
}

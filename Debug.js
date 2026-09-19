/* =========================
   DEBUG / DIAGNOSTICS
   (run manually from the Apps Script editor when troubleshooting)
========================= */

function testReadInventory() {
  const data = getSheetObjects_(SHEETS.INVENTORY);

  Logger.log(JSON.stringify(data, null, 2));

  SpreadsheetApp.getUi().alert(
    'Inventory records found: ' + data.length
  );
}

function debugAppData() {
  const ss = getSpreadsheet_();

  const result = {
    spreadsheetName: ss.getName(),
    sheets: ss.getSheets().map(sheet => ({
      name: sheet.getName(),
      rows: sheet.getLastRow(),
      columns: sheet.getLastColumn()
    })),
    products: safeCount_(SHEETS.PRODUCTS),
    orders: safeCount_(SHEETS.ORDERS),
    inventory: safeCount_(SHEETS.INVENTORY),
    research: safeCount_(SHEETS.RESEARCH),
    accounts: safeCount_(SHEETS.ACCOUNTS),
    returns: safeCount_(SHEETS.RETURNS)
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function safeCount_(sheetName) {
  try {
    const sheet = getSheet_(sheetName);
    const values = sheet.getDataRange().getValues();

    return {
      sheet: sheetName,
      rows: Math.max(values.length - 1, 0),
      headers: values.length ? values[0] : [],
      sample: values.length > 1 ? values[1] : []
    };
  } catch (error) {
    return {
      sheet: sheetName,
      error: error.message
    };
  }
}

const SHEETS = {
  PRODUCTS: 'Products',
  ORDERS: 'Orders',
  INVENTORY: 'Inventory',
  RESEARCH: 'Product_Research',
  ACCOUNTS: 'Accounts',
  RETURNS: 'Returns_Cases',
  DASHBOARD: 'Dashboard',
  SETTINGS: 'Settings'
};

const IMAGE_FOLDER_NAME = 'eBay_Product_Images';
const SPREADSHEET_ID = '1SwmWtTn0KQlqYwv5maPzTggGliK3EFHqZCORkAT8rSU';

function getSpreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  return active || SpreadsheetApp.openById(SPREADSHEET_ID);
}

function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('eBay Business Manager')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* =========================
   INITIAL DATA
========================= */

function getAppData() {
  try {
    return {
      products: safeGetSheetObjects_(SHEETS.PRODUCTS),
      orders: safeGetSheetObjects_(SHEETS.ORDERS),
      inventory: safeGetSheetObjects_(SHEETS.INVENTORY),
      research: safeGetSheetObjects_(SHEETS.RESEARCH),
      accounts: safeGetSheetObjects_(SHEETS.ACCOUNTS),
      returns: safeGetSheetObjects_(SHEETS.RETURNS),
      dashboard: getDashboardData_(),
      settings: getSettingsData_()
    };
  } catch (error) {
    throw new Error('getAppData failed: ' + error.message);
  }
}

function safeGetSheetObjects_(name) {
  try {
    return getSheetObjects_(name);
  } catch (error) {
    return [];
  }
}

function getDashboardData_() {
  const products = safeGetSheetObjects_(SHEETS.PRODUCTS);
  const orders = safeGetSheetObjects_(SHEETS.ORDERS);
  const inventory = safeGetSheetObjects_(SHEETS.INVENTORY);
  const returns = safeGetSheetObjects_(SHEETS.RETURNS);

  const today = formatDate_(new Date());
  const currentMonth = today.substring(0, 7);

  const activeProducts = products.filter(p => p['Product Status'] === 'Active');
  const dropshipProducts = products.filter(p => p['Business Model'] === 'Dropship');
  const lowStock = inventory.filter(item => item['Reorder Alert'] === 'REORDER');

  const todayOrders = orders.filter(order =>
    formatDate_(order['Order Date']) === today
  );

  const monthOrders = orders.filter(order =>
    formatDate_(order['Order Date']).substring(0, 7) === currentMonth
  );

  const grossSales = monthOrders.reduce(
    (sum, order) => sum + toNumber_(order['Gross Sale EUR']),
    0
  );

  const netProfit = monthOrders.reduce(
    (sum, order) => sum + toNumber_(order['Net Profit EUR']),
    0
  );

  const openReturns = returns.filter(
    item => item['Return Status'] === 'Open'
  ).length;

  return {
    totalProducts: products.length,
    activeProducts: activeProducts.length,
    dropshipProducts: dropshipProducts.length,
    lowStock: lowStock.length,
    ordersToday: todayOrders.length,
    ordersThisMonth: monthOrders.length,
    grossSalesThisMonth: grossSales,
    netProfitThisMonth: netProfit,
    openReturns: openReturns
  };
}

/* =========================
   PRODUCTS
========================= */

function saveProduct(product) {
  validateRequired_(product, [
    'productName',
    'condition',
    'businessModel',
    'salesPlatform',
    'currency'
  ]);

  const sheet = getSheet_(SHEETS.PRODUCTS);
  const sku = product.sku || nextPrefixedId_(sheet, 'SKU-', 0);

  const rate = getFxRate_(product.currency);
  const purchaseLocal = toNumber_(product.purchasePriceLocal);
  const shippingLocal = toNumber_(product.shippingToYouLocal);
  const purchaseEur = purchaseLocal * rate;
  const shippingEur = shippingLocal * rate;

  const customs = toNumber_(product.customsDutyEur);
  const packaging = toNumber_(product.packagingEur);
  const refurb = toNumber_(product.refurbishmentEur);
  const dropshipShipping = toNumber_(product.dropshipCustomerShippingEur);
  const dropshipFee = toNumber_(product.dropshipHandlingFeeEur);

  const totalCost =
    purchaseEur +
    shippingEur +
    customs +
    packaging +
    refurb +
    dropshipShipping +
    dropshipFee;

  const ebayFee = toNumber_(product.ebayFeePercent, 0.129);
  const paymentFee = toNumber_(product.paymentFeePercent, 0.029);
  const fixedFee = toNumber_(product.fixedPaymentFeeEur, 0.35);
  const targetProfit = toNumber_(product.targetProfitPercent, 0.25);
  const salePrice = toNumber_(product.currentSalePriceEur);

  const recommendedPrice =
    totalCost > 0
      ? totalCost / (1 - ebayFee - paymentFee - targetProfit)
      : 0;

  const minPrice =
    totalCost > 0
      ? totalCost / (1 - ebayFee - paymentFee)
      : 0;

  const estimatedEbayFee = salePrice * ebayFee;
  const estimatedPaymentFee = salePrice * paymentFee + fixedFee;
  const estimatedProfit =
    salePrice - totalCost - estimatedEbayFee - estimatedPaymentFee;

  const estimatedMargin =
    salePrice > 0 ? estimatedProfit / salePrice : 0;

  const row = [
    sku,
    product.productName || '',
    product.category || '',
    product.condition || 'New',
    product.businessModel || 'Stock',
    product.productStatus || 'Research',
    product.salesPlatform || 'eBay_DE',
    product.supplierName || '',
    product.supplierPlatform || '',
    product.supplierLink || '',
    product.mainEbayListingUrl || '',
    product.imageUrl || '',
    product.imageFileId || '',
    product.supportLink1 || '',
    product.supportLink2 || '',
    product.supportLink3 || '',
    product.currency || 'EUR',
    rate,
    purchaseLocal,
    purchaseEur,
    shippingLocal,
    shippingEur,
    customs,
    packaging,
    refurb,
    dropshipShipping,
    dropshipFee,
    totalCost,
    ebayFee,
    paymentFee,
    fixedFee,
    targetProfit,
    recommendedPrice,
    minPrice,
    salePrice,
    estimatedEbayFee,
    estimatedPaymentFee,
    estimatedProfit,
    estimatedMargin,
    product.supplierMoq || '',
    product.leadTimeDays || '',
    product.dropshipSupported || 'No',
    product.acquisitionSource || '',
    product.acquisitionDate || '',
    product.notes || ''
  ];

  sheet.appendRow(row);

  return {
    success: true,
    message: 'Product saved successfully.',
    sku: sku,
    totalCost: totalCost,
    recommendedPrice: recommendedPrice,
    estimatedProfit: estimatedProfit
  };
}

function getProducts() {
  return getSheetObjects_(SHEETS.PRODUCTS);
}

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

/* =========================
   ORDERS
========================= */

function saveOrder(order) {
  validateRequired_(order, [
    'orderDate',
    'salesPlatform',
    'sku',
    'quantity',
    'saleCurrency',
    'itemPriceLocal'
  ]);

  const sheet = getSheet_(SHEETS.ORDERS);
  const orderId = order.orderId || nextPrefixedId_(sheet, 'EB-', 10000);
  const fxRate = getFxRate_(order.saleCurrency);

  const itemPrice = toNumber_(order.itemPriceLocal);
  const shippingCharged = toNumber_(order.shippingChargedLocal);
  const grossSale = (itemPrice + shippingCharged) * fxRate;

  const ebayFeePercent = toNumber_(order.ebayFeePercent, 0.129);
  const paymentFeePercent = toNumber_(order.paymentFeePercent, 0.029);
  const fixedFee = toNumber_(order.fixedPaymentFeeEur, 0.35);

  const ebayFee = grossSale * ebayFeePercent;
  const paymentFee = grossSale * paymentFeePercent + fixedFee;

  const productCost = toNumber_(order.productCostEur);
  const shippingCost = toNumber_(order.shippingPackagingCostEur);
  const totalCost = productCost + shippingCost;
  const netProfit = grossSale - ebayFee - paymentFee - totalCost;
  const margin = grossSale > 0 ? netProfit / grossSale : 0;

  sheet.appendRow([
    orderId,
    new Date(order.orderDate),
    order.salesPlatform || 'eBay_DE',
    order.buyerUsername || '',
    order.sku || '',
    order.productName || '',
    order.condition || 'New',
    toNumber_(order.quantity, 1),
    order.saleCurrency || 'EUR',
    fxRate,
    itemPrice,
    shippingCharged,
    grossSale,
    order.fulfillmentType || 'Self',
    order.supplierName || '',
    order.supplierOrderId || '',
    order.supplierOrderDate || '',
    order.supplierTrackingNumber || '',
    order.supplierShipDate || '',
    order.orderStatus || 'New',
    ebayFeePercent,
    ebayFee,
    paymentFeePercent,
    fixedFee,
    paymentFee,
    productCost,
    shippingCost,
    totalCost,
    netProfit,
    margin,
    order.carrier || '',
    order.buyerTrackingNumber || '',
    order.deliveredDate || '',
    order.notes || ''
  ]);

  return {
    success: true,
    orderId: orderId,
    grossSale: grossSale,
    netProfit: netProfit
  };
}

function getOrders() {
  return getSheetObjects_(SHEETS.ORDERS);
}

/* =========================
   INVENTORY
========================= */

function saveInventoryItem(item) {
  validateRequired_(item, ['sku', 'productName', 'inventoryType']);

  const sheet = getSheet_(SHEETS.INVENTORY);

  const quantityOnHand = toNumber_(item.quantityOnHand);
  const quantityReserved = toNumber_(item.quantityReserved);
  const available =
    item.inventoryType === 'Dropship'
      ? 'N/A'
      : quantityOnHand - quantityReserved;

  const reorderLevel = toNumber_(item.reorderLevel);
  const reorderAlert =
    item.inventoryType === 'Dropship'
      ? 'Supplier stock check'
      : available <= reorderLevel
      ? 'REORDER'
      : 'OK';

  sheet.appendRow([
    item.sku,
    item.productName,
    item.variant || '',
    item.inventoryType,
    item.locationBin || '',
    quantityOnHand,
    quantityReserved,
    available,
    reorderLevel,
    reorderAlert,
    item.supplierName || '',
    item.supplierLink || '',
    item.leadTimeDays || '',
    item.lastRestockDate || '',
    '',
    item.notes || ''
  ]);

  return { success: true, message: 'Inventory item saved.' };
}

/* =========================
   RESEARCH
========================= */

function saveResearch(research) {
  validateRequired_(research, ['keyword', 'potentialModel', 'currency']);

  const sheet = getSheet_(SHEETS.RESEARCH);
  const id = nextNumericId_(sheet);

  sheet.appendRow([
    id,
    new Date(),
    research.keyword || '',
    research.productTitle || '',
    research.category || '',
    research.condition || 'New',
    research.potentialModel || 'Stock',
    research.researchStatus || 'Idea',
    research.platform || '',
    research.supplierPlatform || '',
    research.mainListingUrl || '',
    research.imageUrl || '',
    research.imageUrl ? `=IMAGE(L${sheet.getLastRow() + 1})` : '',
    research.supportLink1 || '',
    research.supportLink2 || '',
    research.supportLink3 || '',
    research.currency || 'EUR',
    getFxRate_(research.currency),
    toNumber_(research.productPriceLocal),
    toNumber_(research.productPriceLocal) * getFxRate_(research.currency),
    toNumber_(research.shippingLocal),
    toNumber_(research.shippingLocal) * getFxRate_(research.currency),
    toNumber_(research.customsEur),
    toNumber_(research.packagingEur),
    toNumber_(research.refurbishmentEur),
    toNumber_(research.dropshipCustomerShippingEur),
    '',
    toNumber_(research.proposedSalePriceEur),
    0.129,
    0.029,
    0.35,
    '',
    '',
    research.moq || '',
    research.leadTimeDays || '',
    research.dropshipAvailable || 'No',
    research.sellerSupplier || '',
    research.notes || '',
    ''
  ]);

  return { success: true, researchId: id };
}

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

/* =========================
   IMAGE UPLOAD
========================= */

function uploadImageToDrive(base64Data, filename, sku) {
  if (!base64Data) {
    throw new Error('No image data provided.');
  }

  const commaIndex = base64Data.indexOf(',');
  const meta = commaIndex > -1 ? base64Data.substring(0, commaIndex) : '';
  const data = commaIndex > -1 ? base64Data.substring(commaIndex + 1) : base64Data;
  const mimeMatch = meta.match(/data:(.*);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  const bytes = Utilities.base64Decode(data);
  const blob = Utilities.newBlob(
    bytes,
    mimeType,
    (sku || 'product') + '_' + (filename || 'image.jpg')
  );

  const folder = getImageFolder_();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();

  return {
    success: true,
    fileId: fileId,
    url: 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000'
  };
}

function getImageFolder_() {
  const folders = DriveApp.getFoldersByName(IMAGE_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(IMAGE_FOLDER_NAME);
}

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

/* =========================
   HELPERS
========================= */

function getSheet_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);

  if (!sheet) {
    throw new Error(`Sheet not found: ${name}`);
  }

  return sheet;
}

function getSheetObjects_(name) {
  const sheet = getSheet_(name);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return [];

  const headers = values[0].map(header => String(header).trim());

  return values
    .slice(1)
    .filter(row => row.some(cell => cell !== ''))
    .map(row => {
      const result = {};

      headers.forEach((header, index) => {
        result[header] = sanitizeCellValue_(row[index]);
      });

      return result;
    });
}

function sanitizeCellValue_(value) {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? '' : value.toISOString();
  }

  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return String(value);
  }

  return value;
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

function nextPrefixedId_(sheet, prefix, startNumber) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return prefix + (startNumber + 1);
  }

  const ids = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .flat();

  let largest = startNumber;

  ids.forEach(id => {
    const text = String(id || '');

    if (text.startsWith(prefix)) {
      const number = parseInt(text.replace(prefix, ''), 10);

      if (!isNaN(number) && number > largest) {
        largest = number;
      }
    }
  });

  return prefix + (largest + 1);
}

function nextNumericId_(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return 1;

  const values = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .flat();

  let largest = 0;

  values.forEach(value => {
    const number = parseInt(value, 10);

    if (!isNaN(number) && number > largest) {
      largest = number;
    }
  });

  return largest + 1;
}

function toNumber_(value, defaultValue) {
  const number = Number(value);

  if (isNaN(number)) {
    return defaultValue !== undefined ? defaultValue : 0;
  }

  return number;
}

function formatDate_(value) {
  if (!value) return '';

  const date = new Date(value);

  if (isNaN(date.getTime())) return '';

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );
}

function validateRequired_(data, fields) {
  const missing = fields.filter(field => {
    return data[field] === undefined ||
      data[field] === null ||
      data[field] === '';
  });

  if (missing.length) {
    throw new Error(
      'Required fields missing: ' + missing.join(', ')
    );
  }
}

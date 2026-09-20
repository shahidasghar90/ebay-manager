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

function getAppData(password) {
  verifyAppPassword_(password);

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

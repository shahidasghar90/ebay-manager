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
  const built = buildOrderRow_(order, orderId);

  sheet.appendRow(built.row);

  recordAutoAccountEntry_({
    type: 'Sale',
    category: 'eBay Sales',
    amountEur: built.grossSale,
    direction: 'In',
    notes: 'Auto: order ' + orderId + (order.sku ? ' (' + order.sku + ')' : '')
  });

  return {
    success: true,
    orderId: orderId,
    grossSale: built.grossSale,
    netProfit: built.netProfit
  };
}

function updateOrder(order) {
  validateRequired_(order, [
    'orderId',
    'orderDate',
    'salesPlatform',
    'sku',
    'quantity',
    'saleCurrency',
    'itemPriceLocal'
  ]);

  const sheet = getSheet_(SHEETS.ORDERS);
  const rowIndex = findRowIndexByColumnValue_(sheet, 1, order.orderId);

  if (!rowIndex) {
    throw new Error('Order not found: ' + order.orderId);
  }

  const built = buildOrderRow_(order, order.orderId);

  sheet.getRange(rowIndex, 1, 1, built.row.length).setValues([built.row]);

  return {
    success: true,
    orderId: order.orderId,
    grossSale: built.grossSale,
    netProfit: built.netProfit
  };
}

function buildOrderRow_(order, orderId) {
  const fxRate = getFxRate_(order.saleCurrency);

  const itemPrice = toNumber_(order.itemPriceLocal);
  const shippingCharged = toNumber_(order.shippingChargedLocal);
  const grossSale = round2_((itemPrice + shippingCharged) * fxRate);

  const ebayFeePercent = toNumber_(order.ebayFeePercent, 0.129);
  const paymentFeePercent = toNumber_(order.paymentFeePercent, 0.029);
  const fixedFee = toNumber_(order.fixedPaymentFeeEur, 0.35);

  const ebayFee = round2_(grossSale * ebayFeePercent);
  const paymentFee = round2_(grossSale * paymentFeePercent + fixedFee);

  const productCost = toNumber_(order.productCostEur);
  const shippingCost = toNumber_(order.shippingPackagingCostEur);
  const totalCost = round2_(productCost + shippingCost);
  const netProfit = round2_(grossSale - ebayFee - paymentFee - totalCost);
  const margin = grossSale > 0 ? Math.round((netProfit / grossSale) * 10000) / 10000 : 0;

  const row = [
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
  ];

  return {
    row: row,
    grossSale: grossSale,
    netProfit: netProfit
  };
}

function getOrders() {
  return getSheetObjects_(SHEETS.ORDERS);
}

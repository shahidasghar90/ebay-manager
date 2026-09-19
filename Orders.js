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

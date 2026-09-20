/* =========================
   PRODUCTS
========================= */

function saveProduct(product, password) {
  verifyAppPassword_(password);
  validateRequired_(product, [
    'productName',
    'condition',
    'businessModel',
    'salesPlatform',
    'currency'
  ]);

  const sheet = getSheet_(SHEETS.PRODUCTS);
  const sku = product.sku || nextPrefixedId_(sheet, 'SKU-', 0);
  const built = buildProductRow_(product, sku);

  sheet.appendRow(built.row);
  recordAutoAccountEntry_({
    type: 'Purchase',
    category: 'Inventory',
    amountEur: built.totalCost,
    direction: 'Out',
    notes: 'Auto: purchase cost for ' + sku + (product.productName ? ' (' + product.productName + ')' : '')
  });

  return {
    success: true,
    message: 'Product saved successfully.',
    sku: sku,
    totalCost: built.totalCost,
    recommendedPrice: built.recommendedPrice,
    estimatedProfit: built.estimatedProfit,
    record: rowToRecord_(SHEETS.PRODUCTS, built.row)
  };
}

function updateProduct(product, password) {
  verifyAppPassword_(password);
  validateRequired_(product, [
    'sku',
    'productName',
    'condition',
    'businessModel',
    'salesPlatform',
    'currency'
  ]);

  const sheet = getSheet_(SHEETS.PRODUCTS);
  const rowIndex = findRowIndexByColumnValue_(sheet, 1, product.sku);

  if (!rowIndex) {
    throw new Error('Product not found: ' + product.sku);
  }

  const built = buildProductRow_(product, product.sku);

  sheet.getRange(rowIndex, 1, 1, built.row.length).setValues([built.row]);

  return {
    success: true,
    message: 'Product updated successfully.',
    sku: product.sku,
    totalCost: built.totalCost,
    recommendedPrice: built.recommendedPrice,
    estimatedProfit: built.estimatedProfit,
    record: rowToRecord_(SHEETS.PRODUCTS, built.row)
  };
}

function buildProductRow_(product, sku) {
  const rate = getFxRate_(product.currency);
  const purchaseLocal = toNumber_(product.purchasePriceLocal);
  const shippingLocal = toNumber_(product.shippingToYouLocal);
  const purchaseEur = round2_(purchaseLocal * rate);
  const shippingEur = round2_(shippingLocal * rate);

  const customs = toNumber_(product.customsDutyEur);
  const packaging = toNumber_(product.packagingEur);
  const refurb = toNumber_(product.refurbishmentEur);
  const dropshipShipping = toNumber_(product.dropshipCustomerShippingEur);
  const dropshipFee = toNumber_(product.dropshipHandlingFeeEur);

  const totalCost = round2_(
    purchaseEur +
    shippingEur +
    customs +
    packaging +
    refurb +
    dropshipShipping +
    dropshipFee
  );

  const ebayFee = toNumber_(product.ebayFeePercent, 0.129);
  const paymentFee = toNumber_(product.paymentFeePercent, 0.029);
  const fixedFee = toNumber_(product.fixedPaymentFeeEur, 0.35);
  const targetProfit = toNumber_(product.targetProfitPercent, 0.25);
  const salePrice = toNumber_(product.currentSalePriceEur);

  const recommendedPrice = round2_(
    totalCost > 0
      ? totalCost / (1 - ebayFee - paymentFee - targetProfit)
      : 0
  );

  const minPrice = round2_(
    totalCost > 0
      ? totalCost / (1 - ebayFee - paymentFee)
      : 0
  );

  const estimatedEbayFee = round2_(salePrice > 0 ? salePrice * ebayFee : 0);
  const estimatedPaymentFee = round2_(salePrice > 0 ? salePrice * paymentFee + fixedFee : 0);
  const estimatedProfit = round2_(
    salePrice > 0
      ? salePrice - totalCost - estimatedEbayFee - estimatedPaymentFee
      : 0
  );

  const estimatedMargin =
    salePrice > 0 ? Math.round((estimatedProfit / salePrice) * 10000) / 10000 : 0;

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
    normalizeUrl_(product.supplierLink),
    normalizeUrl_(product.mainEbayListingUrl),
    product.imageUrl || '',
    product.imageFileId || '',
    normalizeUrl_(product.supportLink1),
    normalizeUrl_(product.supportLink2),
    normalizeUrl_(product.supportLink3),
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

  return {
    row: row,
    totalCost: totalCost,
    recommendedPrice: recommendedPrice,
    estimatedProfit: estimatedProfit
  };
}

function getProducts() {
  return getSheetObjects_(SHEETS.PRODUCTS);
}

function archiveProduct(sku, password) {
  verifyAppPassword_(password);
  validateRequired_({ sku: sku }, ['sku']);

  const sheet = getSheet_(SHEETS.PRODUCTS);
  const rowIndex = findRowIndexByColumnValue_(sheet, 1, sku);

  if (!rowIndex) {
    throw new Error('Product not found: ' + sku);
  }

  sheet.getRange(rowIndex, 6).setValue('Archived');

  return { success: true, sku: sku };
}

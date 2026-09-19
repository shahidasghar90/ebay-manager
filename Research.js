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
    normalizeUrl_(research.mainListingUrl),
    normalizeUrl_(research.imageUrl),
    research.imageUrl ? `=IMAGE(L${sheet.getLastRow() + 1})` : '',
    normalizeUrl_(research.supportLink1),
    normalizeUrl_(research.supportLink2),
    normalizeUrl_(research.supportLink3),
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

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
    normalizeUrl_(item.supplierLink),
    item.leadTimeDays || '',
    item.lastRestockDate || '',
    '',
    item.notes || ''
  ]);

  return { success: true, message: 'Inventory item saved.' };
}

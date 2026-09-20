export type OrderCsvRow = {
  order_date: string;
  sales_platform: string;
  buyer_username: string;
  sku: string;
  quantity: number;
  sale_currency: string;
  item_price_local: number;
  shipping_charged_local: number;
  fulfillment_type: string;
  order_status: string;
  notes: string;
};

export type OrderCsvInvalidRow = {
  line: number;
  reason: string;
  raw: Record<string, string>;
};

export type OrderCsvParseResult = {
  valid: OrderCsvRow[];
  invalid: OrderCsvInvalidRow[];
};

function parseCsvLine(line: string): string[] {
  return line.split(',').map((cell) => cell.trim());
}

export function parseOrderCsv(csvText: string, knownSkus: Set<string>): OrderCsvParseResult {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const valid: OrderCsvRow[] = [];
  const invalid: OrderCsvInvalidRow[] = [];

  if (lines.length === 0) return { valid, invalid };

  const headers = parseCsvLine(lines[0]);

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const raw: Record<string, string> = {};
    headers.forEach((header, index) => {
      raw[header] = cells[index] ?? '';
    });

    const lineNumber = i + 1;
    const sku = raw.sku || '';
    const quantity = Number(raw.quantity);
    const itemPriceLocal = Number(raw.item_price_local);
    const orderDate = raw.order_date || '';

    if (!sku) {
      invalid.push({ line: lineNumber, reason: 'Missing SKU', raw });
      continue;
    }
    if (!knownSkus.has(sku)) {
      invalid.push({ line: lineNumber, reason: `SKU not found: ${sku}`, raw });
      continue;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      invalid.push({ line: lineNumber, reason: 'Quantity must be a number greater than 0', raw });
      continue;
    }
    if (!Number.isFinite(itemPriceLocal) || itemPriceLocal <= 0) {
      invalid.push({ line: lineNumber, reason: 'Item price must be a number greater than 0', raw });
      continue;
    }
    if (!orderDate || Number.isNaN(new Date(orderDate).getTime())) {
      invalid.push({ line: lineNumber, reason: 'Invalid order date', raw });
      continue;
    }

    valid.push({
      order_date: orderDate,
      sales_platform: raw.sales_platform || 'eBay_DE',
      buyer_username: raw.buyer_username || '',
      sku,
      quantity,
      sale_currency: raw.sale_currency || 'EUR',
      item_price_local: itemPriceLocal,
      shipping_charged_local: Number(raw.shipping_charged_local) || 0,
      fulfillment_type: raw.fulfillment_type || 'Self',
      order_status: raw.order_status || 'New',
      notes: raw.notes || ''
    });
  }

  return { valid, invalid };
}

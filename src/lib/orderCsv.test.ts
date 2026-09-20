import { describe, expect, it } from 'vitest';
import { parseOrderCsv } from './orderCsv';

const knownSkus = new Set(['SKU-ABC123']);

describe('parseOrderCsv', () => {
  it('parses valid rows with defaults applied for missing optional fields', () => {
    const csv = [
      'order_date,sales_platform,buyer_username,sku,quantity,sale_currency,item_price_local,shipping_charged_local,fulfillment_type,order_status,notes',
      '2026-01-05,eBay_DE,buyer1,SKU-ABC123,2,EUR,25,5,,,'
    ].join('\n');

    const result = parseOrderCsv(csv, knownSkus);

    expect(result.invalid).toHaveLength(0);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]).toMatchObject({
      sku: 'SKU-ABC123',
      quantity: 2,
      item_price_local: 25,
      shipping_charged_local: 5,
      sales_platform: 'eBay_DE',
      fulfillment_type: 'Self',
      order_status: 'New'
    });
  });

  it('rejects a row whose SKU is not known', () => {
    const csv = [
      'order_date,sales_platform,buyer_username,sku,quantity,sale_currency,item_price_local,shipping_charged_local,fulfillment_type,order_status,notes',
      '2026-01-05,eBay_DE,buyer1,SKU-UNKNOWN,1,EUR,10,0,Self,New,'
    ].join('\n');

    const result = parseOrderCsv(csv, knownSkus);

    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].reason).toContain('SKU not found');
  });

  it('rejects a row with a non-positive quantity', () => {
    const csv = [
      'order_date,sales_platform,buyer_username,sku,quantity,sale_currency,item_price_local,shipping_charged_local,fulfillment_type,order_status,notes',
      '2026-01-05,eBay_DE,buyer1,SKU-ABC123,0,EUR,10,0,Self,New,'
    ].join('\n');

    const result = parseOrderCsv(csv, knownSkus);

    expect(result.valid).toHaveLength(0);
    expect(result.invalid[0].reason).toContain('Quantity');
  });

  it('handles a mix of valid and invalid rows in one file', () => {
    const csv = [
      'order_date,sales_platform,buyer_username,sku,quantity,sale_currency,item_price_local,shipping_charged_local,fulfillment_type,order_status,notes',
      '2026-01-05,eBay_DE,buyer1,SKU-ABC123,1,EUR,10,0,Self,New,',
      '2026-01-06,eBay_DE,buyer2,SKU-UNKNOWN,1,EUR,10,0,Self,New,'
    ].join('\n');

    const result = parseOrderCsv(csv, knownSkus);

    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].line).toBe(3);
  });
});

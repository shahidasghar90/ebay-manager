import { describe, expect, it } from 'vitest';
import { calculateOrderPricing, expectedPayout } from './orderPricing';

describe('calculateOrderPricing', () => {
  it('computes gross sale, fees, and net profit for a simple EUR order', () => {
    const result = calculateOrderPricing({
      fxRate: 1,
      itemPriceLocal: 30,
      shippingChargedLocal: 5,
      ebayFeePercent: 0.129,
      paymentFeePercent: 0.029,
      fixedPaymentFeeEur: 0.35,
      productCostEur: 15,
      shippingPackagingCostEur: 2
    });

    expect(result.grossSaleEur).toBe(35);
    expect(result.ebayFeeEur).toBe(4.52);
    expect(result.paymentFeeEur).toBe(1.37);
    expect(result.totalOrderCostEur).toBe(17);
    expect(result.netProfitEur).toBe(12.11);
    expect(result.netMargin).toBeCloseTo(0.3460, 4);
  });

  it('converts a non-EUR sale using the fx rate before computing fees', () => {
    const result = calculateOrderPricing({
      fxRate: 1.08,
      itemPriceLocal: 20,
      shippingChargedLocal: 0,
      ebayFeePercent: 0.129,
      paymentFeePercent: 0.029,
      fixedPaymentFeeEur: 0.35,
      productCostEur: 10,
      shippingPackagingCostEur: 0
    });

    expect(result.grossSaleEur).toBe(21.6);
  });

  it('returns zero margin when gross sale is zero', () => {
    const result = calculateOrderPricing({
      fxRate: 1,
      itemPriceLocal: 0,
      shippingChargedLocal: 0,
      ebayFeePercent: 0.129,
      paymentFeePercent: 0.029,
      fixedPaymentFeeEur: 0.35,
      productCostEur: 0,
      shippingPackagingCostEur: 0
    });

    expect(result.netMargin).toBe(0);
  });
});

describe('expectedPayout', () => {
  it('subtracts selling and payment fees from the gross sale', () => {
    expect(expectedPayout({ gross_sale_eur: 100, ebay_fee_eur: 12.9, payment_fee_eur: 3.25 })).toBe(83.85);
  });

  it('also subtracts the VAT eBay charges on its fees', () => {
    expect(expectedPayout({ gross_sale_eur: 100, ebay_fee_eur: 12.9, payment_fee_eur: 3.25 }, 3.07)).toBe(80.78);
  });
});

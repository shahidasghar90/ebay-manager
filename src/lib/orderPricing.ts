// Mirrors the legacy Apps Script Orders.js buildOrderRow_ formula.

export type OrderPricingInput = {
  fxRate: number;
  itemPriceLocal: number;
  shippingChargedLocal: number;
  ebayFeePercent: number;
  paymentFeePercent: number;
  fixedPaymentFeeEur: number;
  productCostEur: number;
  shippingPackagingCostEur: number;
};

export type OrderPricingResult = {
  grossSaleEur: number;
  ebayFeeEur: number;
  paymentFeeEur: number;
  totalOrderCostEur: number;
  netProfitEur: number;
  netMargin: number;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateOrderPricing(input: OrderPricingInput): OrderPricingResult {
  const grossSaleEur = round2((input.itemPriceLocal + input.shippingChargedLocal) * input.fxRate);
  const ebayFeeEur = round2(grossSaleEur * input.ebayFeePercent);
  const paymentFeeEur = round2(grossSaleEur * input.paymentFeePercent + input.fixedPaymentFeeEur);
  const totalOrderCostEur = round2(input.productCostEur + input.shippingPackagingCostEur);
  const netProfitEur = round2(grossSaleEur - ebayFeeEur - paymentFeeEur - totalOrderCostEur);
  const netMargin = grossSaleEur > 0 ? Math.round((netProfitEur / grossSaleEur) * 10000) / 10000 : 0;

  return { grossSaleEur, ebayFeeEur, paymentFeeEur, totalOrderCostEur, netProfitEur, netMargin };
}

/**
 * What eBay should pay out: gross sale minus selling and payment fees, minus the
 * VAT eBay charges on those fees when known (mirrors close_order).
 */
export function expectedPayout(
  order: { gross_sale_eur: number; ebay_fee_eur: number; payment_fee_eur: number },
  feeVatEur = 0
): number {
  return round2(
    Number(order.gross_sale_eur || 0) -
      Number(order.ebay_fee_eur || 0) -
      Number(order.payment_fee_eur || 0) -
      feeVatEur
  );
}

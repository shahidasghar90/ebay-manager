// Ported from the old Apps Script Products.js buildProductRow_ formula.

export type PricingInput = {
  currency: 'EUR' | 'USD' | 'PKR' | 'CNY';
  fxRates: { EUR: number; USD: number; PKR: number; CNY: number };
  purchasePriceLocal: number;
  shippingLocal: number;
  customsEur: number;
  packagingEur: number;
  refurbishmentEur: number;
  dropshipCustomerShippingEur: number;
  dropshipHandlingFeeEur: number;
  fulfillmentFeeEur: number;
  storageFeeEurPerMonth: number;
  ebayFeePercent: number;
  paymentFeePercent: number;
  fixedPaymentFeeEur: number;
  targetProfitPercent: number;
  currentSalePriceEur: number;
};

export type PricingResult = {
  fxRate: number;
  purchasePriceEur: number;
  shippingEur: number;
  totalCostEur: number;
  minimumSalePriceEur: number;
  recommendedSalePriceEur: number;
  estimatedEbayFeeEur: number;
  estimatedPaymentFeeEur: number;
  estimatedNetProfitEur: number;
  estimatedProfitMargin: number;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePricing(input: PricingInput): PricingResult {
  const fxRate = input.fxRates[input.currency] || 1;
  const purchasePriceEur = round2(input.purchasePriceLocal * fxRate);
  const shippingEur = round2(input.shippingLocal * fxRate);

  const totalCostEur = round2(
    purchasePriceEur +
      shippingEur +
      input.customsEur +
      input.packagingEur +
      input.refurbishmentEur +
      input.dropshipCustomerShippingEur +
      input.dropshipHandlingFeeEur +
      input.fulfillmentFeeEur +
      input.storageFeeEurPerMonth
  );

  const { ebayFeePercent, paymentFeePercent, fixedPaymentFeeEur, targetProfitPercent } = input;

  const minimumSalePriceEur = round2(
    totalCostEur > 0 ? totalCostEur / (1 - ebayFeePercent - paymentFeePercent) : 0
  );

  const recommendedSalePriceEur = round2(
    totalCostEur > 0
      ? totalCostEur / (1 - ebayFeePercent - paymentFeePercent - targetProfitPercent)
      : 0
  );

  const salePrice = input.currentSalePriceEur;
  const estimatedEbayFeeEur = round2(salePrice > 0 ? salePrice * ebayFeePercent : 0);
  const estimatedPaymentFeeEur = round2(
    salePrice > 0 ? salePrice * paymentFeePercent + fixedPaymentFeeEur : 0
  );
  const estimatedNetProfitEur = round2(
    salePrice > 0 ? salePrice - totalCostEur - estimatedEbayFeeEur - estimatedPaymentFeeEur : 0
  );
  const estimatedProfitMargin =
    salePrice > 0 ? Math.round((estimatedNetProfitEur / salePrice) * 10000) / 10000 : 0;

  return {
    fxRate,
    purchasePriceEur,
    shippingEur,
    totalCostEur,
    minimumSalePriceEur,
    recommendedSalePriceEur,
    estimatedEbayFeeEur,
    estimatedPaymentFeeEur,
    estimatedNetProfitEur,
    estimatedProfitMargin
  };
}

/** Stamped by the stamp_record_author trigger (see supabase/migrations). */
export type RecordAuthor = {
  created_by?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
};

export type Product = RecordAuthor & {
  sku: string;
  product_name: string;
  category: string | null;
  condition: 'New' | 'Used' | 'Refurbished';
  business_model: string;
  product_status: 'Research' | 'Active' | 'Paused' | 'Out of Stock' | 'Archived';
  sales_platform: string;
  supplier_name: string | null;
  supplier_platform: string | null;
  supplier_link: string | null;
  main_ebay_listing_url: string | null;
  image_urls: string[];
  image_file_ids: string[];
  support_link_1: string | null;
  support_link_2: string | null;
  support_link_3: string | null;
  source_currency: string;
  fx_rate: number;
  purchase_price_local: number;
  purchase_price_eur: number;
  shipping_local: number;
  shipping_eur: number;
  customs_eur: number;
  packaging_eur: number;
  refurbishment_eur: number;
  dropship_customer_shipping_eur: number;
  dropship_handling_fee_eur: number;
  fulfillment_fee_eur: number;
  storage_fee_eur_per_month: number;
  total_cost_eur: number;
  ebay_fee_percent: number;
  payment_fee_percent: number;
  fixed_payment_fee_eur: number;
  target_profit_percent: number;
  recommended_sale_price_eur: number;
  minimum_sale_price_eur: number;
  current_sale_price_eur: number;
  estimated_ebay_fee_eur: number;
  estimated_payment_fee_eur: number;
  estimated_net_profit_eur: number;
  estimated_profit_margin: number;
  supplier_moq: number | null;
  lead_time_days: number | null;
  dropship_supported: boolean;
  acquisition_source: string | null;
  acquisition_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Order = RecordAuthor & {
  order_id: string;
  order_date: string;
  sales_platform: string;
  buyer_username: string | null;
  sku: string | null;
  product_name: string | null;
  condition: string | null;
  quantity: number;
  sale_currency: string;
  fx_rate: number;
  item_price_local: number;
  shipping_charged_local: number;
  gross_sale_eur: number;
  fulfillment_type: string;
  order_status: string;
  ebay_fee_percent: number;
  ebay_fee_eur: number;
  payment_fee_percent: number;
  fixed_payment_fee_eur: number;
  payment_fee_eur: number;
  product_cost_eur: number;
  shipping_packaging_cost_eur: number;
  total_order_cost_eur: number;
  net_profit_eur: number;
  net_margin: number;
  carrier: string | null;
  buyer_tracking_number: string | null;
  delivered_date: string | null;
  actual_payout_eur: number | null;
  payout_date: string | null;
  adjustment_eur: number;
  fee_vat_eur: number;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
};

export type InventoryItem = RecordAuthor & {
  id: string;
  sku: string;
  product_name: string;
  variant: string | null;
  inventory_type: 'On Hand' | 'Dropship' | 'Virtual';
  location_bin: string | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  reorder_level: number;
  supplier_name: string | null;
  supplier_link: string | null;
  lead_time_days: number | null;
  last_restock_date: string | null;
  notes: string | null;
};

export type AccountTx = RecordAuthor & {
  tx_id: string;
  tx_date: string;
  type: string;
  category: string;
  amount_eur: number;
  direction: 'In' | 'Out';
  vat_rate_percent: number | null;
  vat_amount_eur: number | null;
  notes: string | null;
  ref_type: string | null;
  ref_id: string | null;
};

export type StockMovement = {
  id: string;
  sku: string;
  qty_change: number;
  reason: 'opening' | 'purchase' | 'sale' | 'cancel' | 'return' | 'adjust';
  ref_type: string | null;
  ref_id: string | null;
  unit_cost_eur: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type ReturnCase = RecordAuthor & {
  case_id: string;
  order_id: string | null;
  case_date: string;
  reason: string;
  status: 'Open' | 'Resolved' | 'Rejected';
  refund_eur: number;
  net_loss_eur: number;
  additional_loss_eur: number;
  fee_credit_eur: number;
  restock: boolean;
  settled_at: string | null;
  profit_impact_eur: number;
  notes: string | null;
};

export type ResearchItem = RecordAuthor & {
  id: number;
  keyword: string;
  product_title: string | null;
  category: string | null;
  condition: string | null;
  potential_model: 'Stock' | 'Dropship' | 'Used';
  research_status: string;
  platform: string | null;
  supplier_platform: string | null;
  main_listing_url: string | null;
  image_url: string | null;
  currency: 'EUR' | 'USD' | 'PKR' | 'CNY';
  product_price_local: number;
  shipping_local: number;
  moq: number | null;
  lead_time_days: number | null;
  dropship_available: boolean;
  seller_supplier: string | null;
  competitor_prices: { platform: string; price: number }[];
  notes: string | null;
  final_sku: string | null;
};

export type SalesPlatform = {
  code: string;
  label: string;
  selling_fee_percent: number;
  payment_fee_percent: number;
  fixed_payment_fee_eur: number;
};

export type FulfillmentModel = {
  code: string;
  label: string;
  fulfillment_fee_eur: number;
  storage_fee_eur_per_month: number;
};

export type Settings = {
  fxRates: { EUR: number; USD: number; PKR: number; CNY: number };
  ebayFeePercent: number;
  paymentFeePercent: number;
  fixedPaymentFeeEur: number;
  vatRegistered: boolean;
  vatRatePercent: number;
};

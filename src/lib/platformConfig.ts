import { SupabaseClient } from '@supabase/supabase-js';
import type { SalesPlatform, FulfillmentModel } from './types';

export async function fetchSalesPlatforms(supabase: SupabaseClient): Promise<SalesPlatform[]> {
  const { data } = await supabase
    .from('sales_platforms')
    .select('code, label, selling_fee_percent, payment_fee_percent, fixed_payment_fee_eur')
    .order('label');

  return (data as SalesPlatform[]) || [];
}

export async function fetchFulfillmentModels(supabase: SupabaseClient): Promise<FulfillmentModel[]> {
  const { data } = await supabase
    .from('fulfillment_models')
    .select('code, label, fulfillment_fee_eur, storage_fee_eur_per_month')
    .order('label');

  return (data as FulfillmentModel[]) || [];
}

import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { InventoryItem, Product } from '@/lib/types';
import OrderForm from '../OrderForm';

export default async function NewOrderPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: inventory }] = await Promise.all([
    supabase
      .from('products')
      .select('*')
      .neq('product_status', 'Archived')
      .order('product_name', { ascending: true }),
    supabase.from('inventory').select('*')
  ]);

  return (
    <div>
      <PageHeader title="Add Order" subtitle="Record a new eBay sale" />
      <OrderForm
        products={(products as Product[]) || []}
        inventory={(inventory as InventoryItem[]) || []}
      />
    </div>
  );
}

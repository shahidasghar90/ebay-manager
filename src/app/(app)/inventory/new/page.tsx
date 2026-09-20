import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';
import InventoryForm from '../InventoryForm';

export default async function NewInventoryItemPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('product_name', { ascending: true });

  return (
    <div>
      <PageHeader title="Add Inventory Item" subtitle="Track stock for a product" />
      <InventoryForm products={(products as Product[]) || []} />
    </div>
  );
}

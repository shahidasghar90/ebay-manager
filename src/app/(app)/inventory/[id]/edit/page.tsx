import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { InventoryItem, Product } from '@/lib/types';
import InventoryForm from '../../InventoryForm';
import { RecordAuthorLine } from '@/components/RecordAuthor';

export default async function EditInventoryItemPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: item }, { data: products }] = await Promise.all([
    supabase.from('inventory').select('*').eq('id', id).maybeSingle(),
    supabase.from('products').select('*').order('product_name', { ascending: true })
  ]);

  if (!item) notFound();

  return (
    <div>
      <PageHeader title={`Edit Inventory — ${item.sku}`} subtitle={item.product_name} />
      <RecordAuthorLine record={(item as InventoryItem)} />
      <InventoryForm item={item as InventoryItem} products={(products as Product[]) || []} />
    </div>
  );
}

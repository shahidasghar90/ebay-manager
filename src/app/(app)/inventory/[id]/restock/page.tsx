import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { InventoryItem } from '@/lib/types';
import RestockForm from '../../RestockForm';
import StockHistory from '../../StockHistory';

export default async function RestockPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from('inventory').select('*').eq('id', id).maybeSingle();

  if (!data) notFound();

  const item = data as InventoryItem;
  const { data: product } = await supabase
    .from('products')
    .select('total_cost_eur')
    .eq('sku', item.sku)
    .maybeSingle();

  return (
    <div>
      <PageHeader title={`Add Stock — ${item.sku}`} subtitle={item.product_name} />
      <div className="grid gap-6">
        <RestockForm item={item} defaultUnitCostEur={Number(product?.total_cost_eur || 0)} />
        <StockHistory sku={item.sku} />
      </div>
    </div>
  );
}

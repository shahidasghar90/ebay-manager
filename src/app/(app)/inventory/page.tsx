import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { InventoryItem } from '@/lib/types';
import InventoryTable from './InventoryTable';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from('inventory')
    .select('*')
    .order('product_name', { ascending: true });

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Stock levels, reorder alerts, and locations"
        actions={
          <Link href="/inventory/new" className="btn-primary">
            + Add Inventory Item
          </Link>
        }
      />

      <InventoryTable items={(items as InventoryItem[]) || []} />
    </div>
  );
}

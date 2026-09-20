import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';
import ProductsTable from './ProductsTable';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Search, compare and manage your product catalogue"
        actions={
          <Link href="/products/new" className="btn-primary">
            + Add Product
          </Link>
        }
      />

      <ProductsTable products={(products as Product[]) || []} />
    </div>
  );
}

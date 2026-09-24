import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import ProductForm from '../../ProductForm';
import { RecordAuthorLine } from '@/components/RecordAuthor';

export default async function EditProductPage({
  params
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('sku', sku)
    .maybeSingle();

  if (!product) notFound();

  return (
    <div>
      <PageHeader title={`Edit Product — ${product.sku}`} subtitle={product.product_name} />
      <RecordAuthorLine record={product} />
      <ProductForm product={product} />
    </div>
  );
}

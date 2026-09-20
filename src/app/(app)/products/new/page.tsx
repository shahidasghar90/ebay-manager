import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { ResearchItem } from '@/lib/types';
import ProductForm from '../ProductForm';

export default async function NewProductPage({
  searchParams
}: {
  searchParams: Promise<{ researchId?: string }>;
}) {
  const { researchId } = await searchParams;
  let research: ResearchItem | null = null;

  if (researchId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('product_research')
      .select('*')
      .eq('id', Number(researchId))
      .maybeSingle();
    research = data as ResearchItem | null;
  }

  return (
    <div>
      <PageHeader
        title="Add Product"
        subtitle="New, used, refurbished, stock or dropship product"
      />
      <ProductForm research={research || undefined} />
    </div>
  );
}

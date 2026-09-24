import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { ResearchItem } from '@/lib/types';
import ResearchForm from '../ResearchForm';
import { RecordAuthorLine } from '@/components/RecordAuthor';

export const dynamic = 'force-dynamic';

export default async function EditResearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('product_research').select('*').eq('id', id).single();

  if (!data) {
    notFound();
  }

  return (
    <div>
      <PageHeader title="Edit Research" subtitle="Update this sourcing idea" />
      <RecordAuthorLine record={(data as ResearchItem)} />
      <ResearchForm research={data as ResearchItem} />
    </div>
  );
}

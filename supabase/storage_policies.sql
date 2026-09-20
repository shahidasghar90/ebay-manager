-- Storage RLS policies for the "product-images" bucket.
-- Run once in the Supabase SQL editor (after creating the bucket).
-- The bucket being "public" only controls anonymous READ access to
-- files by URL; INSERT/UPDATE/DELETE still need explicit policies.

create policy "Authenticated users can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

create policy "Authenticated users can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

create policy "Authenticated users can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');

create policy "Anyone can view product images"
  on storage.objects for select
  to public
  using (bucket_id = 'product-images');

-- storage.buckets has its own RLS - without this, the public object
-- URL resolves to "Bucket not found" because anon/public can't even
-- see the bucket's metadata row.
create policy "Anyone can view the product-images bucket"
  on storage.buckets for select
  to public
  using (id = 'product-images');

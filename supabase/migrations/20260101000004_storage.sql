-- AETHRIZ AI | Migration 4: private storage buckets
-- No storage.objects policies are created: clients cannot read/write directly. The backend
-- (service_role) validates, compresses, strips metadata, uploads, and issues short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
 ('food-scan-images',    'food-scan-images',    false, 5242880,  array['image/jpeg','image/png','image/webp']),
 ('product-scan-images', 'product-scan-images', false, 5242880,  array['image/jpeg','image/png','image/webp']),
 ('health-reports',      'health-reports',      false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Supabase SQL: media bucket storage policies
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- NOTE: Bucket creation is typically handled by Supabase Storage directly.
-- This file defines access policies for the media bucket.

DROP POLICY IF EXISTS "Allow public reads for media_files" ON storage.objects;
CREATE POLICY "Allow public reads for media_files" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'media_files'
  );

DROP POLICY IF EXISTS "Allow uploads to media_files" ON storage.objects;
CREATE POLICY "Allow uploads to media_files" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'media_files'
  );

DROP POLICY IF EXISTS "Allow updates to media_files" ON storage.objects;
CREATE POLICY "Allow updates to media_files" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'media_files'
  )
  WITH CHECK (
    bucket_id = 'media_files'
  );

DROP POLICY IF EXISTS "Allow deletes from media_files" ON storage.objects;
CREATE POLICY "Allow deletes from media_files" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'media_files'
    AND (auth.role() = 'authenticated' OR auth.role() = 'anon')
  );

-- Case Photos Storage Bucket
-- Creates a public case-photos bucket for lab image uploads (file or camera)
-- Files stored as lab_id/filename, ownership enforced via path prefix

INSERT INTO storage.buckets (id, name, public)
VALUES ('case-photos', 'case-photos', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'case_photos_select'
  ) THEN
    EXECUTE $p$
      CREATE POLICY case_photos_select ON storage.objects
        FOR SELECT TO public
        USING (bucket_id = 'case-photos')
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'case_photos_insert'
  ) THEN
    EXECUTE $p$
      CREATE POLICY case_photos_insert ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = 'case-photos'
          AND (storage.foldername(name))[1] = auth.uid()::text
        )
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'case_photos_update'
  ) THEN
    EXECUTE $p$
      CREATE POLICY case_photos_update ON storage.objects
        FOR UPDATE TO authenticated
        USING (
          bucket_id = 'case-photos'
          AND (storage.foldername(name))[1] = auth.uid()::text
        )
        WITH CHECK (
          bucket_id = 'case-photos'
          AND (storage.foldername(name))[1] = auth.uid()::text
        )
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'case_photos_delete'
  ) THEN
    EXECUTE $p$
      CREATE POLICY case_photos_delete ON storage.objects
        FOR DELETE TO authenticated
        USING (
          bucket_id = 'case-photos'
          AND (storage.foldername(name))[1] = auth.uid()::text
        )
    $p$;
  END IF;
END $$;

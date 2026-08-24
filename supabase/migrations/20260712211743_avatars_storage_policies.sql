/*
# Storage policies for avatars bucket
*/
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_select'
  ) THEN
    EXECUTE $p$ CREATE POLICY avatars_select ON storage.objects FOR SELECT TO public USING (bucket_id='avatars') $p$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_insert'
  ) THEN
    EXECUTE $p$ CREATE POLICY avatars_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='avatars') $p$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_update'
  ) THEN
    EXECUTE $p$ CREATE POLICY avatars_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='avatars') WITH CHECK (bucket_id='avatars') $p$;
  END IF;
END $$;

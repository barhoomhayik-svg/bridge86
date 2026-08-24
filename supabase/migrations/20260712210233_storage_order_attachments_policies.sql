/*
# Storage RLS for order-attachments bucket

Allows authenticated users to upload files and anyone to read them.
*/

DO $$
BEGIN
  -- SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'order_attachments_select'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY order_attachments_select ON storage.objects FOR SELECT TO public USING (bucket_id = 'order-attachments')
    $policy$;
  END IF;

  -- INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'order_attachments_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY order_attachments_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'order-attachments')
    $policy$;
  END IF;
END $$;

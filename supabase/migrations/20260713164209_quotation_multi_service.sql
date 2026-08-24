/*
# Quotation multi-service support

Replaces the single service_id FK on quotations with a proper junction table
so each quotation can include multiple services (general or special case).

1. New Table: quotation_services
   - id (uuid pk)
   - quotation_id → quotations
   - service_id → services (nullable — allows free-text "special case" services)
   - service_name (text) — denormalised name so special cases have a label even without a service row
   - notes (text, nullable) — per-service notes from requester
   - quoted_price (numeric, nullable) — lab fills this per service when responding
   - created_at

2. Changes to quotations
   - Drop old service_id column (was just added, no production data)
   - Drop old response_price column (now per-service in junction table)
   - Keep response_notes for overall notes from lab

3. RLS on quotation_services
   - SELECT: quotation sender OR lab
   - INSERT: quotation sender only (at request time)
   - UPDATE: lab only (to fill quoted_price)
   - DELETE: quotation sender only (before responded)
*/

-- Junction table
CREATE TABLE IF NOT EXISTS quotation_services (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id  uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  service_id    uuid REFERENCES services(id) ON DELETE SET NULL,
  service_name  text NOT NULL,
  notes         text,
  quoted_price  numeric,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE quotation_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_quotation_services" ON quotation_services;
CREATE POLICY "select_quotation_services" ON quotation_services FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      WHERE q.id = quotation_id
        AND (q.from_id = auth.uid() OR q.lab_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "insert_quotation_services" ON quotation_services;
CREATE POLICY "insert_quotation_services" ON quotation_services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotations q
      WHERE q.id = quotation_id AND q.from_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_quotation_services" ON quotation_services;
CREATE POLICY "update_quotation_services" ON quotation_services FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      WHERE q.id = quotation_id AND q.lab_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotations q
      WHERE q.id = quotation_id AND q.lab_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_quotation_services" ON quotation_services;
CREATE POLICY "delete_quotation_services" ON quotation_services FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      WHERE q.id = quotation_id AND q.from_id = auth.uid()
    )
  );

-- Remove columns that are now superseded (no data loss — columns were just added)
ALTER TABLE quotations DROP COLUMN IF EXISTS service_id;
ALTER TABLE quotations DROP COLUMN IF EXISTS response_price;

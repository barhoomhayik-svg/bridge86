/*
# Add service_id to quotations

Quotation requests now reference a specific service from the lab's service catalogue.

1. Changes
   - `quotations.service_id` (uuid, nullable FK → services.id ON DELETE SET NULL)
   - Existing rows unaffected (service_id defaults to NULL)
2. Security — no RLS changes needed (existing policies cover the new column)
*/

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES services(id) ON DELETE SET NULL;

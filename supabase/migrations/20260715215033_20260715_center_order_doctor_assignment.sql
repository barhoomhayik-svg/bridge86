-- 1. Add doctor_id to orders (the actual doctor an order is assigned to by a center)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Rebuild orders SELECT policy to also allow assigned doctor to see the order
DROP POLICY IF EXISTS "orders_select" ON orders;
CREATE POLICY "orders_select" ON orders FOR SELECT TO authenticated
  USING (
    auth.uid() = from_id
    OR auth.uid() = lab_id
    OR auth.uid() = doctor_id
    OR EXISTS (
      SELECT 1 FROM center_members
      WHERE center_members.center_id = auth.uid()
        AND center_members.doctor_id = orders.from_id
    )
  );

-- 3. Rebuild order_attachments SELECT policy to mirror the orders policy
DROP POLICY IF EXISTS "order_attachments_select" ON order_attachments;
CREATE POLICY "order_attachments_select" ON order_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_attachments.order_id
        AND (
          orders.from_id = auth.uid()
          OR orders.lab_id = auth.uid()
          OR orders.doctor_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM center_members
            WHERE center_members.center_id = auth.uid()
              AND center_members.doctor_id = orders.from_id
          )
        )
    )
  );

-- 4. Trigger: notify assigned doctor when a center places an order on their behalf
CREATE OR REPLACE FUNCTION fn_notify_doctor_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_center_name text;
BEGIN
  IF NEW.doctor_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT name INTO v_center_name FROM profiles WHERE id = NEW.from_id;
  INSERT INTO notifications (user_id, type, title, body, related_id)
  VALUES (
    NEW.doctor_id,
    'order_assigned',
    'New Order from ' || COALESCE(v_center_name, 'your center'),
    'Order ' || NEW.order_number || ' for patient ' || NEW.patient_name || ' has been placed on your behalf.',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_doctor_order ON orders;
CREATE TRIGGER trg_notify_doctor_order
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_notify_doctor_order();

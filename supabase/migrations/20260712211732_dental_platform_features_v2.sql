/*
# Feature Expansion: Favourites, Team Members, Notifications, Logo

## Changes

1. profiles — add logo_url column
2. favourite_labs — users (centers/doctors) can bookmark labs
3. center_members — centers can manage a team of linked doctors
4. notifications — in-app notifications with Realtime support
5. Storage bucket for avatars/logos
6. Triggers: auto-create notifications on key events:
   - New order → notify lab
   - Order status change → notify sender
   - New quotation → notify lab
   - Quotation status change → notify requester
*/

-- 1. Add logo_url to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo_url text;

-- 2. Favourite labs
CREATE TABLE IF NOT EXISTS favourite_labs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  lab_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, lab_id)
);
ALTER TABLE favourite_labs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fl_select" ON favourite_labs;
CREATE POLICY "fl_select" ON favourite_labs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "fl_insert" ON favourite_labs;
CREATE POLICY "fl_insert" ON favourite_labs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fl_delete" ON favourite_labs;
CREATE POLICY "fl_delete" ON favourite_labs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Center members (doctors linked to a center)
CREATE TABLE IF NOT EXISTS center_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(center_id, doctor_id)
);
ALTER TABLE center_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cm_select" ON center_members;
CREATE POLICY "cm_select" ON center_members FOR SELECT TO authenticated
  USING (auth.uid() = center_id OR auth.uid() = doctor_id);
DROP POLICY IF EXISTS "cm_insert" ON center_members;
CREATE POLICY "cm_insert" ON center_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = center_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'center'));
DROP POLICY IF EXISTS "cm_delete" ON center_members;
CREATE POLICY "cm_delete" ON center_members FOR DELETE TO authenticated
  USING (auth.uid() = center_id);

-- 4. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  related_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select" ON notifications;
CREATE POLICY "notif_select" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_insert" ON notifications;
CREATE POLICY "notif_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_update" ON notifications;
CREATE POLICY "notif_update" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_delete" ON notifications;
CREATE POLICY "notif_delete" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_favourite_labs_user ON favourite_labs(user_id);
CREATE INDEX IF NOT EXISTS idx_center_members_center ON center_members(center_id);

-- 5. Triggers for notifications

-- Trigger: new order → notify lab
CREATE OR REPLACE FUNCTION fn_notify_new_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  sender_name text;
BEGIN
  SELECT name INTO sender_name FROM profiles WHERE id = NEW.from_id;
  INSERT INTO notifications (user_id, type, title, body, related_id)
  VALUES (NEW.lab_id, 'new_order', 'New Order Received',
    'Order ' || NEW.order_number || ' from ' || COALESCE(sender_name, 'a client'), NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_order ON orders;
CREATE TRIGGER trg_notify_new_order
AFTER INSERT ON orders FOR EACH ROW EXECUTE FUNCTION fn_notify_new_order();

-- Trigger: order status change → notify sender
CREATE OR REPLACE FUNCTION fn_notify_order_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO notifications (user_id, type, title, body, related_id)
    VALUES (NEW.from_id, 'order_update', 'Order Status Changed',
      'Order ' || NEW.order_number || ' is now ' || REPLACE(NEW.status, '_', ' '), NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order_status ON orders;
CREATE TRIGGER trg_notify_order_status
AFTER UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION fn_notify_order_status();

-- Trigger: new quotation → notify lab
CREATE OR REPLACE FUNCTION fn_notify_new_quotation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  sender_name text;
BEGIN
  SELECT name INTO sender_name FROM profiles WHERE id = NEW.from_id;
  INSERT INTO notifications (user_id, type, title, body, related_id)
  VALUES (NEW.lab_id, 'new_quotation', 'New Quotation Request',
    'Quotation request from ' || COALESCE(sender_name, 'a client'), NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_quotation ON quotations;
CREATE TRIGGER trg_notify_new_quotation
AFTER INSERT ON quotations FOR EACH ROW EXECUTE FUNCTION fn_notify_new_quotation();

-- Trigger: quotation updated → notify requester
CREATE OR REPLACE FUNCTION fn_notify_quotation_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO notifications (user_id, type, title, body, related_id)
    VALUES (NEW.from_id, 'quotation_update', 'Quotation Updated',
      'Your quotation request status: ' || NEW.status, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_quotation_update ON quotations;
CREATE TRIGGER trg_notify_quotation_update
AFTER UPDATE ON quotations FOR EACH ROW EXECUTE FUNCTION fn_notify_quotation_update();

-- 6. Storage bucket for avatars/logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

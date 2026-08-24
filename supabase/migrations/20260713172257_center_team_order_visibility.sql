/*
# Allow centers to read orders placed by their team doctors

## Problem
The existing `orders_select` policy only allows a user to read an order if they
are the sender (`from_id = auth.uid()`) or the receiving lab (`lab_id = auth.uid()`).
When a doctor who belongs to a center's team places an order from their own
account, the center cannot see that order — their `auth.uid()` matches neither
column, so RLS blocks the row.

## Changes

### orders — SELECT policy extended
- Old check: `auth.uid() = from_id OR auth.uid() = lab_id`
- New check: same as above, PLUS an EXISTS sub-query that lets a center read any
  order whose sender (`from_id`) is a doctor listed in `center_members` for that
  center.

### order_attachments — SELECT policy extended
- Mirrors the orders change: a center can view attachments on orders it is now
  permitted to see, using the same EXISTS membership check.

## Security notes
- Centers can only READ team orders — they cannot update or delete them.
  Insert/update/delete policies are unchanged.
- The EXISTS clause checks `center_members.center_id = auth.uid()` so a center
  only sees its OWN team's orders, never another center's team.
*/

-- Extend orders SELECT: center can see team-doctor orders
DROP POLICY IF EXISTS "orders_select" ON orders;
CREATE POLICY "orders_select" ON orders FOR SELECT TO authenticated
  USING (
    auth.uid() = from_id
    OR auth.uid() = lab_id
    OR EXISTS (
      SELECT 1 FROM center_members
      WHERE center_members.center_id = auth.uid()
        AND center_members.doctor_id = orders.from_id
    )
  );

-- Extend order_attachments SELECT: center can see attachments on visible orders
DROP POLICY IF EXISTS "order_attachments_select" ON order_attachments;
CREATE POLICY "order_attachments_select" ON order_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_attachments.order_id
        AND (
          orders.from_id = auth.uid()
          OR orders.lab_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM center_members
            WHERE center_members.center_id = auth.uid()
              AND center_members.doctor_id = orders.from_id
          )
        )
    )
  );

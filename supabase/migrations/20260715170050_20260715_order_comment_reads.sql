/*
# Add order_comment_reads table

## Purpose
Track when each user last read the conversation for each order,
enabling unread message badges on order cards in the dashboard.

## New Tables
- `order_comment_reads`
  - `user_id` (uuid, FK → profiles) — the user who read the conversation
  - `order_id` (uuid, FK → orders) — which order they read
  - `last_read_at` (timestamptz) — when they last viewed the conversation
  - PRIMARY KEY (user_id, order_id)

## Security
- RLS enabled, 4 separate policies scoped to `authenticated`
- Users can only read/write their own read-receipt rows
*/

CREATE TABLE IF NOT EXISTS order_comment_reads (
  user_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, order_id)
);

ALTER TABLE order_comment_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reads"  ON order_comment_reads;
DROP POLICY IF EXISTS "insert_own_reads"  ON order_comment_reads;
DROP POLICY IF EXISTS "update_own_reads"  ON order_comment_reads;
DROP POLICY IF EXISTS "delete_own_reads"  ON order_comment_reads;

CREATE POLICY "select_own_reads" ON order_comment_reads FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_reads" ON order_comment_reads FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_reads" ON order_comment_reads FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_reads" ON order_comment_reads FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

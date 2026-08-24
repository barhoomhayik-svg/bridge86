/*
# Order Comments (Messaging between Doctor/Center and Lab)

## Purpose
Adds a real-time messaging thread to each order so doctors/centers and labs
can communicate directly within the order context.

## New Tables

### order_comments
Stores messages posted on an order by either party.
- `id` (uuid, primary key)
- `order_id` (uuid, FK → orders) — which order this message belongs to
- `author_id` (uuid, FK → profiles) — who wrote the message
- `body` (text, not null) — message content
- `created_at` (timestamptz)

## Security
- RLS enabled.
- Only the two parties on the order (from_id or lab_id) may select, insert, or delete comments.
- Authors can only delete their own comments.

## Notes
- Indexes on order_id and author_id for fast lookups.
- Realtime subscribe on order_id filter for live updates.
*/

CREATE TABLE IF NOT EXISTS order_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_comments ENABLE ROW LEVEL SECURITY;

-- Only parties on the order can read comments
DROP POLICY IF EXISTS "order_comments_select" ON order_comments;
CREATE POLICY "order_comments_select" ON order_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_id
        AND (orders.from_id = auth.uid() OR orders.lab_id = auth.uid())
    )
  );

-- Only parties on the order can post comments
DROP POLICY IF EXISTS "order_comments_insert" ON order_comments;
CREATE POLICY "order_comments_insert" ON order_comments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_id
        AND (orders.from_id = auth.uid() OR orders.lab_id = auth.uid())
    )
  );

-- Authors can delete their own comments
DROP POLICY IF EXISTS "order_comments_delete" ON order_comments;
CREATE POLICY "order_comments_delete" ON order_comments FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

CREATE INDEX IF NOT EXISTS idx_order_comments_order_id  ON order_comments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_comments_author_id ON order_comments(author_id);

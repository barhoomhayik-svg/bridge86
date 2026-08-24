/*
# Create push_tokens table for iOS push notifications

1. New Tables
- `push_tokens`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references profiles, not null)
  - `token` (text, not null) — the FCM/APNS device token
  - `platform` (text, not null) — 'ios' or 'android'
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
  - Unique constraint on (user_id, token) to prevent duplicates

2. Security
- Enable RLS on `push_tokens`.
- Users can only manage their own push tokens (owner-scoped CRUD).
*/

CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT push_tokens_user_id_token_key UNIQUE (user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_push_tokens" ON push_tokens;
CREATE POLICY "select_own_push_tokens" ON push_tokens FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_push_tokens" ON push_tokens;
CREATE POLICY "insert_own_push_tokens" ON push_tokens FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_push_tokens" ON push_tokens;
CREATE POLICY "update_own_push_tokens" ON push_tokens FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_push_tokens" ON push_tokens;
CREATE POLICY "delete_own_push_tokens" ON push_tokens FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

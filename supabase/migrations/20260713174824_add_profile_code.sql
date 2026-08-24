-- Add unique short profile_code to every account
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_code text;

-- Backfill existing rows with unique 6-char uppercase hex codes
-- Loop until every profile has a unique code
DO $$
DECLARE
  r RECORD;
  new_code text;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE profile_code IS NULL LOOP
    LOOP
      new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE profile_code = new_code);
    END LOOP;
    UPDATE profiles SET profile_code = new_code WHERE id = r.id;
  END LOOP;
END $$;

-- Set NOT NULL and UNIQUE, and auto-generate on future inserts
ALTER TABLE profiles ALTER COLUMN profile_code SET NOT NULL;
ALTER TABLE profiles ADD CONSTRAINT profiles_profile_code_unique UNIQUE (profile_code);

-- Default for new rows (will retry on collision via app layer or trigger)
CREATE OR REPLACE FUNCTION generate_profile_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  new_code text;
BEGIN
  IF NEW.profile_code IS NULL OR NEW.profile_code = '' THEN
    LOOP
      new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE profile_code = new_code);
    END LOOP;
    NEW.profile_code := new_code;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profile_code ON profiles;
CREATE TRIGGER trg_profile_code
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION generate_profile_code();

CREATE INDEX IF NOT EXISTS idx_profiles_profile_code ON profiles(profile_code);

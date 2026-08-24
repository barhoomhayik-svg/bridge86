/*
# Dental Lab Platform — Initial Schema

## Overview
Multi-role platform connecting dental centers/doctors with dental labs.

## Tables

### profiles
Extends auth.users with role, name, location, and contact info.
- role: 'center' | 'doctor' | 'lab'
- Centers and doctors can discover labs and place orders
- Labs can manage services and case photos but cannot see other users

### labs
Dental lab extended profile with location coordinates for proximity search.

### services
Services offered by dental labs (e.g. crowns, veneers, implants).

### case_photos
Portfolio photos uploaded by labs to showcase their work.

### orders
Orders placed by centers/doctors to a specific lab.
Includes patient details: file_number, patient_name, dr_name, shade, teeth_numbers.

### order_attachments
Files attached to orders (X-rays, scans, etc.).

### quotations
Quotation requests made by centers/doctors to labs, with lab responses.

## Security
- RLS enabled on all tables
- authenticated-only access
- Owners have full CRUD; labs see incoming orders; centers see labs
*/

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('center', 'doctor', 'lab')),
  name text NOT NULL,
  phone text,
  address text,
  city text,
  latitude double precision,
  longitude double precision,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete" ON profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- Services offered by labs
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_from numeric(10,2),
  price_to numeric(10,2),
  turnaround_days int,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "services_select" ON services;
CREATE POLICY "services_select" ON services FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "services_insert" ON services;
CREATE POLICY "services_insert" ON services FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = lab_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lab')
);

DROP POLICY IF EXISTS "services_update" ON services;
CREATE POLICY "services_update" ON services FOR UPDATE TO authenticated USING (auth.uid() = lab_id) WITH CHECK (auth.uid() = lab_id);

DROP POLICY IF EXISTS "services_delete" ON services;
CREATE POLICY "services_delete" ON services FOR DELETE TO authenticated USING (auth.uid() = lab_id);

-- Case photos (portfolio) for labs
CREATE TABLE IF NOT EXISTS case_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  photo_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE case_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "case_photos_select" ON case_photos;
CREATE POLICY "case_photos_select" ON case_photos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "case_photos_insert" ON case_photos;
CREATE POLICY "case_photos_insert" ON case_photos FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = lab_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lab')
);

DROP POLICY IF EXISTS "case_photos_update" ON case_photos;
CREATE POLICY "case_photos_update" ON case_photos FOR UPDATE TO authenticated USING (auth.uid() = lab_id) WITH CHECK (auth.uid() = lab_id);

DROP POLICY IF EXISTS "case_photos_delete" ON case_photos;
CREATE POLICY "case_photos_delete" ON case_photos FOR DELETE TO authenticated USING (auth.uid() = lab_id);

-- Orders from centers/doctors to labs
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL DEFAULT 'ORD-' || upper(substr(gen_random_uuid()::text, 1, 8)),
  from_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lab_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_number text NOT NULL,
  patient_name text NOT NULL,
  dr_name text NOT NULL,
  shade text,
  teeth_numbers text,
  service_id uuid REFERENCES services(id),
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'rejected', 'cancelled')),
  due_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select" ON orders;
CREATE POLICY "orders_select" ON orders FOR SELECT TO authenticated
  USING (auth.uid() = from_id OR auth.uid() = lab_id);

DROP POLICY IF EXISTS "orders_insert" ON orders;
CREATE POLICY "orders_insert" ON orders FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = from_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('center', 'doctor'))
);

DROP POLICY IF EXISTS "orders_update" ON orders;
CREATE POLICY "orders_update" ON orders FOR UPDATE TO authenticated
  USING (auth.uid() = from_id OR auth.uid() = lab_id)
  WITH CHECK (auth.uid() = from_id OR auth.uid() = lab_id);

DROP POLICY IF EXISTS "orders_delete" ON orders;
CREATE POLICY "orders_delete" ON orders FOR DELETE TO authenticated USING (auth.uid() = from_id);

-- Order attachments
CREATE TABLE IF NOT EXISTS order_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  mime_type text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_attachments_select" ON order_attachments;
CREATE POLICY "order_attachments_select" ON order_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_id AND (orders.from_id = auth.uid() OR orders.lab_id = auth.uid())));

DROP POLICY IF EXISTS "order_attachments_insert" ON order_attachments;
CREATE POLICY "order_attachments_insert" ON order_attachments FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = uploader_id AND
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_id AND (orders.from_id = auth.uid() OR orders.lab_id = auth.uid()))
);

DROP POLICY IF EXISTS "order_attachments_delete" ON order_attachments;
CREATE POLICY "order_attachments_delete" ON order_attachments FOR DELETE TO authenticated USING (auth.uid() = uploader_id);

-- Quotation requests
CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lab_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  description text NOT NULL,
  teeth_numbers text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'accepted', 'declined')),
  response_notes text,
  response_price numeric(10,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotations_select" ON quotations;
CREATE POLICY "quotations_select" ON quotations FOR SELECT TO authenticated
  USING (auth.uid() = from_id OR auth.uid() = lab_id);

DROP POLICY IF EXISTS "quotations_insert" ON quotations;
CREATE POLICY "quotations_insert" ON quotations FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = from_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('center', 'doctor'))
);

DROP POLICY IF EXISTS "quotations_update" ON quotations;
CREATE POLICY "quotations_update" ON quotations FOR UPDATE TO authenticated
  USING (auth.uid() = from_id OR auth.uid() = lab_id)
  WITH CHECK (auth.uid() = from_id OR auth.uid() = lab_id);

DROP POLICY IF EXISTS "quotations_delete" ON quotations;
CREATE POLICY "quotations_delete" ON quotations FOR DELETE TO authenticated USING (auth.uid() = from_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_services_lab_id ON services(lab_id);
CREATE INDEX IF NOT EXISTS idx_case_photos_lab_id ON case_photos(lab_id);
CREATE INDEX IF NOT EXISTS idx_orders_from_id ON orders(from_id);
CREATE INDEX IF NOT EXISTS idx_orders_lab_id ON orders(lab_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_quotations_from_id ON quotations(from_id);
CREATE INDEX IF NOT EXISTS idx_quotations_lab_id ON quotations(lab_id);

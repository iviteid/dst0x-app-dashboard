-- Supabase stores the control plane: identity, tenancy, inventory, and access.
-- Telemetry samples belong in MongoDB and must never be written from the browser.

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Device IDs are externally supplied hardware identities, unique across tenants.
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY CHECK (char_length(trim(id)) > 0),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  model TEXT NOT NULL DEFAULT '',
  protocol TEXT NOT NULL DEFAULT 'MQTT',
  status TEXT NOT NULL DEFAULT 'offline'
    CHECK (status IN ('online', 'offline', 'warning', 'critical')),
  reporting_interval_seconds NUMERIC NOT NULL DEFAULT 60
    CHECK (reporting_interval_seconds > 0),
  description TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  kind TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS devices_company_id_idx ON devices(company_id);
CREATE INDEX IF NOT EXISTS user_profiles_company_id_idx ON user_profiles(company_id);

-- sensor_channels remains the canonical sensor-ID registry. It intentionally
-- contains no seeded channel: an empty device has no named parameter.
ALTER TABLE sensor_channels
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS sensor_channels_company_id_idx
  ON sensor_channels(company_id);

-- Existing installations may contain legacy demo channels. NOT VALID preserves
-- them for review while enforcing the relationship for all new rows.
ALTER TABLE sensor_channels
  DROP CONSTRAINT IF EXISTS sensor_channels_device_id_fkey;
ALTER TABLE sensor_channels
  ADD CONSTRAINT sensor_channels_device_id_fkey
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE NOT VALID;

-- Permission names map exactly to CRUD actions exposed by the dashboard.
INSERT INTO role_permissions (role, permission) VALUES
  ('admin', 'companies.view'), ('admin', 'companies.create'), ('admin', 'companies.update'), ('admin', 'companies.delete'),
  ('admin', 'sensors.create'), ('admin', 'sensors.delete'),
  ('manager', 'companies.view'), ('manager', 'sensors.create'),
  ('mandor', 'companies.view')
ON CONFLICT (role, permission) DO NOTHING;

CREATE OR REPLACE FUNCTION current_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM user_profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION has_company_permission(required_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles up
    JOIN role_permissions rp ON rp.role = up.role
    WHERE up.id = auth.uid()
      AND up.is_active = true
      AND rp.permission = required_permission
  )
$$;

-- Controlled tenant bootstrap for the administrator dashboard. This avoids
-- letting a browser assign arbitrary users to arbitrary companies.
CREATE OR REPLACE FUNCTION create_company_for_current_admin(
  company_name TEXT,
  company_slug TEXT
)
RETURNS companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_company companies;
BEGIN
  IF NOT has_company_permission('companies.create') THEN
    RAISE EXCEPTION 'company creation is not permitted';
  END IF;

  INSERT INTO companies (name, slug, created_by)
  VALUES (trim(company_name), lower(trim(company_slug)), auth.uid())
  RETURNING * INTO created_company;

  UPDATE user_profiles SET company_id = created_company.id, updated_at = now()
  WHERE id = auth.uid();

  RETURN created_company;
END;
$$;

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- Make this migration safe to rerun after a partial SQL-editor execution.
DROP POLICY IF EXISTS "Users can view their company" ON companies;
DROP POLICY IF EXISTS "Admins can create companies" ON companies;
DROP POLICY IF EXISTS "Company admins can update their company" ON companies;
DROP POLICY IF EXISTS "Company admins can delete their company" ON companies;
DROP POLICY IF EXISTS "Company members can view devices" ON devices;
DROP POLICY IF EXISTS "Authorized members can create devices" ON devices;
DROP POLICY IF EXISTS "Authorized members can update devices" ON devices;
DROP POLICY IF EXISTS "Authorized members can delete devices" ON devices;

CREATE POLICY "Users can view their company"
  ON companies FOR SELECT TO authenticated
  USING (id = current_company_id());

CREATE POLICY "Admins can create companies"
  ON companies FOR INSERT TO authenticated
  WITH CHECK (has_company_permission('companies.create'));

CREATE POLICY "Company admins can update their company"
  ON companies FOR UPDATE TO authenticated
  USING (id = current_company_id() AND has_company_permission('companies.update'))
  WITH CHECK (id = current_company_id());

CREATE POLICY "Company admins can delete their company"
  ON companies FOR DELETE TO authenticated
  USING (id = current_company_id() AND has_company_permission('companies.delete'));

CREATE POLICY "Company members can view devices"
  ON devices FOR SELECT TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "Authorized members can create devices"
  ON devices FOR INSERT TO authenticated
  WITH CHECK (company_id = current_company_id() AND has_company_permission('devices.create'));

CREATE POLICY "Authorized members can update devices"
  ON devices FOR UPDATE TO authenticated
  USING (company_id = current_company_id() AND has_company_permission('devices.edit'))
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "Authorized members can delete devices"
  ON devices FOR DELETE TO authenticated
  USING (company_id = current_company_id() AND has_company_permission('devices.delete'));

DROP POLICY IF EXISTS "Authenticated users can read sensor channels" ON sensor_channels;
DROP POLICY IF EXISTS "Authorized users can insert sensor channels" ON sensor_channels;
DROP POLICY IF EXISTS "Authorized users can update sensor channels" ON sensor_channels;
DROP POLICY IF EXISTS "Authorized users can delete sensor channels" ON sensor_channels;
DROP POLICY IF EXISTS "Company members can view sensor channels" ON sensor_channels;
DROP POLICY IF EXISTS "Authorized members can create sensor channels" ON sensor_channels;
DROP POLICY IF EXISTS "Authorized members can update sensor channels" ON sensor_channels;
DROP POLICY IF EXISTS "Authorized members can delete sensor channels" ON sensor_channels;

CREATE POLICY "Company members can view sensor channels"
  ON sensor_channels FOR SELECT TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "Authorized members can create sensor channels"
  ON sensor_channels FOR INSERT TO authenticated
  WITH CHECK (
    company_id = current_company_id()
    AND has_company_permission('sensors.create')
    AND EXISTS (
      SELECT 1 FROM devices d
      WHERE d.id = device_id AND d.company_id = company_id
    )
  );

CREATE POLICY "Authorized members can update sensor channels"
  ON sensor_channels FOR UPDATE TO authenticated
  USING (company_id = current_company_id() AND has_company_permission('sensors.edit'))
  WITH CHECK (company_id = current_company_id());

CREATE POLICY "Authorized members can delete sensor channels"
  ON sensor_channels FOR DELETE TO authenticated
  USING (company_id = current_company_id() AND has_company_permission('sensors.delete'));

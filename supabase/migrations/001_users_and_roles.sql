-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'mandor', 'operator', 'asisten');

-- User profiles table (linked to Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'asisten',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Role permissions table
CREATE TABLE role_permissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role user_role NOT NULL,
  permission TEXT NOT NULL,
  UNIQUE (role, permission)
);

-- Seed default permissions
INSERT INTO role_permissions (role, permission) VALUES
  -- Admin: full access
  ('admin', 'devices.view'), ('admin', 'devices.edit'), ('admin', 'devices.create'), ('admin', 'devices.delete'),
  ('admin', 'sensors.view'), ('admin', 'sensors.edit'),
  ('admin', 'users.view'), ('admin', 'users.edit'), ('admin', 'users.create'), ('admin', 'users.delete'),
  ('admin', 'settings.view'), ('admin', 'settings.edit'),
  -- Manager
  ('manager', 'devices.view'), ('manager', 'devices.edit'), ('manager', 'devices.create'),
  ('manager', 'sensors.view'), ('manager', 'sensors.edit'),
  ('manager', 'users.view'),
  ('manager', 'settings.view'), ('manager', 'settings.edit'),
  -- Mandor
  ('mandor', 'devices.view'), ('mandor', 'devices.edit'),
  ('mandor', 'sensors.view'), ('mandor', 'sensors.edit'),
  ('mandor', 'settings.view'),
  -- Operator
  ('operator', 'devices.view'),
  ('operator', 'sensors.view'), ('operator', 'sensors.edit'),
  -- Asisten
  ('asisten', 'devices.view'),
  ('asisten', 'sensors.view');

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_profiles
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY "Admins can update profiles"
  ON user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete profiles"
  ON user_profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- RLS policies for role_permissions (read-only for authenticated users)
CREATE POLICY "Authenticated users can read permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (true);

-- Auto-create profile on signup via trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _role user_role;
BEGIN
  BEGIN
    _role := (NEW.raw_user_meta_data->>'role')::user_role;
  EXCEPTION WHEN OTHERS THEN
    _role := 'asisten';
  END;

  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(_role, 'asisten')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

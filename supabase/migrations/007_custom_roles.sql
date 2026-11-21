-- Replace the fixed enum with a role registry so administrators can create
-- and delete custom roles without altering PostgreSQL types at runtime.
CREATE TABLE IF NOT EXISTS public.app_roles (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  label TEXT NOT NULL CHECK (char_length(trim(label)) > 0),
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.app_roles (key, label, is_system) VALUES
  ('admin', 'Admin', true), ('manager', 'Manager', true),
  ('mandor', 'Mandor', true), ('operator', 'Operator', true),
  ('asisten', 'Asisten', true)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role::text = 'admin' AND is_active = true)
$$;

ALTER TABLE public.user_profiles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.user_profiles ALTER COLUMN role TYPE TEXT USING role::text;
ALTER TABLE public.user_profiles ALTER COLUMN role SET DEFAULT 'asisten';
ALTER TABLE public.role_permissions ALTER COLUMN role TYPE TEXT USING role::text;

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_fkey;
ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_fkey;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_fkey FOREIGN KEY (role) REFERENCES public.app_roles(key);
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_fkey FOREIGN KEY (role) REFERENCES public.app_roles(key) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE requested_role TEXT := lower(COALESCE(NEW.raw_user_meta_data->>'role', 'asisten'));
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_roles WHERE key = requested_role) THEN requested_role := 'asisten'; END IF;
  INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
  VALUES (NEW.id, COALESCE(NEW.email, ''), COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), 'New user'), requested_role, true)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role = EXCLUDED.role, updated_at = now();
  RETURN NEW;
END;
$$;

ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.app_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.app_roles;
DROP POLICY IF EXISTS "Admins manage role permissions" ON public.role_permissions;
CREATE POLICY "Authenticated users can read roles" ON public.app_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles" ON public.app_roles FOR ALL TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Admins manage role permissions" ON public.role_permissions FOR ALL TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

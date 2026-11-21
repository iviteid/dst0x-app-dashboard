-- Supabase Auth executes this trigger from the auth schema. Fully qualify all
-- public objects so profile creation never depends on the session search_path.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role TEXT := lower(COALESCE(NEW.raw_user_meta_data->>'role', 'asisten'));
  profile_role public.user_role;
BEGIN
  profile_role := CASE requested_role
    WHEN 'admin' THEN 'admin'::public.user_role
    WHEN 'manager' THEN 'manager'::public.user_role
    WHEN 'mandor' THEN 'mandor'::public.user_role
    WHEN 'operator' THEN 'operator'::public.user_role
    ELSE 'asisten'::public.user_role
  END;

  INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), 'New user'),
    profile_role,
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

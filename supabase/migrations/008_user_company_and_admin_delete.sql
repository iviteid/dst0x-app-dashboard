-- Admin-only user lifecycle operations. Deleting from auth.users cascades to
-- user_profiles, so the account itself—not merely its application profile—is removed.
CREATE OR REPLACE FUNCTION public.delete_user_as_admin(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'user deletion is not permitted';
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'an administrator cannot delete their own account';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found'; END IF;
END;
$$;

-- Company assignment is supplied by the administrator's user-creation flow.
-- The reference is checked before it is stored in the profile.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role TEXT := lower(COALESCE(NEW.raw_user_meta_data->>'role', 'asisten'));
  requested_company UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_roles WHERE key = requested_role) THEN
    requested_role := 'asisten';
  END IF;

  BEGIN
    requested_company := NULLIF(NEW.raw_user_meta_data->>'company_id', '')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    requested_company := NULL;
  END;
  IF requested_company IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.companies WHERE id = requested_company) THEN
    requested_company := NULL;
  END IF;

  INSERT INTO public.user_profiles (id, email, full_name, role, company_id, is_active)
  VALUES (
    NEW.id, COALESCE(NEW.email, ''),
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), 'New user'),
    requested_role, requested_company, true
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, full_name = EXCLUDED.full_name,
      role = EXCLUDED.role, company_id = EXCLUDED.company_id, updated_at = now();
  RETURN NEW;
END;
$$;

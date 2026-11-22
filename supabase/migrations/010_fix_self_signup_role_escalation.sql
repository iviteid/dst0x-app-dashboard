-- 010: Stop privilege escalation through self-signup.
--
-- PROBLEM: handle_new_user() trusted the client-supplied `role` inside
-- raw_user_meta_data, so anyone could register with role='admin' by calling
-- supabase.auth.signUp() directly from the browser console, even though the
-- public Create Account form only ever sends 'asisten'. An attacker with an
-- admin profile could read every company, device and sensor, manage users,
-- and delete accounts (delete_user_as_admin).
--
-- FIX: new profiles are always created as 'asisten'. An administrator assigns
-- a higher role afterwards in User Management (updateUserProfile), which is
-- protected by the admin-only RLS policy on user_profiles. The ON CONFLICT
-- branch no longer overwrites role either, so a re-triggered signup cannot
-- escalate an existing account.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_company UUID;
BEGIN
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
    'asisten', requested_company, true
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, full_name = EXCLUDED.full_name,
      company_id = EXCLUDED.company_id, updated_at = now();
  RETURN NEW;
END;
$$;

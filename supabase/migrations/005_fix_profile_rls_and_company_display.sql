-- Do not query user_profiles from a user_profiles RLS policy directly: that
-- causes recursive policy evaluation and makes the frontend fall back to demo
-- identity values. The SECURITY DEFINER helper evaluates admin status safely.
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'::public.user_role
      AND is_active = true
  )
$$;

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.user_profiles;

CREATE POLICY "Admins can read all profiles"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (public.is_current_user_admin());

CREATE POLICY "Admins can insert profiles"
  ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can update profiles"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can delete profiles"
  ON public.user_profiles FOR DELETE TO authenticated
  USING (public.is_current_user_admin());

-- Administrators are platform administrators: they can manage every tenant's
-- company, device registry, and sensor registry. Other roles remain scoped to
-- the company assigned in user_profiles.company_id.

CREATE OR REPLACE FUNCTION public.create_company_for_current_admin(
  company_name TEXT,
  company_slug TEXT
)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_company public.companies;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'company creation is not permitted';
  END IF;

  INSERT INTO public.companies (name, slug, created_by)
  VALUES (trim(company_name), lower(trim(company_slug)), auth.uid())
  RETURNING * INTO created_company;

  -- Only assign a primary company for an admin who does not yet have one.
  UPDATE public.user_profiles
  SET company_id = COALESCE(company_id, created_company.id), updated_at = now()
  WHERE id = auth.uid();

  RETURN created_company;
END;
$$;

DROP POLICY IF EXISTS "Users can view their company" ON public.companies;
DROP POLICY IF EXISTS "Admins can create companies" ON public.companies;
DROP POLICY IF EXISTS "Company admins can update their company" ON public.companies;
DROP POLICY IF EXISTS "Company admins can delete their company" ON public.companies;

CREATE POLICY "Members can view assigned company and admins all companies"
  ON public.companies FOR SELECT TO authenticated
  USING (id = public.current_company_id() OR public.is_current_user_admin());

CREATE POLICY "Admins can create companies"
  ON public.companies FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can update companies"
  ON public.companies FOR UPDATE TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can delete companies"
  ON public.companies FOR DELETE TO authenticated
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Company members can view devices" ON public.devices;
DROP POLICY IF EXISTS "Authorized members can create devices" ON public.devices;
DROP POLICY IF EXISTS "Authorized members can update devices" ON public.devices;
DROP POLICY IF EXISTS "Authorized members can delete devices" ON public.devices;

CREATE POLICY "Members view assigned devices and admins all devices"
  ON public.devices FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_current_user_admin());

CREATE POLICY "Authorized members create devices and admins any company"
  ON public.devices FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_user_admin()
    OR (company_id = public.current_company_id() AND public.has_company_permission('devices.create'))
  );

CREATE POLICY "Authorized members update assigned devices and admins any device"
  ON public.devices FOR UPDATE TO authenticated
  USING (
    public.is_current_user_admin()
    OR (company_id = public.current_company_id() AND public.has_company_permission('devices.edit'))
  )
  WITH CHECK (
    public.is_current_user_admin()
    OR company_id = public.current_company_id()
  );

CREATE POLICY "Authorized members delete assigned devices and admins any device"
  ON public.devices FOR DELETE TO authenticated
  USING (
    public.is_current_user_admin()
    OR (company_id = public.current_company_id() AND public.has_company_permission('devices.delete'))
  );

DROP POLICY IF EXISTS "Company members can view sensor channels" ON public.sensor_channels;
DROP POLICY IF EXISTS "Authorized members can create sensor channels" ON public.sensor_channels;
DROP POLICY IF EXISTS "Authorized members can update sensor channels" ON public.sensor_channels;
DROP POLICY IF EXISTS "Authorized members can delete sensor channels" ON public.sensor_channels;

CREATE POLICY "Members view assigned sensor channels and admins all channels"
  ON public.sensor_channels FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_current_user_admin());

CREATE POLICY "Authorized members create sensor channels and admins any company"
  ON public.sensor_channels FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_user_admin()
    OR (
      company_id = public.current_company_id()
      AND public.has_company_permission('sensors.create')
    )
  );

CREATE POLICY "Authorized members update assigned sensor channels and admins any channel"
  ON public.sensor_channels FOR UPDATE TO authenticated
  USING (
    public.is_current_user_admin()
    OR (company_id = public.current_company_id() AND public.has_company_permission('sensors.edit'))
  )
  WITH CHECK (
    public.is_current_user_admin()
    OR company_id = public.current_company_id()
  );

CREATE POLICY "Authorized members delete assigned sensor channels and admins any channel"
  ON public.sensor_channels FOR DELETE TO authenticated
  USING (
    public.is_current_user_admin()
    OR (company_id = public.current_company_id() AND public.has_company_permission('sensors.delete'))
  );

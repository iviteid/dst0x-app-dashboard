-- Sensor inventory is configuration, not telemetry. A channel remains attached
-- to its device even when the latest device payload omits its reading.
CREATE TABLE IF NOT EXISTS sensor_channels (
  device_id TEXT NOT NULL,
  sensor_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sensor_type TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  min_value DOUBLE PRECISION,
  max_value DOUBLE PRECISION,
  decimal_places SMALLINT CHECK (decimal_places BETWEEN 0 AND 6),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, sensor_id)
);

ALTER TABLE sensor_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sensor channels"
  ON sensor_channels FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION can_edit_sensor_channels()
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
      AND rp.permission = 'sensors.edit'
  );
$$;

CREATE POLICY "Authorized users can insert sensor channels"
  ON sensor_channels FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_sensor_channels());

CREATE POLICY "Authorized users can update sensor channels"
  ON sensor_channels FOR UPDATE
  TO authenticated
  USING (can_edit_sensor_channels())
  WITH CHECK (can_edit_sensor_channels());

CREATE POLICY "Authorized users can delete sensor channels"
  ON sensor_channels FOR DELETE
  TO authenticated
  USING (can_edit_sensor_channels());

INSERT INTO sensor_channels
  (device_id, sensor_id, name, sensor_type, unit, min_value, max_value, decimal_places)
VALUES
  ('RSC-001', 'RSC-tem', 'Air Temperature', 'temperature', '°C', 10, 50, 1),
  ('RSC-001', 'RSC-hum', 'Air Humidity', 'humidity', '%RH', 0, 100, 1),
  ('RSC-001', 'RSC-pres', 'Air Pressure', 'pressure', 'hPa', 850, 1100, 1),
  ('RSC-001', 'RSC-winspe', 'Wind Speed', 'wind_speed', 'm/s', 0, 60, 1),
  ('RSC-001', 'RSC-windir', 'Wind Direction', 'wind_direction', '°', 0, 360, 0),
  ('RSC-001', 'RSC-batt', 'Battery Voltage', 'battery_voltage', 'V', 3, 4.2, 2),
  ('RSC-001', 'RSC-sig', 'Signal Strength', 'signal', 'dBm', -120, 0, 0)
ON CONFLICT (device_id, sensor_id) DO NOTHING;

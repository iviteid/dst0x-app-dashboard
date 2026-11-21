import type { Device, Sensor } from "../shared/types/domain";
import { supabase } from "./supabase";

type DeviceRow = {
  id: string;
  name: string;
  model: string;
  protocol: string;
  status: Device["status"];
  reporting_interval_seconds: number;
  description: string;
  tags: string[];
  kind: Device["kind"] | null;
  latitude: number | null;
  longitude: number | null;
  updated_at: string;
};

const DEFAULT_FARM_ID = "company";
const DEFAULT_ZONE_ID = "default";

export type Company = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

function deviceFromRow(row: DeviceRow): Device {
  return {
    id: row.id,
    farmId: DEFAULT_FARM_ID,
    zoneId: DEFAULT_ZONE_ID,
    name: row.name,
    model: row.model,
    protocol: row.protocol,
    status: row.status,
    lastSeen: row.updated_at,
    lastTelemetry: row.updated_at,
    intervalSeconds: Number(row.reporting_interval_seconds),
    description: row.description,
    tags: row.tags ?? [],
    kind: row.kind ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
  };
}

export async function listRegisteredDevices(): Promise<Device[]> {
  const { data, error } = await supabase
    .from("devices")
    .select("id, name, model, protocol, status, reporting_interval_seconds, description, tags, kind, latitude, longitude, updated_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as DeviceRow[] | null ?? []).map(deviceFromRow);
}

export async function saveRegisteredDevice(device: Device): Promise<Device> {
  const { data: companyId, error: companyError } = await supabase.rpc(
    "current_company_id",
  );
  if (companyError) throw companyError;
  if (!companyId) throw new Error("Your account is not assigned to a company.");

  const { data, error } = await supabase
    .from("devices")
    .upsert(
      {
        id: device.id,
        company_id: companyId,
        name: device.name,
        model: device.model,
        protocol: device.protocol,
        status: device.status,
        reporting_interval_seconds: device.intervalSeconds,
        description: device.description,
        tags: device.tags,
        kind: device.kind ?? null,
        latitude: device.latitude ?? null,
        longitude: device.longitude ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id, name, model, protocol, status, reporting_interval_seconds, description, tags, kind, latitude, longitude, updated_at")
    .single();
  if (error) throw error;
  return deviceFromRow(data as DeviceRow);
}

export async function deleteRegisteredDevice(id: string) {
  const { error } = await supabase.from("devices").delete().eq("id", id);
  if (error) throw error;
}

export async function createCompany(name: string, slug: string) {
  const { data, error } = await supabase.rpc("create_company_for_current_admin", {
    company_name: name,
    company_slug: slug,
  });
  if (error) throw error;
  return data as Company;
}

export async function getCompany(id: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, slug, created_at")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as Company;
}

export async function updateCompany(id: string, name: string, slug: string) {
  const { data, error } = await supabase
    .from("companies")
    .update({ name, slug, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, name, slug, created_at")
    .single();
  if (error) throw error;
  return data as Company;
}

export async function createSensorChannel(sensor: Sensor) {
  const { data: companyId, error: companyError } = await supabase.rpc(
    "current_company_id",
  );
  if (companyError) throw companyError;
  if (!companyId) throw new Error("Your account is not assigned to a company.");

  const { error } = await supabase.from("sensor_channels").insert({
    company_id: companyId,
    device_id: sensor.deviceId,
    sensor_id: sensor.id,
    name: sensor.name,
    sensor_type: sensor.type,
    unit: sensor.unit,
    min_value: sensor.min ?? null,
    max_value: sensor.max ?? null,
    decimal_places: sensor.decimals ?? null,
    enabled: true,
  });
  if (error) throw error;
}

export async function listRegisteredSensors(): Promise<Sensor[]> {
  const { data, error } = await supabase
    .from("sensor_channels")
    .select("device_id, sensor_id, name, sensor_type, unit, min_value, max_value, decimal_places")
    .eq("enabled", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.sensor_id,
    deviceId: row.device_id,
    name: row.name,
    type: row.sensor_type,
    unit: row.unit,
    min: row.min_value ?? undefined,
    max: row.max_value ?? undefined,
    decimals: row.decimal_places ?? undefined,
    value: 0,
    quality: "missing" as const,
    timestamp: "",
  }));
}

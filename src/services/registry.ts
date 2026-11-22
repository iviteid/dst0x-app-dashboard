import type { Device, Sensor } from "../shared/types/domain";
import { supabase } from "./supabase";

type DeviceRow = {
  id: string;
  company_id: string;
  companies: { name: string }[] | { name: string } | null;
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
  profile: string;
  address: string;
  commodity: string;
  company_number: string;
  location: string;
  email: string;
  created_at: string;
};

export type CompanyDetails = Omit<Company, "id" | "created_at">;

function deviceFromRow(row: DeviceRow): Device {
  return {
    id: row.id,
    companyId: row.company_id,
    companyName: Array.isArray(row.companies)
      ? row.companies[0]?.name
      : row.companies?.name,
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
    .select("id, company_id, name, model, protocol, status, reporting_interval_seconds, description, tags, kind, latitude, longitude, updated_at, companies!devices_company_id_fkey(name)")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as DeviceRow[] | null ?? []).map(deviceFromRow);
}

export async function saveRegisteredDevice(device: Device): Promise<Device> {
  const { data: currentCompanyId, error: companyError } = await supabase.rpc("current_company_id");
  if (companyError) throw companyError;
  const companyId = device.companyId ?? currentCompanyId;
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
    .select("id, company_id, name, model, protocol, status, reporting_interval_seconds, description, tags, kind, latitude, longitude, updated_at, companies!devices_company_id_fkey(name)")
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
    .select("id, name, slug, profile, address, commodity, company_number, location, email, created_at")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as Company;
}

export async function listCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, slug, profile, address, commodity, company_number, location, email, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Company[];
}

export async function deleteCompany(id: string) {
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) throw error;
}

export async function updateCompany(id: string, details: CompanyDetails) {
  const { data, error } = await supabase
    .from("companies")
    .update({ ...details, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, name, slug, profile, address, commodity, company_number, location, email, created_at")
    .single();
  if (error) throw error;
  return data as Company;
}

export async function createSensorChannel(sensor: Sensor, targetCompanyId?: string) {
  const { data: currentCompanyId, error: companyError } = await supabase.rpc(
    "current_company_id",
  );
  if (companyError) throw companyError;
  const companyId = targetCompanyId ?? currentCompanyId;
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

export async function deleteSensorChannel(deviceId: string, sensorId: string) {
  const { error } = await supabase
    .from("sensor_channels")
    .delete()
    .eq("device_id", deviceId)
    .eq("sensor_id", sensorId);
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

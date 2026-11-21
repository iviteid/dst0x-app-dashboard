import type { Alert, Device, Farm, Sensor, Telemetry, Zone } from "../shared/types/domain";

export let DEMO_NOW = new Date().toISOString();

export const farms: Farm[] = [
  {
    id: "pens",
    name: "DSTx Farm",
    location: "Indonesia",
    timezone: "Asia/Jakarta",
    description: "DSTx remote sensor deployment",
  },
];

export const zones: Zone[] = [
  {
    id: "pens-1",
    farmId: "pens",
    name: "Station Area",
    description: "Main weather station deployment",
  },
];

const ago = (minutes: number) =>
  new Date(Date.now() - minutes * 60000).toISOString();

// The dashboard intentionally starts empty. Devices and sensor IDs are created
// by an administrator in Supabase before telemetry can be displayed.
export const initialDevices: Device[] = [];
export let initialSensors: Sensor[] = [];
export let initialTelemetry: Telemetry[] = [];

type DataListener = () => void;
const listeners = new Set<DataListener>();
export function onDataUpdate(fn: DataListener) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export function updateLiveData(sensors: Sensor[], telemetry: Telemetry[], lastSeen?: string) {
  const deviceId = sensors[0]?.deviceId;
  if (!deviceId) return;
  const otherSensors = initialSensors.filter((s) => s.deviceId !== deviceId);
  const otherTelemetry = initialTelemetry.filter((t) => t.deviceId !== deviceId);
  initialSensors = [...sensors, ...otherSensors];
  initialTelemetry = [...telemetry, ...otherTelemetry];
  DEMO_NOW = new Date().toISOString();
  if (lastSeen) {
    const d = initialDevices.find((x) => x.id === deviceId);
    if (d) {
      d.lastSeen = lastSeen;
      d.lastTelemetry = lastSeen;
      d.status = "online";
      const battery = sensors.find((sensor) => sensor.id === "RSC-batt");
      const signal = sensors.find((sensor) => sensor.id === "RSC-sig");
      if (battery?.quality === "valid") d.voltage = battery.value;
      if (signal?.quality === "valid") d.signal = signal.value;
    }
  }
  listeners.forEach((fn) => fn());
}

export function replaceRegisteredSensors(sensors: Sensor[]) {
  // Preserve live values from previous fetch to avoid flash of "No reading"
  const prevMap = new Map(initialSensors.map((s) => [s.id, s]));
  initialSensors = sensors.map((s) => {
    const prev = prevMap.get(s.id);
    if (prev && prev.quality === "valid") {
      return { ...s, value: prev.value, quality: prev.quality, timestamp: prev.timestamp };
    }
    return s;
  });
  listeners.forEach((fn) => fn());
}

export function updateSensor(id: string, patch: { name?: string; min?: number | null; max?: number | null; decimals?: number | null; unit?: string }) {
  const s = initialSensors.find((x) => x.id === id);
  if (!s) return;
  if (patch.name !== undefined) s.name = patch.name;
  if (patch.min !== undefined) s.min = patch.min ?? undefined;
  if (patch.max !== undefined) s.max = patch.max ?? undefined;
  if (patch.decimals !== undefined) s.decimals = patch.decimals ?? undefined;
  if (patch.unit !== undefined) s.unit = patch.unit;
  listeners.forEach((fn) => fn());
}

export const initialAlerts: Alert[] = [];

export function farmName(id: string) {
  return farms.find((f) => f.id === id)?.name || id;
}
export function zoneName(id: string) {
  return zones.find((z) => z.id === id)?.name || id;
}
export function formatTime(iso: string, timezone = "Asia/Jakarta") {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows: (string | number | undefined)[][]) {
  return rows
    .map((r) =>
      r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
}

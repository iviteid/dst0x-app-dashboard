import type { Alert, Device, Farm, Sensor, Telemetry, Zone } from "./types";

export let DEMO_NOW = new Date().toISOString();

export const farms: Farm[] = [
  {
    id: "pens",
    name: "AWS Pens",
    location: "Indonesia",
    timezone: "Asia/Jakarta",
    description: "Automatic Weather Station — Pens site",
  },
];

export const zones: Zone[] = [
  {
    id: "pens-1",
    farmId: "pens",
    name: "Station Area",
    description: "Main weather station deployment",
  },
  {
    id: "pens-2",
    farmId: "pens",
    name: "Pond Area",
    description: "Water quality monitoring zone",
  },
];

const ago = (minutes: number) =>
  new Date(Date.now() - minutes * 60000).toISOString();

export const initialDevices: Device[] = [
  {
    id: "MTI-G7X26ZVJPQ5G",
    farmId: "pens",
    zoneId: "pens-1",
    name: "AWS Pens",
    model: "G7X Weather Station",
    protocol: "HTTP API",
    status: "online" as const,
    lastSeen: ago(42),
    lastTelemetry: ago(42),
    firmware: "v1.0.0",
    battery: 95,
    voltage: undefined,
    signal: undefined,
    intervalSeconds: 3600,
    uptime: "30d 0h",
    description: "Automatic Weather Station — Pens",
    tags: ["aws", "weather"],
    kind: "weather" as const,
    latitude: -7.2756,
    longitude: 112.7946,
  },
  {
    id: "MTI-WQM-POND01",
    farmId: "pens",
    zoneId: "pens-2",
    name: "WQM Pond 1",
    model: "WQM-200 Water Quality Monitor",
    protocol: "HTTP API",
    status: "online" as const,
    lastSeen: ago(15),
    lastTelemetry: ago(15),
    firmware: "v2.1.0",
    battery: 82,
    voltage: undefined,
    signal: undefined,
    intervalSeconds: 900,
    uptime: "14d 8h",
    description: "Water Quality Monitor — Pond 1",
    tags: ["wqm", "water"],
    kind: "water" as const,
    latitude: -7.2762,
    longitude: 112.7938,
  },
];

export let initialSensors: Sensor[] = [
  { id: "G7X2-arHum",  deviceId: "MTI-G7X26ZVJPQ5G", name: "Air Humidity",    type: "humidity",      unit: "%RH",  value: 45.26, min: 30,  max: 95,   quality: "valid", timestamp: ago(42) },
  { id: "G7X2-arTem",  deviceId: "MTI-G7X26ZVJPQ5G", name: "Air Temperature", type: "temperature",   unit: "°C",   value: 34.20, min: 15,  max: 38,   quality: "valid", timestamp: ago(42) },
  { id: "G7X2-rnFal",  deviceId: "MTI-G7X26ZVJPQ5G", name: "Rainfall",        type: "rainfall",      unit: "mm",   value: 0,                          quality: "valid", timestamp: ago(42) },
  { id: "G7X2-arPre",  deviceId: "MTI-G7X26ZVJPQ5G", name: "Air Pressure",    type: "pressure",      unit: "hPa",  value: 1007.60, min: 900, max: 1100, quality: "valid", timestamp: ago(42) },
  { id: "G7X2-batt",   deviceId: "MTI-G7X26ZVJPQ5G", name: "Battery",         type: "battery",       unit: "%",    value: 95,    min: 20,  max: 100,  quality: "valid", timestamp: ago(42) },
  { id: "G7X2-winDir",  deviceId: "MTI-G7X26ZVJPQ5G", name: "Wind Direction",  type: "wind_direction", unit: "°",    value: 264,                        quality: "valid", timestamp: ago(42) },
  { id: "G7X2-winSpe",  deviceId: "MTI-G7X26ZVJPQ5G", name: "Wind Speed",      type: "wind_speed",    unit: "m/s",  value: 1.59,          max: 20,   quality: "valid", timestamp: ago(42) },
  { id: "G7X2-sig",    deviceId: "MTI-G7X26ZVJPQ5G", name: "Signal",          type: "signal",        unit: "",     value: 0,                          quality: "valid", timestamp: ago(42) },
  { id: "WQM1-ph",     deviceId: "MTI-WQM-POND01", name: "PH",              type: "ph",            unit: "pH",   value: 7.42,  min: 6.5, max: 8.5, quality: "valid", timestamp: ago(15) },
  { id: "WQM1-nh3",    deviceId: "MTI-WQM-POND01", name: "Ammonia (NH3-N)", type: "ammonia",       unit: "mg/L", value: 0.010, min: 0,   max: 0.5, quality: "valid", timestamp: ago(15) },
  { id: "WQM1-do",     deviceId: "MTI-WQM-POND01", name: "Dissolved Oxygen",type: "do",            unit: "mg/L", value: 6.8,   min: 4,   max: 12,  quality: "valid", timestamp: ago(15) },
  { id: "WQM1-temp",   deviceId: "MTI-WQM-POND01", name: "Water Temp",      type: "temperature",   unit: "°C",   value: 28.5,  min: 20,  max: 35,  quality: "valid", timestamp: ago(15) },
  { id: "WQM1-tds",    deviceId: "MTI-WQM-POND01", name: "TDS",             type: "tds",           unit: "ppm",  value: 320,   min: 0,   max: 1000,quality: "valid", timestamp: ago(15) },
  { id: "WQM1-turb",   deviceId: "MTI-WQM-POND01", name: "Turbidity",       type: "turbidity",     unit: "NTU",  value: 12.3,  min: 0,   max: 50,  quality: "valid", timestamp: ago(15) },
  { id: "WQM1-batt",   deviceId: "MTI-WQM-POND01", name: "Battery",         type: "battery",       unit: "%",    value: 82,    min: 20,  max: 100, quality: "valid", timestamp: ago(15) },
  { id: "WQM1-sig",    deviceId: "MTI-WQM-POND01", name: "Signal",          type: "signal",        unit: "",     value: 65,                         quality: "valid", timestamp: ago(15) },
];

// Real API data from the device — hourly readings on 2026-10-18
const apiData: { timestamp: string; sensors: { id: string; value: number }[] }[] = [
  { timestamp: "2026-10-18T00:00:00Z", sensors: [
    { id: "G7X2-arHum", value: 48.90 }, { id: "G7X2-arTem", value: 34.58 }, { id: "G7X2-rnFal", value: 0 },
    { id: "G7X2-arPre", value: 1010.20 }, { id: "G7X2-batt", value: 93 }, { id: "G7X2-winDir", value: 333 },
    { id: "G7X2-winSpe", value: 0.22 }, { id: "G7X2-sig", value: 0 },
  ]},
  { timestamp: "2026-10-18T01:00:00Z", sensors: [
    { id: "G7X2-arHum", value: 42.26 }, { id: "G7X2-arTem", value: 36.90 }, { id: "G7X2-rnFal", value: 0 },
    { id: "G7X2-arPre", value: 1009.90 }, { id: "G7X2-batt", value: 99 }, { id: "G7X2-winDir", value: 315 },
    { id: "G7X2-winSpe", value: 0.57 }, { id: "G7X2-sig", value: 31 },
  ]},
  { timestamp: "2026-10-18T02:00:00Z", sensors: [
    { id: "G7X2-arHum", value: 44.48 }, { id: "G7X2-arTem", value: 35.52 }, { id: "G7X2-rnFal", value: 0 },
    { id: "G7X2-arPre", value: 1009.40 }, { id: "G7X2-batt", value: 95 }, { id: "G7X2-winDir", value: 311 },
    { id: "G7X2-winSpe", value: 1.19 }, { id: "G7X2-sig", value: 0 },
  ]},
  { timestamp: "2026-10-18T03:00:00Z", sensors: [
    { id: "G7X2-arHum", value: 44.90 }, { id: "G7X2-arTem", value: 35.30 }, { id: "G7X2-rnFal", value: 0 },
    { id: "G7X2-arPre", value: 1008.70 }, { id: "G7X2-batt", value: 100 }, { id: "G7X2-winDir", value: 270 },
    { id: "G7X2-winSpe", value: 1.24 }, { id: "G7X2-sig", value: 0 },
  ]},
  { timestamp: "2026-10-18T04:00:00Z", sensors: [
    { id: "G7X2-arHum", value: 45.26 }, { id: "G7X2-arTem", value: 34.20 }, { id: "G7X2-rnFal", value: 0 },
    { id: "G7X2-arPre", value: 1007.60 }, { id: "G7X2-batt", value: 95 }, { id: "G7X2-winDir", value: 264 },
    { id: "G7X2-winSpe", value: 1.59 }, { id: "G7X2-sig", value: 0 },
  ]},
  { timestamp: "2026-10-18T05:00:00Z", sensors: [
    { id: "G7X2-arHum", value: 49.72 }, { id: "G7X2-arTem", value: 32.60 }, { id: "G7X2-rnFal", value: 0 },
    { id: "G7X2-arPre", value: 1006.54 }, { id: "G7X2-batt", value: 97 }, { id: "G7X2-winDir", value: 301 },
    { id: "G7X2-winSpe", value: 1.98 }, { id: "G7X2-sig", value: 0 },
  ]},
  { timestamp: "2026-10-18T06:00:00Z", sensors: [
    { id: "G7X2-arHum", value: 50.10 }, { id: "G7X2-arTem", value: 32.66 }, { id: "G7X2-rnFal", value: 0 },
    { id: "G7X2-arPre", value: 1005.30 }, { id: "G7X2-batt", value: 93 }, { id: "G7X2-winDir", value: 277 },
    { id: "G7X2-winSpe", value: 1.96 }, { id: "G7X2-sig", value: 24 },
  ]},
];

const wqmData: { timestamp: string; sensors: { id: string; value: number }[] }[] = [
  { timestamp: "2026-10-18T00:00:00Z", sensors: [
    { id: "WQM1-ph", value: 7.38 }, { id: "WQM1-nh3", value: 0.012 }, { id: "WQM1-do", value: 7.1 },
    { id: "WQM1-temp", value: 27.8 }, { id: "WQM1-tds", value: 315 }, { id: "WQM1-turb", value: 11.8 },
    { id: "WQM1-batt", value: 85 }, { id: "WQM1-sig", value: 62 },
  ]},
  { timestamp: "2026-10-18T01:00:00Z", sensors: [
    { id: "WQM1-ph", value: 7.35 }, { id: "WQM1-nh3", value: 0.011 }, { id: "WQM1-do", value: 7.0 },
    { id: "WQM1-temp", value: 27.6 }, { id: "WQM1-tds", value: 318 }, { id: "WQM1-turb", value: 12.0 },
    { id: "WQM1-batt", value: 84 }, { id: "WQM1-sig", value: 60 },
  ]},
  { timestamp: "2026-10-18T02:00:00Z", sensors: [
    { id: "WQM1-ph", value: 7.40 }, { id: "WQM1-nh3", value: 0.009 }, { id: "WQM1-do", value: 6.9 },
    { id: "WQM1-temp", value: 27.9 }, { id: "WQM1-tds", value: 322 }, { id: "WQM1-turb", value: 12.5 },
    { id: "WQM1-batt", value: 84 }, { id: "WQM1-sig", value: 63 },
  ]},
  { timestamp: "2026-10-18T03:00:00Z", sensors: [
    { id: "WQM1-ph", value: 7.44 }, { id: "WQM1-nh3", value: 0.008 }, { id: "WQM1-do", value: 6.7 },
    { id: "WQM1-temp", value: 28.1 }, { id: "WQM1-tds", value: 319 }, { id: "WQM1-turb", value: 11.9 },
    { id: "WQM1-batt", value: 83 }, { id: "WQM1-sig", value: 64 },
  ]},
  { timestamp: "2026-10-18T04:00:00Z", sensors: [
    { id: "WQM1-ph", value: 7.42 }, { id: "WQM1-nh3", value: 0.010 }, { id: "WQM1-do", value: 6.8 },
    { id: "WQM1-temp", value: 28.5 }, { id: "WQM1-tds", value: 320 }, { id: "WQM1-turb", value: 12.3 },
    { id: "WQM1-batt", value: 82 }, { id: "WQM1-sig", value: 65 },
  ]},
  { timestamp: "2026-10-18T05:00:00Z", sensors: [
    { id: "WQM1-ph", value: 7.46 }, { id: "WQM1-nh3", value: 0.011 }, { id: "WQM1-do", value: 6.6 },
    { id: "WQM1-temp", value: 28.8 }, { id: "WQM1-tds", value: 325 }, { id: "WQM1-turb", value: 13.0 },
    { id: "WQM1-batt", value: 82 }, { id: "WQM1-sig", value: 61 },
  ]},
  { timestamp: "2026-10-18T06:00:00Z", sensors: [
    { id: "WQM1-ph", value: 7.48 }, { id: "WQM1-nh3", value: 0.013 }, { id: "WQM1-do", value: 6.5 },
    { id: "WQM1-temp", value: 29.0 }, { id: "WQM1-tds", value: 328 }, { id: "WQM1-turb", value: 13.4 },
    { id: "WQM1-batt", value: 81 }, { id: "WQM1-sig", value: 58 },
  ]},
];

export let initialTelemetry: Telemetry[] = [
  ...apiData.flatMap((entry, i) =>
    entry.sensors.map((s) => ({
      id: `${s.id}-${i}`,
      deviceId: "MTI-G7X26ZVJPQ5G",
      sensorId: s.id,
      timestamp: entry.timestamp,
      value: Number(s.value.toFixed(2)),
      quality: "valid" as const,
    })),
  ),
  ...wqmData.flatMap((entry, i) =>
    entry.sensors.map((s) => ({
      id: `${s.id}-${i}`,
      deviceId: "MTI-WQM-POND01",
      sensorId: s.id,
      timestamp: entry.timestamp,
      value: Number(s.value.toFixed(3)),
      quality: "valid" as const,
    })),
  ),
];

type DataListener = () => void;
const listeners = new Set<DataListener>();
export function onDataUpdate(fn: DataListener) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export function updateLiveData(sensors: Sensor[], telemetry: Telemetry[], lastSeen?: string) {
  const otherSensors = initialSensors.filter((s) => s.deviceId !== "MTI-G7X26ZVJPQ5G");
  const otherTelemetry = initialTelemetry.filter((t) => t.deviceId !== "MTI-G7X26ZVJPQ5G");
  initialSensors = [...sensors, ...otherSensors];
  initialTelemetry = [...telemetry, ...otherTelemetry];
  DEMO_NOW = new Date().toISOString();
  if (lastSeen) {
    const d = initialDevices.find((x) => x.id === "MTI-G7X26ZVJPQ5G");
    if (d) {
      d.lastSeen = lastSeen;
      d.lastTelemetry = lastSeen;
      d.status = "online";
    }
  }
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

import type { Sensor, Telemetry } from "./types";

const API_URL =
  "https://app.mertani.co.id/external/v1/devices/MTI-G7X26ZVJPQ5G/data";
const AUTH =
  "Basic cGVucy1ld3M6eFAyWHVLOWN6SmJwbURacHY3U0FOUFVON291QjFpNm0=";

const SENSOR_MAP: Record<string, { name: string; type: string; unit: string }> =
  {
    "G7X2-arHum": { name: "Air Humidity", type: "humidity", unit: "%RH" },
    "G7X2-arTem": { name: "Air Temperature", type: "temperature", unit: "°C" },
    "G7X2-rnFal": { name: "Rainfall", type: "rainfall", unit: "mm" },
    "G7X2-arPre": { name: "Air Pressure", type: "pressure", unit: "hPa" },
    "G7X2-batt": { name: "Battery", type: "battery", unit: "%" },
    "G7X2-winDir": { name: "Wind Direction", type: "wind_direction", unit: "°" },
    "G7X2-winSpe": { name: "Wind Speed", type: "wind_speed", unit: "m/s" },
    "G7X2-sig": { name: "Signal", type: "signal", unit: "" },
  };

const SENSOR_LIMITS: Record<string, { min?: number; max?: number }> = {
  "G7X2-arHum": { min: 30, max: 95 },
  "G7X2-arTem": { min: 15, max: 38 },
  "G7X2-arPre": { min: 900, max: 1100 },
  "G7X2-batt": { min: 20, max: 100 },
  "G7X2-winSpe": { max: 20 },
};

interface ApiEntry {
  timestamp: string;
  sensors: { id: string; value: number }[];
}

interface ApiResponse {
  message: string;
  data: ApiEntry[];
}

export async function fetchDeviceData(): Promise<{
  sensors: Sensor[];
  telemetry: Telemetry[];
  lastSeen: string;
} | null> {
  try {
    const res = await fetch(API_URL, {
      headers: { Authorization: AUTH },
    });
    if (!res.ok) return null;
    const json: ApiResponse = await res.json();
    if (!json.data?.length) return null;

    const entries = json.data.sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
    );
    const latest = entries[entries.length - 1];

    const sensors: Sensor[] = latest.sensors
      .filter((s) => SENSOR_MAP[s.id])
      .map((s) => {
        const meta = SENSOR_MAP[s.id];
        const limits = SENSOR_LIMITS[s.id] || {};
        return {
          id: s.id,
          deviceId: "MTI-G7X26ZVJPQ5G",
          name: meta.name,
          type: meta.type,
          unit: meta.unit,
          value: Number(s.value.toFixed(2)),
          min: limits.min,
          max: limits.max,
          quality: "valid" as const,
          timestamp: latest.timestamp,
        };
      });

    const telemetry: Telemetry[] = entries.flatMap((entry, i) =>
      entry.sensors
        .filter((s) => SENSOR_MAP[s.id])
        .map((s) => ({
          id: `${s.id}-${i}`,
          deviceId: "MTI-G7X26ZVJPQ5G",
          sensorId: s.id,
          timestamp: entry.timestamp,
          value: Number(s.value.toFixed(2)),
          quality: "valid" as const,
        })),
    );

    return { sensors, telemetry, lastSeen: latest.timestamp };
  } catch {
    return null;
  }
}

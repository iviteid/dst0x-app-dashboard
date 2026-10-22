import type { Sensor, Telemetry } from "./types";

const API_URL =
  import.meta.env.VITE_SENSOR_API_URL ||
  "https://api.dst0x.cloud/v1/sensor-records";
const DEVICE_ID = import.meta.env.VITE_SENSOR_DEVICE_ID || "RSC-001";

type SensorRecord = {
  id: number;
  device_id: string;
  device_time: number | null;
  received_at: string;
  [key: string]: string | number | null;
};

type ApiResponse = {
  success: boolean;
  data: SensorRecord[];
};

const SENSOR_META: Record<
  string,
  { name: string; type: string; unit: string; min?: number; max?: number }
> = {
  "RSC-tem": {
    name: "Air Temperature",
    type: "temperature",
    unit: "°C",
    min: 10,
    max: 50,
  },
  "RSC-hum": {
    name: "Air Humidity",
    type: "humidity",
    unit: "%RH",
    min: 0,
    max: 100,
  },
  "RSC-pres": {
    name: "Air Pressure",
    type: "pressure",
    unit: "hPa",
    min: 850,
    max: 1100,
  },
  "RSC-winspe": {
    name: "Wind Speed",
    type: "wind_speed",
    unit: "m/s",
    min: 0,
    max: 60,
  },
  "RSC-windir": {
    name: "Wind Direction",
    type: "wind_direction",
    unit: "°",
    min: 0,
    max: 360,
  },
  "RSC-batt": {
    name: "Battery Voltage",
    type: "battery_voltage",
    unit: "V",
    min: 3,
    max: 4.2,
  },
  "RSC-sig": {
    name: "Signal Strength",
    type: "signal",
    unit: "dBm",
    min: -120,
    max: 0,
  },
};

const RESERVED_FIELDS = new Set([
  "id",
  "device_id",
  "device_time",
  "received_at",
]);

function titleFromId(id: string) {
  return id
    .replace(/^[^-]+-/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function timestampOf(record: SensorRecord) {
  if (record.device_time && Number.isFinite(record.device_time)) {
    return new Date(record.device_time * 1000).toISOString();
  }
  return `${record.received_at.replace(" ", "T")}Z`;
}

export async function fetchDeviceData(): Promise<{
  sensors: Sensor[];
  telemetry: Telemetry[];
  lastSeen: string;
} | null> {
  try {
    const url = new URL(API_URL);
    url.searchParams.set("device_id", DEVICE_ID);
    url.searchParams.set("limit", "500");
    url.searchParams.set("page", "1");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Sensor API returned ${response.status}`);
    }

    const json: ApiResponse = await response.json();
    if (!json.success || !json.data?.length) return null;

    const records = [...json.data].sort(
      (a, b) => Date.parse(timestampOf(a)) - Date.parse(timestampOf(b)),
    );
    const latest = records[records.length - 1];
    const latestTimestamp = timestampOf(latest);
    const sensorFields = Object.entries(latest).filter(
      ([key, value]) => !RESERVED_FIELDS.has(key) && typeof value === "number",
    );

    const sensors: Sensor[] = sensorFields.map(([id, value]) => {
      const meta = SENSOR_META[id] || {
        name: titleFromId(id),
        type: id.toLowerCase().replaceAll("-", "_"),
        unit: "",
      };
      return {
        id,
        deviceId: DEVICE_ID,
        name: meta.name,
        type: meta.type,
        unit: meta.unit,
        value: Number(value),
        min: meta.min,
        max: meta.max,
        quality: "valid",
        timestamp: latestTimestamp,
      };
    });

    const telemetry: Telemetry[] = records.flatMap((record) => {
      const timestamp = timestampOf(record);
      return Object.entries(record)
        .filter(
          ([key, value]) =>
            !RESERVED_FIELDS.has(key) && typeof value === "number",
        )
        .map(([sensorId, value]) => ({
          id: `${record.id}-${sensorId}`,
          deviceId: DEVICE_ID,
          sensorId,
          timestamp,
          value: Number(value),
          quality: "valid" as const,
        }));
    });

    return { sensors, telemetry, lastSeen: latestTimestamp };
  } catch (error) {
    console.error("Unable to fetch DSTx sensor data", error);
    return null;
  }
}

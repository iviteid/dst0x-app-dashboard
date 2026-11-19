import type { Sensor, Telemetry } from "./types";
import { supabase } from "./supabase";
import {
  DEFAULT_SENSOR_CHANNELS,
  type SensorChannelDefinition,
} from "./sensorConfig";

const API_URL =
  import.meta.env.VITE_SENSOR_API_URL ||
  "https://api.dst0x.cloud/v1/sensor-records";
const DEVICE_ID = import.meta.env.VITE_SENSOR_DEVICE_ID || "RSC-001";
const DEVICE_INTERVAL_URL = API_URL.replace(
  /\/sensor-records\/?$/,
  "/device-interval",
);

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

type DeviceIntervalResponse = {
  success: boolean;
  device_id: string;
  interval_ms: number;
  interval_seconds: number;
};

type SensorChannelRow = {
  device_id: string;
  sensor_id: string;
  name: string;
  sensor_type: string;
  unit: string;
  min_value: number | null;
  max_value: number | null;
  decimal_places: number | null;
};

let registryWarningShown = false;

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

function inferredChannel(id: string, deviceId: string): SensorChannelDefinition {
  return {
    id,
    deviceId,
    name: titleFromId(id),
    type: id.toLowerCase().replaceAll("-", "_"),
    unit: "",
  };
}

function channelFromRow(row: SensorChannelRow): SensorChannelDefinition {
  return {
    id: row.sensor_id,
    deviceId: row.device_id,
    name: row.name,
    type: row.sensor_type,
    unit: row.unit,
    min: row.min_value ?? undefined,
    max: row.max_value ?? undefined,
    decimals: row.decimal_places ?? undefined,
  };
}

async function loadSensorChannels(deviceId: string) {
  const defaults = DEFAULT_SENSOR_CHANNELS.filter(
    (channel) => channel.deviceId === deviceId,
  );
  const { data, error } = await supabase
    .from("sensor_channels")
    .select(
      "device_id, sensor_id, name, sensor_type, unit, min_value, max_value, decimal_places",
    )
    .eq("device_id", deviceId)
    .eq("enabled", true)
    .order("created_at", { ascending: true });

  if (error) {
    if (!registryWarningShown) {
      console.warn(
        "Sensor registry is unavailable; using bundled channel configuration.",
        error.message,
      );
      registryWarningShown = true;
    }
    return defaults;
  }

  const channels = new Map(defaults.map((channel) => [channel.id, channel]));
  for (const row of (data ?? []) as SensorChannelRow[]) {
    const channel = channelFromRow(row);
    channels.set(channel.id, channel);
  }
  return [...channels.values()];
}

async function registerDiscoveredChannels(
  channels: SensorChannelDefinition[],
) {
  if (!channels.length) return;
  const rows = channels.map((channel) => ({
    device_id: channel.deviceId,
    sensor_id: channel.id,
    name: channel.name,
    sensor_type: channel.type,
    unit: channel.unit,
    min_value: channel.min ?? null,
    max_value: channel.max ?? null,
    decimal_places: channel.decimals ?? null,
  }));
  const { error } = await supabase
    .from("sensor_channels")
    .upsert(rows, {
      onConflict: "device_id,sensor_id",
      ignoreDuplicates: true,
    });
  if (error && !registryWarningShown) {
    console.warn("Unable to register discovered sensor channels.", error.message);
    registryWarningShown = true;
  }
}

export async function saveSensorChannelConfiguration(sensor: Sensor) {
  const { error } = await supabase.from("sensor_channels").upsert(
    {
      device_id: sensor.deviceId,
      sensor_id: sensor.id,
      name: sensor.name,
      sensor_type: sensor.type,
      unit: sensor.unit,
      min_value: sensor.min ?? null,
      max_value: sensor.max ?? null,
      decimal_places: sensor.decimals ?? null,
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "device_id,sensor_id" },
  );
  if (error) throw error;
}

function timestampOf(record: SensorRecord) {
  // Use the server timestamp for ordering and display. Device clocks can be
  // unset or drift far into the future, which would make an old record look
  // like the newest one in the dashboard.
  return `${record.received_at.replace(" ", "T")}Z`;
}

export async function fetchDeviceData(): Promise<{
  sensors: Sensor[];
  telemetry: Telemetry[];
  lastSeen?: string;
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
    if (!json.success) return null;

    const records = [...(json.data ?? [])].sort(
      (a, b) => Date.parse(timestampOf(a)) - Date.parse(timestampOf(b)),
    );
    const latest = records.at(-1);
    const latestTimestamp = latest ? timestampOf(latest) : "";
    const configured = await loadSensorChannels(DEVICE_ID);
    const channels = new Map(configured.map((channel) => [channel.id, channel]));
    const discovered: SensorChannelDefinition[] = [];

    for (const record of records) {
      for (const [id, value] of Object.entries(record)) {
        if (RESERVED_FIELDS.has(id) || typeof value !== "number" || channels.has(id)) {
          continue;
        }
        const channel = inferredChannel(id, DEVICE_ID);
        channels.set(id, channel);
        discovered.push(channel);
      }
    }
    void registerDiscoveredChannels(discovered);

    const latestValues = new Map(
      latest
        ? Object.entries(latest).filter(
            ([id, value]) =>
              !RESERVED_FIELDS.has(id) && typeof value === "number",
          )
        : [],
    );

    const sensors: Sensor[] = [...channels.values()].map((channel) => {
      const value = latestValues.get(channel.id);
      const hasReading = typeof value === "number";
      return {
        ...channel,
        value: hasReading ? Number(value) : 0,
        quality: hasReading ? "valid" : "missing",
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

    return {
      sensors,
      telemetry,
      lastSeen: latestTimestamp || undefined,
    };
  } catch (error) {
    console.error("Unable to fetch DSTx sensor data", error);
    return null;
  }
}

export async function fetchDeviceInterval(deviceId: string): Promise<number> {
  const url = new URL(DEVICE_INTERVAL_URL);
  url.searchParams.set("device_id", deviceId);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load interval (${response.status})`);
  }
  const json: DeviceIntervalResponse = await response.json();
  return json.interval_seconds ?? json.interval_ms / 1000;
}

export async function updateDeviceInterval(
  deviceId: string,
  intervalSeconds: number,
): Promise<number> {
  const response = await fetch(DEVICE_INTERVAL_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      device_id: deviceId,
      interval_seconds: intervalSeconds,
    }),
  });
  const json = (await response.json()) as DeviceIntervalResponse & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(json.error || `Unable to save interval (${response.status})`);
  }
  return json.interval_seconds ?? json.interval_ms / 1000;
}

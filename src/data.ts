import type { Alert, Device, Farm, Sensor, Telemetry, Zone } from "./types";
import { seedLocations } from "./deviceGeo";
export const DEMO_NOW = "2026-10-18T04:42:00.000Z";
export const farms: Farm[] = [
  {
    id: "greenhouse",
    name: "Greenhouse A",
    location: "Bogor, West Java",
    timezone: "Asia/Jakarta",
    description: "Protected cultivation and climate monitoring",
  },
  {
    id: "north",
    name: "North Field",
    location: "Cianjur, West Java",
    timezone: "Asia/Jakarta",
    description: "Open field soil and weather monitoring",
  },
  {
    id: "irrigation",
    name: "Irrigation Zone B",
    location: "Sukabumi, West Java",
    timezone: "Asia/Jakarta",
    description: "Reservoir and irrigation distribution monitoring",
  },
];
export const zones: Zone[] = [
  {
    id: "gha-1",
    farmId: "greenhouse",
    name: "Glasshouse East",
    description: "East growing benches",
  },
  {
    id: "gha-2",
    farmId: "greenhouse",
    name: "Nursery West",
    description: "Propagation area",
  },
  {
    id: "north-1",
    farmId: "north",
    name: "Plot N1",
    description: "Northern crop rows",
  },
  {
    id: "north-2",
    farmId: "north",
    name: "Weather Ridge",
    description: "Exposed weather station",
  },
  {
    id: "irb-1",
    farmId: "irrigation",
    name: "Reservoir B",
    description: "Water storage",
  },
  {
    id: "irb-2",
    farmId: "irrigation",
    name: "Valve Corridor",
    description: "Distribution channel",
  },
];
const ago = (minutes: number) =>
  new Date(Date.parse(DEMO_NOW) - minutes * 60000).toISOString();
export const initialDevices: Device[] = [
  [
    "AGR-ESP32-001",
    "greenhouse",
    "gha-1",
    "Greenhouse Node 01",
    "Enviro Node S3",
    "MQTT",
    "online",
    1,
    92,
    3.96,
    -67,
    30,
  ],
  [
    "AGR-ESP32-002",
    "greenhouse",
    "gha-1",
    "Greenhouse Node 02",
    "Enviro Node S3",
    "MQTT",
    "online",
    2,
    88,
    3.91,
    -71,
    30,
  ],
  [
    "AGR-RS485-003",
    "greenhouse",
    "gha-2",
    "Nursery Soil Array",
    "Soil Array M4",
    "RS485 / Modbus",
    "warning",
    4,
    44,
    3.72,
    -79,
    60,
  ],
  [
    "AGR-HTTP-004",
    "greenhouse",
    "gha-2",
    "Nursery Light Station",
    "Light Node L2",
    "HTTP API",
    "online",
    1,
    76,
    3.85,
    -69,
    60,
  ],
  [
    "FLD-LORA-014",
    "north",
    "north-1",
    "North Field Station",
    "Field Station X",
    "MQTT",
    "online",
    1,
    78,
    3.84,
    -73,
    60,
  ],
  [
    "FLD-RS485-019",
    "north",
    "north-1",
    "Soil Probe Cluster",
    "Soil Array M4",
    "RS485 / Modbus",
    "online",
    2,
    65,
    3.79,
    -75,
    60,
  ],
  [
    "ENV-SDI12-008",
    "north",
    "north-2",
    "Weather Mast 02",
    "Weather Station W2",
    "SDI-12",
    "online",
    1,
    86,
    3.9,
    -68,
    30,
  ],
  [
    "ENV-UART-011",
    "north",
    "north-2",
    "Rain Gauge 11",
    "Rain Gauge R1",
    "UART",
    "offline",
    56,
    undefined,
    undefined,
    undefined,
    60,
  ],
  [
    "WTR-MQTT-003",
    "irrigation",
    "irb-1",
    "Reservoir Monitor",
    "Water Node W1",
    "MQTT",
    "warning",
    2,
    34,
    3.62,
    -82,
    60,
  ],
  [
    "WTR-HTTP-006",
    "irrigation",
    "irb-1",
    "Water Quality Station",
    "Water Node Q2",
    "HTTP API",
    "online",
    3,
    81,
    3.88,
    -70,
    60,
  ],
  [
    "CTL-RS485-027",
    "irrigation",
    "irb-2",
    "Irrigation Valve 07",
    "Valve Gateway V3",
    "RS485 / Modbus",
    "offline",
    38,
    undefined,
    undefined,
    undefined,
    60,
  ],
  [
    "CTL-MQTT-029",
    "irrigation",
    "irb-2",
    "Flow Meter 29",
    "Flow Node F1",
    "MQTT",
    "online",
    1,
    73,
    3.82,
    -74,
    30,
  ],
].map(
  ([
    id,
    farmId,
    zoneId,
    name,
    model,
    protocol,
    status,
    mins,
    battery,
    voltage,
    signal,
    intervalSeconds,
  ]) => ({
    id: id as string,
    farmId: farmId as string,
    zoneId: zoneId as string,
    name: name as string,
    model: model as string,
    protocol: protocol as string,
    status: status as Device["status"],
    lastSeen: ago(mins as number),
    lastTelemetry: ago(mins as number),
    firmware: status === "offline" ? undefined : "v2.8.4",
    battery: battery as number | undefined,
    voltage: voltage as number | undefined,
    signal: signal as number | undefined,
    intervalSeconds: intervalSeconds as number,
    uptime: status === "offline" ? undefined : "18d 7h",
    description: "Demo field monitoring device",
    tags: ["demo"],
    ...seedLocations[id as string],
  }),
);
const specs: [string, string, string, number, number?, number?][] = [
  ["Air temperature", "temperature", "°C", 29.4, 18, 34],
  ["Air humidity", "humidity", "%", 76.2, 40, 85],
  ["Soil moisture", "soil_moisture", "%", 42.8, 25, 65],
  ["Soil temperature", "soil_temperature", "°C", 26.1, 15, 32],
  ["Rainfall", "rainfall", "mm", 2.4],
  ["Wind speed", "wind_speed", "km/h", 12.6],
  ["Light intensity", "light", "lux", 18400],
  ["Battery voltage", "battery", "V", 3.82, 3.5, 4.2],
];
export const initialSensors: Sensor[] = initialDevices.flatMap((d, di) => {
  const indices =
    di === 0
      ? [0, 1, 3, 6, 7]
      : di === 6
        ? [0, 4, 5, 6, 7]
        : di === 8
          ? [2, 7, 3]
          : di === 10
            ? [2, 7]
            : di % 2
              ? [0, 1, 2, 7]
              : [2, 3, 4, 7];
  return indices.map((si, n) => {
    const [name, type, unit, base, min, max] = specs[si];
    const demoValue =
      d.id === "WTR-MQTT-003" && type === "battery"
        ? 3.62
        : d.id === "AGR-RS485-003" && type === "soil_moisture"
          ? 23.8
          : Number(
              (
                base +
                (di
                  ? ((di % 4) - 1.5) *
                    (si === 6 ? 700 : si === 0 ? 0.7 : si === 7 ? 0.04 : 1.2)
                  : 0)
              ).toFixed(si === 6 ? 0 : 2),
            );
    return {
      id: `${d.id}-S${n + 1}`,
      deviceId: d.id,
      name,
      type,
      unit,
      value: demoValue,
      min,
      max,
      quality: d.status === "offline" ? "missing" : "valid",
      timestamp: d.lastTelemetry,
    };
  });
});
export const initialAlerts: Alert[] = [
  {
    id: "ALT-001",
    deviceId: "CTL-RS485-027",
    severity: "critical",
    message: "Device disconnected",
    triggeredAt: ago(38),
  },
  {
    id: "ALT-002",
    deviceId: "WTR-MQTT-003",
    sensorId: "WTR-MQTT-003-S2",
    severity: "warning",
    message: "Battery below configured threshold",
    current: "3.62 V",
    threshold: "3.70 V",
    triggeredAt: ago(62),
  },
  {
    id: "ALT-003",
    deviceId: "AGR-RS485-003",
    sensorId: "AGR-RS485-003-S1",
    severity: "warning",
    message: "Soil moisture outside configured range",
    current: "23.8%",
    threshold: "25–65%",
    triggeredAt: ago(91),
  },
  {
    id: "ALT-004",
    deviceId: "ENV-UART-011",
    severity: "critical",
    message: "Telemetry delayed",
    triggeredAt: ago(56),
  },
  {
    id: "ALT-005",
    deviceId: "ENV-SDI12-008",
    severity: "information",
    message: "Connection restored",
    triggeredAt: ago(182),
    acknowledgedAt: ago(170),
    resolvedAt: ago(170),
  },
];
export const initialTelemetry: Telemetry[] = initialSensors.flatMap((s, si) =>
  Array.from({ length: 7 * 24 }, (_, i) => {
    const ts = new Date(
      Date.parse(DEMO_NOW) - (7 * 24 - 1 - i) * 3600000,
    ).toISOString();
    const wave =
      Math.sin(i / 8 + si * 0.8) *
      (s.type === "light"
        ? 1100
        : s.type === "temperature"
          ? 2.3
          : s.type === "battery"
            ? 0.05
            : 3.2);
    return {
      id: `${s.id}-${i}`,
      deviceId: s.deviceId,
      sensorId: s.id,
      timestamp: ts,
      value: Number((s.value + wave).toFixed(s.type === "light" ? 0 : 2)),
      quality: i % 71 === 0 ? ("missing" as const) : ("valid" as const),
    };
  }),
);
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

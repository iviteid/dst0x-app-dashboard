import type { Device } from "./types";

type Kind = NonNullable<Device["kind"]>;
type Position = { latitude: number; longitude: number };

export const zoneCenters: Record<string, Position> = {
  "gha-1": { latitude: -6.588, longitude: 106.806 },
  "gha-2": { latitude: -6.609, longitude: 106.789 },
  "north-1": { latitude: -6.822, longitude: 107.135 },
  "north-2": { latitude: -6.785, longitude: 107.166 },
  "irb-1": { latitude: -6.914, longitude: 106.925 },
  "irb-2": { latitude: -6.939, longitude: 106.967 },
};

export const seedLocations: Record<string, Position & { kind: Kind }> = {
  "AGR-ESP32-001": { latitude: -6.576, longitude: 106.796, kind: "climate" },
  "AGR-ESP32-002": { latitude: -6.594, longitude: 106.819, kind: "climate" },
  "AGR-RS485-003": { latitude: -6.605, longitude: 106.779, kind: "soil" },
  "AGR-HTTP-004": { latitude: -6.619, longitude: 106.803, kind: "light" },
  "FLD-LORA-014": { latitude: -6.809, longitude: 107.119, kind: "climate" },
  "FLD-RS485-019": { latitude: -6.833, longitude: 107.146, kind: "soil" },
  "ENV-SDI12-008": { latitude: -6.767, longitude: 107.156, kind: "weather" },
  "ENV-UART-011": { latitude: -6.788, longitude: 107.184, kind: "weather" },
  "WTR-MQTT-003": { latitude: -6.903, longitude: 106.91, kind: "water" },
  "WTR-HTTP-006": { latitude: -6.922, longitude: 106.944, kind: "water" },
  "CTL-RS485-027": { latitude: -6.93, longitude: 106.954, kind: "control" },
  "CTL-MQTT-029": { latitude: -6.948, longitude: 106.982, kind: "water" },
};

export const kindLabels: Record<Kind, string> = {
  climate: "Climate",
  weather: "Weather",
  soil: "Soil",
  light: "Light",
  water: "Water / flow",
  control: "Control",
};

export function deviceKind(device: Device): Kind {
  if (device.kind) return device.kind;
  if (seedLocations[device.id]) return seedLocations[device.id].kind;
  const label = `${device.name} ${device.model}`.toLowerCase();
  if (/weather|rain|wind/.test(label)) return "weather";
  if (/soil|probe/.test(label)) return "soil";
  if (/light|lux/.test(label)) return "light";
  if (/valve|gateway|controller/.test(label)) return "control";
  if (/water|reservoir|flow/.test(label)) return "water";
  return "climate";
}

export function devicePosition(device: Device): Position {
  if (Number.isFinite(device.latitude) && Number.isFinite(device.longitude))
    return { latitude: device.latitude!, longitude: device.longitude! };
  return seedLocations[device.id] || zoneCenters[device.zoneId] || zoneCenters["gha-1"];
}

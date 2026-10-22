import type { Device } from "./types";

type Kind = NonNullable<Device["kind"]>;
type Position = { latitude: number; longitude: number };

export const zoneCenters: Record<string, Position> = {
  "pens-1": { latitude: -7.2756, longitude: 112.7946 },
};

export const seedLocations: Record<string, Position & { kind: Kind }> = {
  "RSC-001": { latitude: -7.2756, longitude: 112.7946, kind: "soil" },
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
  return seedLocations[device.id] || zoneCenters[device.zoneId] || zoneCenters["pens-1"];
}

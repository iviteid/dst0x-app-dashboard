import type { Sensor } from "./types";

export type SensorChannelDefinition = {
  id: string;
  deviceId: string;
  name: string;
  type: string;
  unit: string;
  min?: number;
  max?: number;
  decimals?: number;
};

export const DEFAULT_SENSOR_CHANNELS: SensorChannelDefinition[] = [
  { id: "RSC-tem", deviceId: "RSC-001", name: "Air Temperature", type: "temperature", unit: "°C", min: 10, max: 50, decimals: 1 },
  { id: "RSC-hum", deviceId: "RSC-001", name: "Air Humidity", type: "humidity", unit: "%RH", min: 0, max: 100, decimals: 1 },
  { id: "RSC-pres", deviceId: "RSC-001", name: "Air Pressure", type: "pressure", unit: "hPa", min: 850, max: 1100, decimals: 1 },
  { id: "RSC-winspe", deviceId: "RSC-001", name: "Wind Speed", type: "wind_speed", unit: "m/s", min: 0, max: 60, decimals: 1 },
  { id: "RSC-windir", deviceId: "RSC-001", name: "Wind Direction", type: "wind_direction", unit: "°", min: 0, max: 360, decimals: 0 },
  { id: "RSC-batt", deviceId: "RSC-001", name: "Battery Voltage", type: "battery_voltage", unit: "V", min: 3, max: 4.2, decimals: 2 },
  { id: "RSC-sig", deviceId: "RSC-001", name: "Signal Strength", type: "signal", unit: "dBm", min: -120, max: 0, decimals: 0 },
];

export function missingSensor(
  channel: SensorChannelDefinition,
  timestamp = "",
): Sensor {
  return {
    ...channel,
    value: 0,
    quality: "missing",
    timestamp,
  };
}

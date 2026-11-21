export type Status = "online" | "offline" | "warning" | "critical";
export type Severity = "critical" | "warning" | "information";
export type Quality = "valid" | "missing" | "suspect";
export interface Farm {
  id: string;
  name: string;
  location: string;
  timezone: string;
  description: string;
}
export interface Zone {
  id: string;
  farmId: string;
  name: string;
  description: string;
}
export interface Device {
  id: string;
  companyId?: string;
  companyName?: string;
  farmId: string;
  zoneId: string;
  name: string;
  model: string;
  protocol: string;
  status: Status;
  lastSeen: string;
  lastTelemetry: string;
  firmware?: string;
  battery?: number;
  voltage?: number;
  signal?: number;
  intervalSeconds: number;
  uptime?: string;
  description: string;
  tags: string[];
  kind?: "climate" | "weather" | "soil" | "light" | "water" | "control";
  latitude?: number;
  longitude?: number;
}
export interface Sensor {
  id: string;
  deviceId: string;
  name: string;
  type: string;
  unit: string;
  value: number;
  min?: number;
  max?: number;
  decimals?: number;
  quality: Quality;
  timestamp: string;
}
export interface Telemetry {
  id: string;
  deviceId: string;
  sensorId: string;
  timestamp: string;
  value: number;
  quality: Quality;
}
export interface Alert {
  id: string;
  deviceId: string;
  sensorId?: string;
  severity: Severity;
  message: string;
  current?: string;
  threshold?: string;
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

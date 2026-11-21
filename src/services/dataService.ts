import type { Alert, Device, Sensor, Telemetry } from "../shared/types/domain";
import {
  initialAlerts,
  initialDevices,
  initialSensors,
  initialTelemetry,
  csv,
  downloadFile,
} from "../store/liveData";
export interface DataService {
  listDevices(farmId?: string): Promise<Device[]>;
  getDeviceById(id: string): Promise<Device | undefined>;
  listSensors(deviceId?: string): Promise<Sensor[]>;
  getLatestReadings(farmId?: string): Promise<Sensor[]>;
  getTelemetryHistory(sensorId: string, limit?: number): Promise<Telemetry[]>;
  listAlerts(farmId?: string): Promise<Alert[]>;
  acknowledgeAlert(id: string): Promise<Alert | undefined>;
  updateDevice(device: Device): Promise<Device>;
  exportTelemetry(rows: Telemetry[], filename: string): Promise<void>;
}
const read = <T>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || fallback;
  } catch {
    return fallback;
  }
};
export const demoService: DataService = {
  async listDevices(farmId) {
    const all = read("agrivaid-devices", initialDevices);
    return farmId ? all.filter((d: Device) => d.farmId === farmId) : all;
  },
  async getDeviceById(id) {
    return (await this.listDevices()).find((d) => d.id === id);
  },
  async listSensors(deviceId) {
    return deviceId
      ? initialSensors.filter((s) => s.deviceId === deviceId)
      : initialSensors;
  },
  async getLatestReadings(farmId) {
    const ids = new Set((await this.listDevices(farmId)).map((d) => d.id));
    return initialSensors.filter((s) => ids.has(s.deviceId));
  },
  async getTelemetryHistory(sensorId, limit = 168) {
    return initialTelemetry
      .filter((t) => t.sensorId === sensorId)
      .slice(-limit);
  },
  async listAlerts(farmId) {
    const ids = new Set((await this.listDevices(farmId)).map((d) => d.id));
    return read("agrivaid-alerts", initialAlerts).filter((a: Alert) =>
      ids.has(a.deviceId),
    );
  },
  async acknowledgeAlert(id) {
    const alerts: Alert[] = read("agrivaid-alerts", initialAlerts);
    const alert = alerts.find((a) => a.id === id);
    if (alert) {
      alert.acknowledgedAt = new Date().toISOString();
      localStorage.setItem("agrivaid-alerts", JSON.stringify(alerts));
    }
    return alert;
  },
  async updateDevice(device) {
    const devices: Device[] = read("agrivaid-devices", initialDevices);
    const i = devices.findIndex((d) => d.id === device.id);
    if (i < 0) devices.push(device);
    else devices[i] = device;
    localStorage.setItem("agrivaid-devices", JSON.stringify(devices));
    return device;
  },
  async exportTelemetry(rows, filename) {
    downloadFile(
      filename,
      csv([
        ["Timestamp (UTC)", "Device ID", "Sensor ID", "Value", "Quality"],
        ...rows.map((r) => [
          r.timestamp,
          r.deviceId,
          r.sensorId,
          r.value,
          r.quality,
        ]),
      ]),
      "text/csv",
    );
  },
};
export class BackendAdapter implements DataService {
  constructor(private baseUrl: string) {}
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${this.baseUrl}${path}`, {
      credentials: "include",
      ...init,
    });
    if (!r.ok) throw new Error(`Backend request failed (${r.status})`);
    return r.json() as Promise<T>;
  }
  listDevices(farmId?: string) {
    return this.request<Device[]>(
      `/devices${farmId ? `?farmId=${encodeURIComponent(farmId)}` : ""}`,
    );
  }
  getDeviceById(id: string) {
    return this.request<Device>(`/devices/${encodeURIComponent(id)}`);
  }
  listSensors(deviceId?: string) {
    return this.request<Sensor[]>(
      `/sensors${deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ""}`,
    );
  }
  getLatestReadings(farmId?: string) {
    return this.request<Sensor[]>(
      `/readings/latest${farmId ? `?farmId=${encodeURIComponent(farmId)}` : ""}`,
    );
  }
  getTelemetryHistory(sensorId: string, limit = 168) {
    return this.request<Telemetry[]>(
      `/telemetry?sensorId=${encodeURIComponent(sensorId)}&limit=${limit}`,
    );
  }
  listAlerts(farmId?: string) {
    return this.request<Alert[]>(
      `/alerts${farmId ? `?farmId=${encodeURIComponent(farmId)}` : ""}`,
    );
  }
  acknowledgeAlert(id: string) {
    return this.request<Alert>(
      `/alerts/${encodeURIComponent(id)}/acknowledge`,
      { method: "POST" },
    );
  }
  updateDevice(device: Device) {
    return this.request<Device>(`/devices/${encodeURIComponent(device.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(device),
    });
  }
  async exportTelemetry(rows: Telemetry[], filename: string) {
    await demoService.exportTelemetry(rows, filename);
  }
}

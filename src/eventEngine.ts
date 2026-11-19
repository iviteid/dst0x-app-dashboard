import type { Device, Sensor, Telemetry, Alert, Severity } from "./types";
import { DEMO_NOW, initialSensors, initialTelemetry, farms, zones } from "./data";

/* ── Crop profiles ────────────────────────────────────────── */
export interface CropProfile {
  name: string;
  growthStage: string;
  thresholds: Record<string, SensorThreshold>;
}
export interface SensorThreshold {
  min?: number;
  max?: number;
  idealMin?: number;
  idealMax?: number;
  unit: string;
  confirmMinutes: number;
  cooldownMinutes: number;
  hysteresis: number;
  priority: Severity;
}

const defaultCrop: CropProfile = {
  name: "General tropical crops",
  growthStage: "Vegetative",
  thresholds: {
    soil_moisture:     { min: 25, max: 80, idealMin: 30, idealMax: 60, unit: "%",    confirmMinutes: 30, cooldownMinutes: 60, hysteresis: 3, priority: "warning" },
    temperature:       { min: 15, max: 38, idealMin: 22, idealMax: 32, unit: "°C",   confirmMinutes: 15, cooldownMinutes: 30, hysteresis: 1, priority: "warning" },
    humidity:          { min: 30, max: 95, idealMin: 50, idealMax: 80, unit: "%",    confirmMinutes: 20, cooldownMinutes: 30, hysteresis: 3, priority: "warning" },
    light:             { min: 5000,        idealMin: 10000, idealMax: 50000, unit: "lux", confirmMinutes: 60, cooldownMinutes: 120, hysteresis: 500, priority: "information" },
    rainfall:          { max: 50,          idealMax: 30,  unit: "mm",  confirmMinutes: 10, cooldownMinutes: 60, hysteresis: 2, priority: "warning" },
    wind_speed:        { max: 15,          idealMax: 10,  unit: "m/s",  confirmMinutes: 5,  cooldownMinutes: 30, hysteresis: 1, priority: "critical" },
    battery:           { min: 20,         idealMin: 30,  unit: "%",   confirmMinutes: 0,  cooldownMinutes: 120, hysteresis: 2, priority: "warning" },
    soil_temperature:  { min: 10, max: 38, idealMin: 18, idealMax: 30, unit: "°C",   confirmMinutes: 30, cooldownMinutes: 60, hysteresis: 1, priority: "information" },
    pressure:          { min: 950, max: 1050, idealMin: 980, idealMax: 1030, unit: "hPa", confirmMinutes: 30, cooldownMinutes: 60, hysteresis: 5, priority: "information" },
  },
};

export function getThreshold(sensorType: string): SensorThreshold | undefined {
  return defaultCrop.thresholds[sensorType];
}
export function getCropProfile(): CropProfile { return defaultCrop; }

/* ── Event types ─────────────────────────────────────────── */
export type EventCondition = "warning" | "critical" | "recovery" | "sensor_fault";
export interface SensorEvent {
  id: string;
  deviceId: string;
  sensorId: string;
  sensorType: string;
  sensorName: string;
  condition: EventCondition;
  severity: Severity;
  title: string;
  message: string;
  value: number;
  unit: string;
  thresholdMin?: number;
  thresholdMax?: number;
  triggeredAt: string;
  confirmedAt?: string;
  recoveredAt?: string;
  acknowledgedAt?: string;
  durationMinutes: number;
  impact: ImpactAnalysis;
  recommendations: string[];
  telemetryWindow: { timestamp: string; value: number }[];
  deviceName: string;
  farmId: string;
  zoneId: string;
}

export interface ImpactAnalysis {
  riskLevel: "low" | "moderate" | "high" | "severe";
  category: string;
  description: string;
  factors: string[];
  cropEffect: string;
}

/* ── Data validation ─────────────────────────────────────── */
interface DataQuality {
  isValid: boolean;
  issue?: string;
}
const sensorRanges: Record<string, [number, number]> = {
  temperature: [-40, 80],
  humidity: [0, 100],
  soil_moisture: [0, 100],
  soil_temperature: [-20, 70],
  light: [0, 200000],
  rainfall: [0, 500],
  wind_speed: [0, 300],
  battery: [0, 100],
  pressure: [800, 1200],
  wind_direction: [0, 360],
  signal: [0, 100],
};

function validateReading(type: string, value: number, quality: string): DataQuality {
  if (quality === "missing") return { isValid: false, issue: "No data received from sensor" };
  const range = sensorRanges[type];
  if (range && (value < range[0] || value > range[1]))
    return { isValid: false, issue: `Value ${value} outside physical range (${range[0]}–${range[1]})` };
  if (quality === "suspect") return { isValid: false, issue: "Sensor reading flagged as suspect" };
  return { isValid: true };
}

/* ── Impact analysis ─────────────────────────────────────── */
function analyzeImpact(
  sensorType: string,
  value: number,
  th: SensorThreshold,
  durationMinutes: number,
  condition: EventCondition,
): ImpactAnalysis {
  const dur = durationMinutes;
  const base: ImpactAnalysis = { riskLevel: "low", category: "", description: "", factors: [], cropEffect: "" };

  if (condition === "recovery")
    return { ...base, riskLevel: "low", category: "Recovery", description: "Conditions have returned to acceptable range.", factors: ["Parameter back within threshold"], cropEffect: "Normal growth should resume if exposure was brief." };
  if (condition === "sensor_fault")
    return { ...base, riskLevel: "moderate", category: "Data integrity", description: "Sensor data is unreliable — no crop assessment can be made from this reading.", factors: ["Invalid or missing sensor data", "Check sensor calibration and wiring"], cropEffect: "Unknown — valid data required for assessment." };

  switch (sensorType) {
    case "soil_moisture": {
      const low = th.min !== undefined && value < th.min;
      if (low) {
        const risk: ImpactAnalysis["riskLevel"] = value < 10 ? "severe" : value < 15 ? "high" : dur > 120 ? "high" : "moderate";
        return {
          riskLevel: risk,
          category: "Water stress",
          description: `Soil moisture at ${value}${th.unit} is ${th.min !== undefined ? `below the ${th.min}${th.unit} threshold` : "low"}. Low soil moisture limits water uptake and nutrient transport through the root zone. The actual water availability depends on soil type, sensor calibration, and the specific crop's root depth — a 10% volumetric reading in sandy soil differs significantly from 10% in clay.`,
          factors: [
            "Reduced water availability in root zone",
            dur > 60 ? "Prolonged exposure increases wilting risk" : "Short duration — may be transient",
            "Nutrient uptake may be impaired if soil solution is insufficient",
            "Soil type and sensor calibration affect interpretation",
          ],
          cropEffect: risk === "severe"
            ? "High risk of permanent wilting and yield loss if not addressed."
            : risk === "high"
            ? "Crop likely under significant water stress — growth impairment probable."
            : "Mild stress possible; monitor closely.",
        };
      }
      return {
        riskLevel: dur > 120 ? "high" : "moderate",
        category: "Waterlogging risk",
        description: `Soil moisture at ${value}${th.unit} exceeds the ${th.max}${th.unit} upper limit. Saturated soils restrict oxygen to roots.`,
        factors: ["Root oxygen deprivation risk", "Increased susceptibility to root rot", "May indicate drainage issues or over-irrigation"],
        cropEffect: dur > 180 ? "Root damage likely if waterlogging persists." : "Monitor drainage; short saturation may be tolerable.",
      };
    }
    case "temperature": {
      const high = th.max !== undefined && value > th.max;
      if (high) {
        const risk: ImpactAnalysis["riskLevel"] = value > 42 ? "severe" : value > 38 ? "high" : "moderate";
        return {
          riskLevel: risk,
          category: "Heat stress",
          description: `Air temperature at ${value}${th.unit} exceeds the ${th.max}${th.unit} upper threshold.`,
          factors: [
            "Increased evapotranspiration and water demand",
            "Reduced photosynthetic efficiency above ~35°C",
            dur > 240 ? "Sustained exposure risks pollen sterility and fruit drop" : "Brief exposure may not cause permanent damage",
            "Leaf temperature may be higher than air temperature under direct sun",
          ],
          cropEffect: risk === "severe" ? "Severe thermal damage likely — cell death and tissue necrosis possible." : "Heat stress may reduce yield and quality. Ensure adequate irrigation.",
        };
      }
      return {
        riskLevel: value < 5 ? "high" : "moderate",
        category: "Cold stress",
        description: `Air temperature at ${value}${th.unit} is below the ${th.min}${th.unit} minimum.`,
        factors: ["Slowed metabolic processes", value < 5 ? "Frost risk — ice crystal formation can rupture cells" : "Chilling injury possible for tropical species", "Growth rate reduction"],
        cropEffect: value < 0 ? "Frost damage highly likely for unprotected crops." : "Growth slowdown expected; cold-sensitive varieties at risk.",
      };
    }
    case "humidity": {
      const high = th.max !== undefined && value > th.max;
      if (high)
        return {
          riskLevel: dur > 360 ? "high" : "moderate",
          category: "Excess humidity",
          description: `Air humidity at ${value}${th.unit} exceeds ${th.max}${th.unit}. Persistent high humidity promotes fungal diseases.`,
          factors: ["Increased disease pressure (powdery mildew, botrytis)", "Reduced transpiration", "Condensation risk on leaf surfaces"],
          cropEffect: "Fungal infection risk rises significantly with prolonged high humidity.",
        };
      return {
        riskLevel: "moderate",
        category: "Low humidity",
        description: `Air humidity at ${value}${th.unit} is below ${th.min}${th.unit}. Dry air accelerates transpiration.`,
        factors: ["Increased transpiration rate", "Possible leaf margin burn", "Higher irrigation demand"],
        cropEffect: "Plants may wilt faster under low humidity, especially in combination with high temperature.",
      };
    }
    case "light": {
      return {
        riskLevel: dur > 240 ? "high" : "moderate",
        category: "Insufficient light",
        description: `Light intensity at ${value} ${th.unit} is below the ${th.min} ${th.unit} minimum requirement. Note: this sensor measures illuminance (lux), not photosynthetically active radiation (PAR/µmol·m⁻²·s⁻¹). The photosynthetic impact depends on spectral quality as well as intensity.`,
        factors: [
          "Reduced photosynthetic rate",
          dur > 120 ? "Extended low-light period may delay flowering and fruiting" : "Short cloud cover is typically tolerable",
          "Shade from structures or neighboring vegetation may be a factor",
          "Lux ≠ PAR — spectral composition matters for photosynthesis",
        ],
        cropEffect: dur > 480 ? "Prolonged light deficiency will impair growth and reduce yield." : "Monitor light patterns; supplemental lighting may help in protected cultivation.",
      };
    }
    case "rainfall":
      return {
        riskLevel: value > 80 ? "severe" : value > 50 ? "high" : "moderate",
        category: "Heavy rainfall",
        description: `Rainfall at ${value} ${th.unit} exceeds the ${th.max} ${th.unit} threshold.`,
        factors: ["Soil erosion and runoff risk", "Potential waterlogging", value > 60 ? "Physical damage to plants and fruit" : "Moderate — check drainage"],
        cropEffect: value > 80 ? "Severe flooding risk — crop damage likely." : "Ensure drainage is adequate; inspect for standing water.",
      };
    case "wind_speed":
      return {
        riskLevel: value > 60 ? "severe" : value > 40 ? "high" : "moderate",
        category: "High wind",
        description: `Wind speed at ${value} ${th.unit} exceeds the ${th.max} ${th.unit} safety threshold.`,
        factors: ["Physical damage to stems and leaves", value > 50 ? "Risk of uprooting or lodging" : "Increased transpiration", "Protective structures may be needed"],
        cropEffect: value > 60 ? "Structural crop damage highly probable." : "Inspect for broken stems and windburn; consider windbreaks.",
      };
    case "battery":
      return {
        riskLevel: value < 3.3 ? "high" : "moderate",
        category: "Low power",
        description: `Battery at ${value} ${th.unit} is below the ${th.min} ${th.unit} minimum.`,
        factors: ["Device may lose telemetry capability", value < 3.3 ? "Imminent shutdown risk" : "Reduced transmission reliability", "Replace or recharge battery"],
        cropEffect: "No direct crop impact, but loss of monitoring creates a data gap that prevents condition assessment.",
      };
    case "soil_temperature": {
      const low = th.min !== undefined && value < th.min;
      if (low)
        return {
          riskLevel: value < 5 ? "high" : "moderate",
          category: "Cold soil",
          description: `Soil temperature at ${value}${th.unit} is below ${th.min}${th.unit}.`,
          factors: ["Reduced root metabolic activity", "Slower nutrient uptake", "Germination may stall"],
          cropEffect: "Root growth slows significantly below 15°C for most tropical crops.",
        };
      return {
        riskLevel: "moderate",
        category: "Hot soil",
        description: `Soil temperature at ${value}${th.unit} exceeds ${th.max}${th.unit}.`,
        factors: ["Root stress and possible die-back", "Increased soil respiration", "Mulching may help regulate"],
        cropEffect: "High soil temperatures can damage shallow roots and reduce water uptake.",
      };
    }
    default:
      return { ...base, riskLevel: "moderate", category: "Threshold exceeded", description: `${sensorType} reading at ${value} is outside the configured range.`, factors: ["Parameter outside expected bounds"], cropEffect: "Impact assessment unavailable for this sensor type." };
  }
}

function recommendations(sensorType: string, value: number, th: SensorThreshold, condition: EventCondition): string[] {
  if (condition === "recovery") return ["Continue routine monitoring.", "Review event duration to assess residual impact."];
  if (condition === "sensor_fault") return ["Check sensor wiring and connections.", "Verify sensor calibration.", "Review recent maintenance records.", "Consider replacing the sensor if faults persist."];

  switch (sensorType) {
    case "soil_moisture": {
      const low = th.min !== undefined && value < th.min;
      if (low) return [
        "Check irrigation system operation and scheduling.",
        "Inspect soil conditions at the sensor location — compaction or mulch coverage may differ from the broader field.",
        "Verify sensor calibration against a gravimetric sample if available.",
        "Consider supplemental irrigation if multiple sensors confirm low moisture.",
        "Review recent rainfall and evapotranspiration data.",
      ];
      return ["Check drainage infrastructure.", "Reduce irrigation frequency or volume.", "Inspect for standing water in the root zone.", "Consider raised beds if waterlogging is chronic."];
    }
    case "temperature": {
      const high = th.max !== undefined && value > th.max;
      if (high) return [
        "Check soil moisture — high temperatures increase water demand.",
        "Consider shade cloth or ventilation in protected cultivation.",
        "Adjust irrigation schedule to compensate for evapotranspiration.",
        "Avoid foliar applications during peak heat.",
      ];
      return ["Monitor forecast for frost risk.", "Prepare frost protection (row covers, mulch, irrigation).", "Delay transplanting of cold-sensitive varieties."];
    }
    case "humidity": {
      const high = th.max !== undefined && value > th.max;
      if (high) return ["Increase ventilation in enclosed growing areas.", "Reduce irrigation frequency to lower ambient moisture.", "Apply preventive fungicide if disease pressure is high.", "Inspect canopy density — pruning improves airflow."];
      return ["Increase irrigation frequency.", "Use misting systems if available.", "Group moisture-sensitive crops in sheltered areas."];
    }
    case "light":
      return ["Assess shading sources — structures, trees, or weather.", "Review weather forecast for extended cloud cover.", "Consider supplemental lighting for high-value crops in protected cultivation.", "Ensure sensor is unobstructed and clean."];
    case "rainfall":
      return ["Inspect drainage channels and outlets.", "Check for standing water in crop beds.", "Delay any planned fertilizer application to reduce runoff.", "Assess soil erosion risk on slopes."];
    case "wind_speed":
      return ["Secure loose structures and coverings.", "Inspect plants for stem and leaf damage after the event.", "Consider installing or reinforcing windbreaks.", "Postpone spraying operations."];
    case "battery":
      return ["Schedule battery replacement or recharge.", "Check solar panel output if solar-powered.", "Verify charging circuit connections.", "Prioritize this device to avoid data gaps."];
    case "soil_temperature": {
      const low = th.min !== undefined && value < th.min;
      if (low) return ["Apply mulch to insulate soil surface.", "Delay direct seeding until soil warms.", "Consider using black plastic mulch to raise soil temperature."];
      return ["Apply reflective mulch.", "Increase irrigation to cool soil surface.", "Provide shade if possible."];
    }
    default:
      return ["Review sensor configuration and thresholds.", "Cross-check with nearby sensors."];
  }
}

/* ── Stale data / connectivity detection ─────────────────── */
export interface DataIntegrityIssue {
  deviceId: string;
  deviceName: string;
  type: "stale_data" | "unresponsive" | "anomalous" | "connectivity_loss";
  severity: Severity;
  message: string;
  detail: string;
  detectedAt: string;
}

function detectDataIssues(devices: Device[], sensors: Sensor[]): DataIntegrityIssue[] {
  const now = Date.parse(DEMO_NOW);
  const issues: DataIntegrityIssue[] = [];
  for (const d of devices) {
    const age = (now - Date.parse(d.lastSeen)) / 60000;
    if (d.status === "offline")
      issues.push({ deviceId: d.id, deviceName: d.name, type: "connectivity_loss", severity: "critical", message: `${d.name} — connection lost`, detail: `Last seen ${Math.round(age)} minutes ago. No telemetry since disconnect.`, detectedAt: d.lastSeen });
    else if (age > d.intervalSeconds / 60 * 5)
      issues.push({ deviceId: d.id, deviceName: d.name, type: "stale_data", severity: "warning", message: `${d.name} — data stale`, detail: `Expected every ${d.intervalSeconds}s but last data was ${Math.round(age)} minutes ago.`, detectedAt: d.lastSeen });
    const devSensors = sensors.filter(s => s.deviceId === d.id);
    for (const s of devSensors) {
      const v = validateReading(s.type, s.value, s.quality);
      if (!v.isValid)
        issues.push({ deviceId: d.id, deviceName: d.name, type: s.quality === "missing" ? "unresponsive" : "anomalous", severity: s.quality === "missing" ? "warning" : "information", message: `${s.name} on ${d.name} — ${v.issue}`, detail: v.issue!, detectedAt: s.timestamp || d.lastSeen });
    }
  }
  return issues;
}

/* ── Event detection engine ──────────────────────────────── */
export function detectEvents(devices: Device[], sensors: Sensor[], telemetry: Telemetry[]): SensorEvent[] {
  const now = Date.parse(DEMO_NOW);
  const events: SensorEvent[] = [];
  let eid = 1;

  for (const sensor of sensors) {
    const th = getThreshold(sensor.type);
    if (!th) continue;
    const device = devices.find(d => d.id === sensor.deviceId);
    if (!device) continue;
    const vq = validateReading(sensor.type, sensor.value, sensor.quality);

    if (!vq.isValid) {
      events.push(makeSensorFaultEvent(eid++, sensor, device, th, telemetry, now, vq.issue!));
      continue;
    }

    const history = telemetry
      .filter(t => t.sensorId === sensor.id && t.quality === "valid")
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

    // check low threshold
    if (th.min !== undefined && sensor.value < th.min) {
      const breachStart = findBreachStart(history, v => v < th.min!, now);
      const duration = Math.round((now - breachStart) / 60000);
      if (duration >= th.confirmMinutes) {
        const isCritical = duration > th.confirmMinutes * 3 || (th.min !== undefined && sensor.value < th.min - (th.max !== undefined ? (th.max - th.min) * 0.3 : 5));
        const severity: Severity = isCritical ? "critical" : th.priority;
        const cond: EventCondition = isCritical ? "critical" : "warning";
        const titleMap: Record<string, string> = {
          soil_moisture: "Low Soil Moisture",
          temperature: "Low Temperature",
          humidity: "Low Humidity",
          light: "Insufficient Light Intensity",
          battery: "Low Battery",
          soil_temperature: "Low Soil Temperature",
        };
        const title = titleMap[sensor.type] || `Low ${sensor.name}`;
        const impact = analyzeImpact(sensor.type, sensor.value, th, duration, cond);
        const recs = recommendations(sensor.type, sensor.value, th, cond);
        const window = extractWindow(history, breachStart, now);
        events.push({
          id: `EVT-${String(eid++).padStart(4, "0")}`,
          deviceId: device.id, sensorId: sensor.id, sensorType: sensor.type, sensorName: sensor.name,
          condition: cond, severity, title, value: sensor.value, unit: th.unit,
          thresholdMin: th.min, thresholdMax: th.max,
          message: `${sensor.name} on ${device.name}: ${sensor.value} ${th.unit} (threshold: ${th.min} ${th.unit})`,
          triggeredAt: new Date(breachStart).toISOString(),
          confirmedAt: new Date(breachStart + th.confirmMinutes * 60000).toISOString(),
          durationMinutes: duration,
          impact, recommendations: recs, telemetryWindow: window,
          deviceName: device.name, farmId: device.farmId, zoneId: device.zoneId,
        });
      }
    }

    // check high threshold
    if (th.max !== undefined && sensor.value > th.max) {
      const breachStart = findBreachStart(history, v => v > th.max!, now);
      const duration = Math.round((now - breachStart) / 60000);
      if (duration >= th.confirmMinutes) {
        const isCritical = duration > th.confirmMinutes * 3 || (th.max !== undefined && sensor.value > th.max + (th.min !== undefined ? (th.max - th.min) * 0.3 : 5));
        const severity: Severity = isCritical ? "critical" : th.priority;
        const cond: EventCondition = isCritical ? "critical" : "warning";
        const titleMap: Record<string, string> = {
          soil_moisture: "High Soil Moisture",
          temperature: "High Temperature",
          humidity: "High Humidity",
          rainfall: "Heavy Rainfall",
          wind_speed: "High Wind Speed",
          soil_temperature: "High Soil Temperature",
        };
        const title = titleMap[sensor.type] || `High ${sensor.name}`;
        const impact = analyzeImpact(sensor.type, sensor.value, th, duration, cond);
        const recs = recommendations(sensor.type, sensor.value, th, cond);
        const window = extractWindow(history, breachStart, now);
        events.push({
          id: `EVT-${String(eid++).padStart(4, "0")}`,
          deviceId: device.id, sensorId: sensor.id, sensorType: sensor.type, sensorName: sensor.name,
          condition: cond, severity, title, value: sensor.value, unit: th.unit,
          thresholdMin: th.min, thresholdMax: th.max,
          message: `${sensor.name} on ${device.name}: ${sensor.value} ${th.unit} (threshold: ${th.max} ${th.unit})`,
          triggeredAt: new Date(breachStart).toISOString(),
          confirmedAt: new Date(breachStart + th.confirmMinutes * 60000).toISOString(),
          durationMinutes: duration,
          impact, recommendations: recs, telemetryWindow: window,
          deviceName: device.name, farmId: device.farmId, zoneId: device.zoneId,
        });
      }
    }

    // recovery check: value back inside thresholds after recent breach in history
    if ((th.min === undefined || sensor.value >= th.min + th.hysteresis) &&
        (th.max === undefined || sensor.value <= th.max - th.hysteresis)) {
      const recentBreach = history.slice(-48).find(t =>
        (th.min !== undefined && t.value < th.min) || (th.max !== undefined && t.value > th.max)
      );
      if (recentBreach) {
        const recoverTs = history.slice(-24).find(t =>
          (th.min === undefined || t.value >= th.min + th.hysteresis) &&
          (th.max === undefined || t.value <= th.max - th.hysteresis)
        );
        if (recoverTs) {
          const dur = Math.round((Date.parse(recoverTs.timestamp) - Date.parse(recentBreach.timestamp)) / 60000);
          const impact = analyzeImpact(sensor.type, sensor.value, th, dur, "recovery");
          events.push({
            id: `EVT-${String(eid++).padStart(4, "0")}`,
            deviceId: device.id, sensorId: sensor.id, sensorType: sensor.type, sensorName: sensor.name,
            condition: "recovery", severity: "information", title: `${sensor.name} — Recovered`,
            value: sensor.value, unit: th.unit, thresholdMin: th.min, thresholdMax: th.max,
            message: `${sensor.name} on ${device.name} returned to normal range (${sensor.value} ${th.unit})`,
            triggeredAt: recentBreach.timestamp,
            confirmedAt: recentBreach.timestamp,
            recoveredAt: recoverTs.timestamp,
            durationMinutes: dur,
            impact, recommendations: recommendations(sensor.type, sensor.value, th, "recovery"),
            telemetryWindow: extractWindow(history, Date.parse(recentBreach.timestamp), Date.parse(recoverTs.timestamp) + 3600000),
            deviceName: device.name, farmId: device.farmId, zoneId: device.zoneId,
          });
        }
      }
    }
  }

  // Compound event detection
  const deviceGroups = new Map<string, SensorEvent[]>();
  for (const e of events) {
    if (e.condition === "recovery" || e.condition === "sensor_fault") continue;
    const arr = deviceGroups.get(e.deviceId) || [];
    arr.push(e);
    deviceGroups.set(e.deviceId, arr);
  }
  for (const [deviceId, devEvents] of deviceGroups) {
    if (devEvents.length >= 2) {
      const device = devices.find(d => d.id === deviceId)!;
      const types = devEvents.map(e => e.title).join(" + ");
      const worstSeverity: Severity = devEvents.some(e => e.severity === "critical") ? "critical" : "warning";
      const maxDur = Math.max(...devEvents.map(e => e.durationMinutes));
      events.push({
        id: `EVT-${String(eid++).padStart(4, "0")}`,
        deviceId, sensorId: devEvents[0].sensorId, sensorType: "compound", sensorName: "Multiple sensors",
        condition: "critical", severity: worstSeverity,
        title: `Compound alert: ${types}`,
        value: 0, unit: "",
        message: `Multiple thresholds exceeded on ${device.name}: ${types}. Combined risk assessment is elevated.`,
        triggeredAt: devEvents.sort((a, b) => Date.parse(a.triggeredAt) - Date.parse(b.triggeredAt))[0].triggeredAt,
        durationMinutes: maxDur,
        impact: {
          riskLevel: "severe",
          category: "Multiple stress factors",
          description: `${devEvents.length} parameters are simultaneously outside thresholds on ${device.name}. Combined stressors interact and amplify damage risk beyond what each individual factor would cause.`,
          factors: devEvents.map(e => `${e.title}: ${e.impact.category}`),
          cropEffect: "Compounded stress significantly increases risk of yield loss and crop damage. Immediate field inspection recommended.",
        },
        recommendations: [
          "Perform immediate field inspection at this device location.",
          "Prioritize the most critical parameter first.",
          ...devEvents.flatMap(e => e.recommendations.slice(0, 1)),
        ],
        telemetryWindow: devEvents[0].telemetryWindow,
        deviceName: device.name, farmId: device.farmId, zoneId: device.zoneId,
      });
    }
  }

  events.sort((a, b) => {
    const sev = { critical: 0, warning: 1, information: 2 };
    return (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3) || Date.parse(b.triggeredAt) - Date.parse(a.triggeredAt);
  });

  return events;
}

function makeSensorFaultEvent(eid: number, sensor: Sensor, device: Device, th: SensorThreshold, telemetry: Telemetry[], now: number, issue: string): SensorEvent {
  const history = telemetry.filter(t => t.sensorId === sensor.id).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const impact = analyzeImpact(sensor.type, sensor.value, th, 0, "sensor_fault");
  const detectedAt = sensor.timestamp || device.lastSeen;
  return {
    id: `EVT-${String(eid).padStart(4, "0")}`,
    deviceId: device.id, sensorId: sensor.id, sensorType: sensor.type, sensorName: sensor.name,
    condition: "sensor_fault", severity: "warning",
    title: `${sensor.name} — Sensor Fault`,
    value: sensor.value, unit: th.unit,
    thresholdMin: th.min, thresholdMax: th.max,
    message: `${sensor.name} on ${device.name}: ${issue}`,
    triggeredAt: detectedAt,
    durationMinutes: Math.round((now - Date.parse(detectedAt)) / 60000),
    impact,
    recommendations: recommendations(sensor.type, sensor.value, th, "sensor_fault"),
    telemetryWindow: history.slice(-24).map(t => ({ timestamp: t.timestamp, value: t.value })),
    deviceName: device.name, farmId: device.farmId, zoneId: device.zoneId,
  };
}

function findBreachStart(history: Telemetry[], breachFn: (v: number) => boolean, now: number): number {
  let start = now - 2 * 3600000; // default 2h ago
  for (let i = history.length - 1; i >= 0; i--) {
    if (breachFn(history[i].value)) {
      start = Date.parse(history[i].timestamp);
    } else break;
  }
  return start;
}

function extractWindow(history: { timestamp: string; value: number }[], from: number, to: number): { timestamp: string; value: number }[] {
  const padded = from - 3600000;
  const end = to + 3600000;
  return history
    .filter(t => { const ts = Date.parse(t.timestamp); return ts >= padded && ts <= end; })
    .map(t => ({ timestamp: t.timestamp, value: t.value }));
}

/* ── Summary stats ───────────────────────────────────────── */
export interface EventSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  recovery: number;
  sensorFaults: number;
  compoundAlerts: number;
  dataIssues: DataIntegrityIssue[];
}

export function summarizeEvents(events: SensorEvent[], devices: Device[], sensors: Sensor[]): EventSummary {
  return {
    total: events.length,
    critical: events.filter(e => e.severity === "critical").length,
    warning: events.filter(e => e.severity === "warning").length,
    info: events.filter(e => e.severity === "information").length,
    recovery: events.filter(e => e.condition === "recovery").length,
    sensorFaults: events.filter(e => e.condition === "sensor_fault").length,
    compoundAlerts: events.filter(e => e.sensorType === "compound").length,
    dataIssues: detectDataIssues(devices, sensors),
  };
}

export { detectDataIssues };

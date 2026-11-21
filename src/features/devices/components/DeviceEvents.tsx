import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Activity, Info, ChevronDown, ChevronRight,
  Shield, Zap, Droplets, Thermometer, Wind, Sun, Battery,
  CheckCircle, XCircle, Clock, Download, Filter, Search,
  Maximize2, Minimize2, Eye, EyeOff, TrendingDown, TrendingUp,
  RefreshCw, Layers,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from "recharts";
import type { Device, Sensor, Telemetry } from "../../../shared/types/domain";
import type { SensorEvent, EventSummary, DataIntegrityIssue, ImpactAnalysis } from "../lib/eventEngine";
import { detectEvents, summarizeEvents, getThreshold, getCropProfile } from "../lib/eventEngine";
import { DEMO_NOW, formatTime, initialSensors, initialTelemetry, csv, downloadFile, farmName, zoneName } from "../../../store/liveData";

const severityIcon = { critical: AlertTriangle, warning: Activity, information: Info };
const severityColor: Record<string, string> = { critical: "#ef4444", warning: "#f59e0b", information: "#3b82f6" };
const conditionLabel: Record<string, string> = { warning: "Warning", critical: "Critical", recovery: "Recovery", sensor_fault: "Sensor Fault" };
const riskColor: Record<string, string> = { low: "#10b981", moderate: "#f59e0b", high: "#ef4444", severe: "#dc2626" };

const sensorIcon: Record<string, typeof Thermometer> = {
  temperature: Thermometer, humidity: Droplets, soil_moisture: Droplets,
  soil_temperature: Thermometer, light: Sun, rainfall: Droplets,
  wind_speed: Wind, battery: Battery, compound: Layers,
};

const fmtDuration = (m: number) => {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
};

const timeShort = (iso: string) => formatTime(iso).replace(/, \d{4}/, "");

/* ── Threshold config viewer ──────────────────────────── */
function ThresholdConfig() {
  const [open, setOpen] = useState(false);
  const crop = getCropProfile();
  const entries = Object.entries(crop.thresholds);
  return (
    <div className="evt-config">
      <button className="evt-config-toggle" onClick={() => setOpen(!open)}>
        <Shield size={14} /> Threshold Configuration
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className="evt-config-body">
          <p className="evt-config-crop"><strong>Crop profile:</strong> {crop.name} — {crop.growthStage} stage</p>
          <div className="table-scroll">
            <table className="evt-th-table">
              <thead>
                <tr>
                  <th>Sensor</th><th>Unit</th><th>Min</th><th>Max</th>
                  <th>Ideal range</th><th>Confirm</th><th>Cooldown</th>
                  <th>Hysteresis</th><th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([type, th]) => (
                  <tr key={type}>
                    <td><b>{type.replace(/_/g, " ")}</b></td>
                    <td>{th.unit}</td>
                    <td>{th.min ?? "—"}</td><td>{th.max ?? "—"}</td>
                    <td>{th.idealMin != null || th.idealMax != null ? `${th.idealMin ?? "—"}–${th.idealMax ?? "—"}` : "—"}</td>
                    <td>{th.confirmMinutes}m</td><td>{th.cooldownMinutes}m</td>
                    <td>±{th.hysteresis}</td>
                    <td><span className={`badge ${th.priority === "critical" ? "danger" : th.priority === "warning" ? "warning" : "info"}`}>{th.priority}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Mini sparkline chart ─────────────────────────────── */
function EventChart({ event }: { event: SensorEvent }) {
  if (!event.telemetryWindow.length || event.sensorType === "compound") return null;
  const th = getThreshold(event.sensorType);
  const data = event.telemetryWindow.map(p => ({
    t: new Date(p.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }),
    v: p.value,
  }));
  return (
    <div className="evt-chart">
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`eg-${event.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={severityColor[event.severity]} stopOpacity={0.2} />
              <stop offset="95%" stopColor={severityColor[event.severity]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke="var(--text-muted)" interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} stroke="var(--text-muted)" width={40} domain={["auto", "auto"]} />
          <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
          {th?.min != null && <ReferenceLine y={th.min} stroke="#10b981" strokeDasharray="4 4" label={{ value: `Min ${th.min}`, fontSize: 10, fill: "#10b981" }} />}
          {th?.max != null && <ReferenceLine y={th.max} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `Max ${th.max}`, fontSize: 10, fill: "#ef4444" }} />}
          <Area type="monotone" dataKey="v" stroke={severityColor[event.severity]} fill={`url(#eg-${event.id})`} strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Impact badge ─────────────────────────────────────── */
function RiskBadge({ level }: { level: ImpactAnalysis["riskLevel"] }) {
  return <span className="evt-risk" style={{ background: riskColor[level] + "18", color: riskColor[level], borderColor: riskColor[level] + "40" }}>{level}</span>;
}

/* ── Single event detail modal ─────────────────────────── */
function EventDetail({ event, onClose }: { event: SensorEvent; onClose: () => void }) {
  const SIcon = sensorIcon[event.sensorType] || Activity;
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", h);
    return () => removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="evt-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="evt-detail">
      <div className="evt-detail-head">
        <SIcon size={18} style={{ color: severityColor[event.severity] }} />
        <div>
          <h3>{event.title}</h3>
          <small>{event.deviceName} · {event.sensorId}</small>
        </div>
        <button className="evt-close" onClick={onClose}><XCircle size={18} /></button>
      </div>

      <div className="evt-detail-grid">
        <div className="evt-detail-field"><label>Condition</label><span className={`badge ${event.severity === "critical" ? "danger" : event.severity === "warning" ? "warning" : "info"}`}>{conditionLabel[event.condition]}</span></div>
        <div className="evt-detail-field"><label>Severity</label><span className={`badge ${event.severity === "critical" ? "danger" : event.severity === "warning" ? "warning" : "info"}`}>{event.severity}</span></div>
        <div className="evt-detail-field"><label>Current value</label><span>{event.sensorType === "compound" ? "Multiple" : `${event.value} ${event.unit}`}</span></div>
        <div className="evt-detail-field"><label>Threshold</label><span>{event.thresholdMin != null && event.thresholdMax != null ? `${event.thresholdMin}–${event.thresholdMax} ${event.unit}` : event.thresholdMin != null ? `≥ ${event.thresholdMin} ${event.unit}` : event.thresholdMax != null ? `≤ ${event.thresholdMax} ${event.unit}` : "—"}</span></div>
        <div className="evt-detail-field"><label>Triggered</label><span>{timeShort(event.triggeredAt)}</span></div>
        <div className="evt-detail-field"><label>Duration</label><span>{fmtDuration(event.durationMinutes)}</span></div>
        {event.confirmedAt && <div className="evt-detail-field"><label>Confirmed</label><span>{timeShort(event.confirmedAt)}</span></div>}
        {event.recoveredAt && <div className="evt-detail-field"><label>Recovered</label><span>{timeShort(event.recoveredAt)}</span></div>}
        <div className="evt-detail-field"><label>Location</label><span>{farmName(event.farmId)} · {zoneName(event.zoneId)}</span></div>
      </div>

      <EventChart event={event} />

      <div className="evt-impact">
        <h4><Zap size={14} /> Impact Analysis <RiskBadge level={event.impact.riskLevel} /></h4>
        <p className="evt-impact-cat"><strong>{event.impact.category}</strong></p>
        <p>{event.impact.description}</p>
        <ul>{event.impact.factors.map((f, i) => <li key={i}>{f}</li>)}</ul>
        <p className="evt-impact-crop"><strong>Crop effect:</strong> {event.impact.cropEffect}</p>
      </div>

      <div className="evt-recs">
        <h4><CheckCircle size={14} /> Recommended Actions</h4>
        <ol>{event.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ol>
      </div>
    </div>
    </div>
  );
}

/* ── Event row ────────────────────────────────────────── */
function EventRow({ event, selected, onSelect }: { event: SensorEvent; selected: boolean; onSelect: () => void }) {
  const SIcon = severityIcon[event.severity] || Info;
  const TIcon = event.condition === "recovery" ? CheckCircle : event.condition === "sensor_fault" ? XCircle : sensorIcon[event.sensorType] || Activity;
  return (
    <tr className={`evt-row ${selected ? "evt-row-sel" : ""} evt-row-${event.severity}`} onClick={onSelect}>
      <td><SIcon size={16} style={{ color: severityColor[event.severity] }} /></td>
      <td>
        <div className="evt-row-title"><TIcon size={14} /> {event.title}</div>
        <small>{event.message}</small>
      </td>
      <td><span className={`badge ${event.severity === "critical" ? "danger" : event.severity === "warning" ? "warning" : "info"}`}>{conditionLabel[event.condition]}</span></td>
      <td className="number">{event.sensorType === "compound" ? "—" : `${event.value} ${event.unit}`}</td>
      <td>{fmtDuration(event.durationMinutes)}</td>
      <td><RiskBadge level={event.impact.riskLevel} /></td>
      <td>{timeShort(event.triggeredAt)}</td>
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════
   Device Events Tab — for the device detail page
   ═══════════════════════════════════════════════════════ */
export function DeviceEventsTab({ device, sensors, notify }: {
  device: Device;
  sensors: Sensor[];
  notify: (text: string, kind?: "error" | "success") => void;
}) {
  const telemetry = useMemo(() => initialTelemetry.filter(t => t.deviceId === device.id), [device.id]);
  const events = useMemo(() => detectEvents([device], sensors, telemetry), [device, sensors, telemetry]);
  const summary = useMemo(() => summarizeEvents(events, [device], sensors), [events, device, sensors]);
  const [selected, setSelected] = useState<string | null>(null);
  const [condFilter, setCondFilter] = useState("all");
  const [sevFilter, setSevFilter] = useState("all");

  const filtered = events.filter(e =>
    (condFilter === "all" || e.condition === condFilter) &&
    (sevFilter === "all" || e.severity === sevFilter)
  );

  const sel = events.find(e => e.id === selected);

  const exportCsv = () => {
    const rows = events.map(e => [e.id, e.title, e.severity, e.condition, e.value, e.unit, e.triggeredAt, e.durationMinutes, e.impact.riskLevel, e.impact.category, e.deviceName, e.sensorId]);
    downloadFile(`${device.id}-events.csv`, csv([["ID", "Title", "Severity", "Condition", "Value", "Unit", "Triggered", "Duration (min)", "Risk", "Category", "Device", "Sensor"], ...rows]), "text/csv");
    notify("Events CSV downloaded.");
  };

  return (
    <div className="evt-panel">
      <div className="evt-summary-row">
        <div className="evt-summary-card evt-sc-critical"><AlertTriangle size={18} /><div><span className="evt-sc-num">{summary.critical}</span><span className="evt-sc-label">Critical</span></div></div>
        <div className="evt-summary-card evt-sc-warning"><Activity size={18} /><div><span className="evt-sc-num">{summary.warning}</span><span className="evt-sc-label">Warning</span></div></div>
        <div className="evt-summary-card evt-sc-info"><Info size={18} /><div><span className="evt-sc-num">{summary.info}</span><span className="evt-sc-label">Info</span></div></div>
        <div className="evt-summary-card evt-sc-recovery"><CheckCircle size={18} /><div><span className="evt-sc-num">{summary.recovery}</span><span className="evt-sc-label">Recovery</span></div></div>
        {summary.sensorFaults > 0 && <div className="evt-summary-card evt-sc-fault"><XCircle size={18} /><div><span className="evt-sc-num">{summary.sensorFaults}</span><span className="evt-sc-label">Faults</span></div></div>}
      </div>

      {summary.dataIssues.length > 0 && (
        <div className="evt-data-issues">
          <h4><Shield size={14} /> Data Integrity Issues</h4>
          {summary.dataIssues.map((di, i) => (
            <div key={i} className={`evt-di-row evt-di-${di.severity}`}>
              <span className={`badge ${di.severity === "critical" ? "danger" : "warning"}`}>{di.type.replace(/_/g, " ")}</span>
              <span>{di.message}</span>
              <small>{di.detail}</small>
            </div>
          ))}
        </div>
      )}

      <ThresholdConfig />

      <div className="evt-toolbar">
        <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} aria-label="Severity filter">
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="information">Info</option>
        </select>
        <select value={condFilter} onChange={e => setCondFilter(e.target.value)} aria-label="Condition filter">
          <option value="all">All conditions</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
          <option value="recovery">Recovery</option>
          <option value="sensor_fault">Sensor fault</option>
        </select>
        <button className="evt-export" onClick={exportCsv}><Download size={14} /> CSV</button>
      </div>

      {filtered.length ? (
        <div className="table-scroll">
          <table className="evt-table">
            <thead>
              <tr>
                <th></th><th>Event</th><th>Condition</th><th>Value</th><th>Duration</th><th>Risk</th><th>Triggered</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => <EventRow key={e.id} event={e} selected={selected === e.id} onSelect={() => setSelected(selected === e.id ? null : e.id)} />)}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="evt-empty">
          <CheckCircle size={32} />
          <p>No events detected for current filters.</p>
          <small>All sensor readings are within configured thresholds.</small>
        </div>
      )}

      {sel && <EventDetail event={sel} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Full Alerts & Events Page — replaces the old AlertsPage
   ═══════════════════════════════════════════════════════ */
export function EventsPage({ devices, farm, go, notify }: {
  devices: Device[];
  farm: string;
  go: (path: string) => void;
  notify: (text: string, kind?: "error" | "success") => void;
}) {
  const scoped = useMemo(() => farm === "all" ? devices : devices.filter(d => d.farmId === farm), [devices, farm]);
  const sensors = useMemo(() => initialSensors.filter(s => scoped.some(d => d.id === s.deviceId)), [scoped]);
  const telemetry = useMemo(() => initialTelemetry.filter(t => scoped.some(d => d.id === t.deviceId)), [scoped]);
  const events = useMemo(() => detectEvents(scoped, sensors, telemetry), [scoped, sensors, telemetry]);
  const summary = useMemo(() => summarizeEvents(events, scoped, sensors), [events, scoped, sensors]);

  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sevFilter, setSevFilter] = useState("all");
  const [condFilter, setCondFilter] = useState("all");
  const [sensorFilter, setSensorFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");

  const sensorTypes = [...new Set(events.map(e => e.sensorType))];

  const filtered = events.filter(e =>
    (sevFilter === "all" || e.severity === sevFilter) &&
    (condFilter === "all" || e.condition === condFilter) &&
    (sensorFilter === "all" || e.sensorType === sensorFilter) &&
    (deviceFilter === "all" || e.deviceId === deviceFilter) &&
    (query === "" || `${e.title} ${e.message} ${e.deviceName} ${e.sensorName}`.toLowerCase().includes(query.toLowerCase()))
  );

  const sel = events.find(e => e.id === selected);

  const exportAll = () => {
    const rows = filtered.map(e => [
      e.id, e.title, e.severity, e.condition, e.sensorType, e.value, e.unit,
      e.triggeredAt, e.recoveredAt || "", e.durationMinutes,
      e.impact.riskLevel, e.impact.category, e.impact.cropEffect,
      e.deviceName, e.deviceId, e.sensorId,
      farmName(e.farmId), zoneName(e.zoneId),
      e.recommendations.join("; "),
    ]);
    downloadFile("agrivaid-events.csv", csv([
      ["ID", "Title", "Severity", "Condition", "Sensor Type", "Value", "Unit",
       "Triggered", "Recovered", "Duration (min)", "Risk Level", "Category",
       "Crop Effect", "Device", "Device ID", "Sensor ID", "Farm", "Zone", "Recommendations"],
      ...rows
    ]), "text/csv");
    notify("Events report exported.");
  };

  return (
    <div className="evt-page">
      <div className="evt-page-head">
        <div>
          <h2>Event & Alert Management</h2>
          <p>Intelligent sensor event detection with agricultural impact analysis</p>
        </div>
        <div className="evt-page-actions">
          <button className="evt-export" onClick={exportAll}><Download size={14} /> Export CSV</button>
        </div>
      </div>

      <div className="evt-summary-row evt-summary-lg">
        <div className="evt-summary-card evt-sc-total"><Layers size={20} /><div><span className="evt-sc-num">{summary.total}</span><span className="evt-sc-label">Total Events</span></div></div>
        <div className="evt-summary-card evt-sc-critical"><AlertTriangle size={20} /><div><span className="evt-sc-num">{summary.critical}</span><span className="evt-sc-label">Critical</span></div></div>
        <div className="evt-summary-card evt-sc-warning"><Activity size={20} /><div><span className="evt-sc-num">{summary.warning}</span><span className="evt-sc-label">Warning</span></div></div>
        <div className="evt-summary-card evt-sc-info"><Info size={20} /><div><span className="evt-sc-num">{summary.info}</span><span className="evt-sc-label">Info / Recovery</span></div></div>
        {summary.compoundAlerts > 0 && <div className="evt-summary-card evt-sc-compound"><Zap size={20} /><div><span className="evt-sc-num">{summary.compoundAlerts}</span><span className="evt-sc-label">Compound</span></div></div>}
        {summary.dataIssues.length > 0 && <div className="evt-summary-card evt-sc-fault"><Shield size={20} /><div><span className="evt-sc-num">{summary.dataIssues.length}</span><span className="evt-sc-label">Data Issues</span></div></div>}
      </div>

      {summary.dataIssues.length > 0 && (
        <div className="card padded evt-data-issues">
          <h4><Shield size={14} /> Data Integrity & Reliability</h4>
          <p className="evt-di-note">The following issues affect data reliability. Event detection results should be interpreted with these in mind.</p>
          {summary.dataIssues.map((di, i) => (
            <div key={i} className={`evt-di-row evt-di-${di.severity}`}>
              <span className={`badge ${di.severity === "critical" ? "danger" : di.severity === "warning" ? "warning" : "info"}`}>{di.type.replace(/_/g, " ")}</span>
              <b>{di.message}</b>
              <small>{di.detail}</small>
              <button className="table-link" onClick={() => go(`/devices/${di.deviceId}`)}>{di.deviceId}</button>
            </div>
          ))}
        </div>
      )}

      <ThresholdConfig />

      <div className="card padded">
        <div className="evt-toolbar evt-toolbar-full">
          <div className="evt-search-wrap">
            <Search size={14} />
            <input type="text" placeholder="Search events…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} aria-label="Severity">
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="information">Info</option>
          </select>
          <select value={condFilter} onChange={e => setCondFilter(e.target.value)} aria-label="Condition">
            <option value="all">All conditions</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="recovery">Recovery</option>
            <option value="sensor_fault">Sensor fault</option>
          </select>
          <select value={sensorFilter} onChange={e => setSensorFilter(e.target.value)} aria-label="Sensor type">
            <option value="all">All sensors</option>
            {sensorTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
          <select value={deviceFilter} onChange={e => setDeviceFilter(e.target.value)} aria-label="Device">
            <option value="all">All devices</option>
            {scoped.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {filtered.length ? (
          <div className="table-scroll">
            <table className="evt-table">
              <thead>
                <tr>
                  <th></th><th>Event</th><th>Device</th><th>Condition</th><th>Value</th><th>Duration</th><th>Risk</th><th>Triggered</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} className={`evt-row ${selected === e.id ? "evt-row-sel" : ""} evt-row-${e.severity}`} onClick={() => setSelected(selected === e.id ? null : e.id)}>
                    <td>{(() => { const I = severityIcon[e.severity] || Info; return <I size={16} style={{ color: severityColor[e.severity] }} />; })()}</td>
                    <td>
                      <div className="evt-row-title">{(() => { const I = sensorIcon[e.sensorType] || Activity; return <I size={14} />; })()} {e.title}</div>
                      <small>{e.message}</small>
                    </td>
                    <td>
                      <button className="table-link" onClick={ev => { ev.stopPropagation(); go(`/devices/${e.deviceId}`); }}>{e.deviceName}</button>
                      <small>{farmName(e.farmId)}</small>
                    </td>
                    <td><span className={`badge ${e.severity === "critical" ? "danger" : e.severity === "warning" ? "warning" : "info"}`}>{conditionLabel[e.condition]}</span></td>
                    <td className="number">{e.sensorType === "compound" ? "—" : `${e.value} ${e.unit}`}</td>
                    <td>{fmtDuration(e.durationMinutes)}</td>
                    <td><RiskBadge level={e.impact.riskLevel} /></td>
                    <td>{timeShort(e.triggeredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="evt-empty">
            <CheckCircle size={40} />
            <p>No events match the current filters.</p>
            <small>All monitored parameters are within configured thresholds, or adjust filters to see results.</small>
          </div>
        )}

        {sel && <EventDetail event={sel} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}

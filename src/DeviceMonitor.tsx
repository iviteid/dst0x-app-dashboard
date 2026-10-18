import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChevronDown,
  ChevronUp,
  Download,
  Maximize2,
  Minimize2,
  Search,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import type { Device, Sensor } from "./types";
import { DEMO_NOW, csv, downloadFile, initialTelemetry } from "./data";

const JAKARTA_OFFSET = 7 * 3600000;
const palette = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#0ea5e9",
  "#ef4444",
  "#14b8a6",
];
type Bucket = "all" | "hour" | "day" | "week" | "month" | "year";
const buckets: [Bucket, string][] = [
  ["all", "All samples"],
  ["hour", "Hour"],
  ["day", "Day"],
  ["week", "Week"],
  ["month", "Month"],
  ["year", "Year"],
];
const toInput = (ms: number) =>
  new Date(ms + JAKARTA_OFFSET).toISOString().slice(0, 16);
const fromInput = (value: string) =>
  Date.parse(`${value}:00.000Z`) - JAKARTA_OFFSET;
const label = (ms: number, withSeconds = false) =>
  new Date(ms + JAKARTA_OFFSET)
    .toISOString()
    .slice(0, withSeconds ? 19 : 16)
    .replace("T", " ");
const dayStart = (ms: number) =>
  fromInput(`${new Date(ms + JAKARTA_OFFSET).toISOString().slice(0, 10)}T00:00`);
const bucketStart = (ms: number, mode: Bucket) => {
  if (mode === "all") return ms;
  const local = new Date(ms + JAKARTA_OFFSET);
  if (mode === "hour") local.setUTCMinutes(0, 0, 0);
  else if (mode === "day") local.setUTCHours(0, 0, 0, 0);
  else if (mode === "week") {
    local.setUTCHours(0, 0, 0, 0);
    local.setUTCDate(local.getUTCDate() - local.getUTCDay());
  } else if (mode === "month") {
    local.setUTCHours(0, 0, 0, 0);
    local.setUTCDate(1);
  } else {
    local.setUTCHours(0, 0, 0, 0);
    local.setUTCMonth(0, 1);
  }
  return local.getTime() - JAKARTA_OFFSET;
};

export default function DeviceMonitor({
  device,
  sensors,
  notify,
}: {
  device: Device;
  sensors: Sensor[];
  notify: (text: string, kind?: "error" | "success") => void;
}) {
  const now = Date.parse(DEMO_NOW);
  const [selected, setSelected] = useState<string[]>(
    sensors.slice(0, 1).map((s) => s.id),
  );
  const [draft, setDraft] = useState<string[]>(selected);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [realtime, setRealtime] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [from, setFrom] = useState(() => dayStart(now));
  const [to, setTo] = useState(() => dayStart(now) + 86399000);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [bucket, setBucket] = useState<Bucket>("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [curved, setCurved] = useState(true);
  const [dots, setDots] = useState(false);
  const [grid, setGrid] = useState(true);
  const [yAxisSide, setYAxisSide] = useState<"left" | "right">("left");
  const [full, setFull] = useState(false);
  const [tick, setTick] = useState(0);
  const picker = useRef<HTMLDivElement>(null);
  const rangeBox = useRef<HTMLDivElement>(null);
  const settingsBox = useRef<HTMLDivElement>(null);

  const colorOf = (id: string) =>
    colors[id] ?? palette[sensors.findIndex((s) => s.id === id) % palette.length];
  const chosen = sensors.filter((s) => selected.includes(s.id));
  const units = [...new Set(chosen.map((s) => s.unit))];

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!picker.current?.contains(target)) setPickerOpen(false);
      if (!rangeBox.current?.contains(target)) setRangeOpen(false);
      if (!settingsBox.current?.contains(target)) setSettingsOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPickerOpen(false);
      setRangeOpen(false);
      setSettingsOpen(false);
      setFull(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, []);
  useEffect(() => {
    if (!realtime) return;
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, [realtime]);

  const window_ = realtime ? { from: now - 7200000, to: now } : { from, to };
  const rows = useMemo(() => {
    const grouped = new Map<number, Record<string, number[]>>();
    for (const point of initialTelemetry) {
      if (point.deviceId !== device.id) continue;
      if (!selected.includes(point.sensorId)) continue;
      if (point.quality === "missing") continue;
      const at = Date.parse(point.timestamp);
      if (at < window_.from || at > window_.to) continue;
      const key = bucketStart(at, bucket);
      const slot = grouped.get(key) || {};
      (slot[point.sensorId] ||= []).push(point.value);
      grouped.set(key, slot);
    }
    return [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([at, values]) => {
        const row: Record<string, number | string> = { at, label: label(at) };
        for (const [sensorId, list] of Object.entries(values))
          row[sensorId] =
            Math.round(
              (list.reduce((sum, v) => sum + v, 0) / list.length) * 1000,
            ) / 1000;
        return row;
      });
  }, [device.id, selected, bucket, window_.from, window_.to, tick]);

  const toggleDraft = (id: string) =>
    setDraft((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );
  const apply = () => {
    setSelected(draft);
    setHidden((list) => list.filter((id) => draft.includes(id)));
    setPickerOpen(false);
  };
  const exportCsv = () => {
    if (!rows.length) {
      notify("No samples in the selected window.", "error");
      return;
    }
    downloadFile(
      `${device.id}-monitoring.csv`,
      csv([
        ["Timestamp (Asia/Jakarta)", ...chosen.map((s) => `${s.name} (${s.unit})`)],
        ...rows.map((row) => [
          String(row.label),
          ...chosen.map((s) => row[s.id] ?? ""),
        ]),
      ]),
      "text/csv",
    );
    notify("Monitoring CSV downloaded.");
  };
  const visible = chosen.filter((s) => !hidden.includes(s.id));
  const matches = sensors.filter((s) =>
    s.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className={`monitor ${full ? "monitor-full" : ""}`}>
      <div className="monitor-id">
        <div className="monitor-name">{device.name}</div>
        <span className={`monitor-state ${device.status}`}>{device.status}</span>
        <small>{device.id}</small>
        <button
          className="monitor-icon"
          aria-label={full ? "Exit full screen" : "Full screen"}
          onClick={() => setFull((v) => !v)}
        >
          {full ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>
      <div className="monitor-body">
        <div className="monitor-bar">
          <div className="monitor-picker" ref={picker}>
            <button
              className="monitor-field"
              aria-expanded={pickerOpen}
              onClick={() => {
                setDraft(selected);
                setPickerOpen((v) => !v);
              }}
            >
              Select sensors
              {pickerOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {pickerOpen && (
              <div className="monitor-menu">
                <label className="monitor-check monitor-all">
                  <input
                    type="checkbox"
                    checked={draft.length === sensors.length}
                    onChange={(e) =>
                      setDraft(e.target.checked ? sensors.map((s) => s.id) : [])
                    }
                  />
                  Select all
                  <button
                    aria-label="Close sensor list"
                    onClick={() => setPickerOpen(false)}
                  >
                    <X size={15} />
                  </button>
                </label>
                <div className="monitor-search">
                  <Search size={14} />
                  <input
                    value={query}
                    placeholder="Search…"
                    aria-label="Search sensors"
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="monitor-options">
                  {matches.map((s) => (
                    <label className="monitor-check" key={s.id}>
                      <input
                        type="checkbox"
                        checked={draft.includes(s.id)}
                        onChange={() => toggleDraft(s.id)}
                      />
                      {s.name}
                    </label>
                  ))}
                  {!matches.length && <p>No matching channels</p>}
                </div>
                <button
                  className="monitor-apply"
                  disabled={!draft.length}
                  onClick={apply}
                >
                  Apply
                </button>
              </div>
            )}
          </div>
          <div className="monitor-bar-right">
            <label className="monitor-realtime">
              Realtime
              <input
                type="checkbox"
                checked={realtime}
                onChange={(e) => setRealtime(e.target.checked)}
              />
            </label>
            <div className="monitor-range" ref={rangeBox}>
              <button
                className="monitor-field"
                disabled={realtime}
                aria-expanded={rangeOpen}
                onClick={() => {
                  setDraftFrom(from);
                  setDraftTo(to);
                  setRangeOpen((v) => !v);
                }}
              >
                {realtime
                  ? "Following the last 2 hours"
                  : `${label(from, true)} → ${label(to, true)}`}
              </button>
              {rangeOpen && (
                <div className="monitor-menu monitor-range-menu">
                  <label>
                    <span>From</span>
                    <input
                      type="datetime-local"
                      value={toInput(draftFrom)}
                      onChange={(e) => setDraftFrom(fromInput(e.target.value))}
                    />
                  </label>
                  <label>
                    <span>To</span>
                    <input
                      type="datetime-local"
                      value={toInput(draftTo)}
                      onChange={(e) => setDraftTo(fromInput(e.target.value))}
                    />
                  </label>
                  <div className="monitor-range-actions">
                    <button
                      onClick={() => {
                        setDraftFrom(dayStart(now));
                        setDraftTo(dayStart(now) + 86399000);
                      }}
                    >
                      Dataset day
                    </button>
                    <span />
                    <button onClick={() => setRangeOpen(false)}>Cancel</button>
                    <button
                      className="primary"
                      onClick={() => {
                        setFrom(Math.min(draftFrom, draftTo));
                        setTo(Math.max(draftFrom, draftTo));
                        setRangeOpen(false);
                      }}
                    >
                      OK
                    </button>
                  </div>
                </div>
              )}
            </div>
            <select
              className="monitor-select"
              aria-label="Aggregation"
              value={bucket}
              onChange={(e) => setBucket(e.target.value as Bucket)}
            >
              {buckets.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
            <button
              className="monitor-icon"
              aria-label="Download monitoring CSV"
              onClick={exportCsv}
            >
              <Download size={17} />
            </button>
          </div>
        </div>
        <div className="monitor-chips">
          <div className="monitor-settings" ref={settingsBox}>
            <button
              className="monitor-icon"
              aria-label="Chart settings"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((v) => !v)}
            >
              <SettingsIcon size={16} />
            </button>
            {settingsOpen && (
              <div className="monitor-menu monitor-settings-menu">
                <div className="monitor-settings-head">
                  <span><SettingsIcon size={15} /></span>
                  <div>
                    <b>Chart settings</b>
                    <small>Display and series</small>
                  </div>
                  <button aria-label="Close chart settings" onClick={() => setSettingsOpen(false)}><X size={15} /></button>
                </div>
                {chosen[0] && (
                  <div className="monitor-series-settings">
                    <div className="monitor-series-name">
                      <i style={{ background: colorOf(chosen[0].id) }} />
                      <b>{chosen[0].name}</b>
                    </div>
                    <div className="monitor-setting-row">
                      <span>Y-axis</span>
                      <div className="monitor-segmented" role="group" aria-label="Y-axis position">
                        <button className={yAxisSide === "left" ? "active" : ""} onClick={() => setYAxisSide("left")}>Left</button>
                        <button className={yAxisSide === "right" ? "active" : ""} onClick={() => setYAxisSide("right")}>Right</button>
                      </div>
                    </div>
                    <label className="monitor-setting-row">
                      <span>Graph type</span>
                      <select value={curved ? "smooth" : "line"} onChange={(e) => setCurved(e.target.value === "smooth")}>
                        <option value="smooth">Smooth line</option>
                        <option value="line">Straight line</option>
                      </select>
                    </label>
                  </div>
                )}
                <div className="monitor-toggle-list">
                  <label className="monitor-check">
                    <input
                      type="checkbox"
                      checked={dots}
                      onChange={(e) => setDots(e.target.checked)}
                    />
                    Show sample points
                  </label>
                  <label className="monitor-check">
                    <input
                      type="checkbox"
                      checked={grid}
                      onChange={(e) => setGrid(e.target.checked)}
                    />
                    Show grid
                  </label>
                </div>
                <div className="monitor-colors">
                  {chosen.map((s) => (
                    <label key={s.id}>
                      <input
                        type="color"
                        value={colorOf(s.id)}
                        aria-label={`${s.name} colour`}
                        onChange={(e) =>
                          setColors((map) => ({ ...map, [s.id]: e.target.value }))
                        }
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          {chosen.map((s) => (
            <span className="monitor-chip" key={s.id}>
              <i style={{ background: colorOf(s.id) }} />
              {s.name}
            </span>
          ))}
        </div>
        <div className="monitor-chart">
          {rows.length && chosen.length ? (
            <ResponsiveContainer width="100%" height={full ? 440 : 330}>
              <LineChart
                data={rows}
                margin={{ top: 10, right: 24, bottom: 4, left: 4 }}
              >
                {grid && (
                  <CartesianGrid
                    stroke="var(--chart-grid)"
                    vertical={false}
                    strokeDasharray="0"
                  />
                )}
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--muted)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--chart-grid)" }}
                  minTickGap={60}
                />
                {units.slice(0, 2).map((unit, index) => (
                  <YAxis
                    key={unit}
                    yAxisId={unit}
                    orientation={index === 0 ? yAxisSide : yAxisSide === "left" ? "right" : "left"}
                    tick={{ fontSize: 10, fill: "var(--muted)" }}
                    tickLine={false}
                    axisLine={false}
                    width={42}
                  />
                ))}
                {units.slice(2).map((unit) => (
                  <YAxis key={unit} yAxisId={unit} hide />
                ))}
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 11,
                  }}
                  formatter={(value: number, name: string) => {
                    const s = chosen.find((x) => x.name === name);
                    return [`${value} ${s?.unit || ""}`.trim(), name];
                  }}
                />
                {visible.map((s) => (
                  <Line
                    key={s.id}
                    yAxisId={s.unit}
                    dataKey={s.id}
                    name={s.name}
                    stroke={colorOf(s.id)}
                    strokeWidth={2}
                    type={curved ? "monotone" : "linear"}
                    dot={dots ? { r: 2 } : false}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="monitor-empty">
              {chosen.length
                ? "No samples in the selected window."
                : "Select at least one sensor channel."}
            </p>
          )}
          <div className="monitor-legend">
            {chosen.map((s) => (
              <label key={s.id}>
                <input
                  type="checkbox"
                  checked={!hidden.includes(s.id)}
                  style={{ accentColor: colorOf(s.id) }}
                  onChange={() =>
                    setHidden((list) =>
                      list.includes(s.id)
                        ? list.filter((x) => x !== s.id)
                        : [...list, s.id],
                    )
                  }
                />
                {s.name} ({s.unit})
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="monitor-table-card">
        <h3>Monitoring data</h3>
        <div className="monitor-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Monitoring time</th>
                {chosen.map((s) => (
                  <th key={s.id}>
                    {s.name} ({s.unit})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((row) => (
                <tr key={String(row.at)}>
                  <td>{label(Number(row.at), true)}</td>
                  {chosen.map((s) => (
                    <td key={s.id}>{row[s.id] ?? "—"}</td>
                  ))}
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={chosen.length + 1}>
                    No samples in the selected window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <small>
          Timestamps are demo telemetry in Asia/Jakarta. Realtime replays the
          fixed demo dataset and never contacts hardware.
        </small>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  TabletSmartphone as DeviceTablet,
  Download,
  FileBarChart,
  Filter,
  CloudUpload,
  Grid2X2,
  History,
  Leaf,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  Moon,
  Trash2,
  UserRound,
  Wifi,
  X,
} from "lucide-react";
import type { Alert, Device, Sensor, Telemetry } from "./types";
import {
  DEMO_NOW,
  csv,
  downloadFile,
  farmName,
  farms,
  formatTime,
  initialAlerts,
  initialDevices,
  initialSensors,
  initialTelemetry,
  zoneName,
  zones,
} from "./data";
import { demoService } from "./service";
import DeviceMap from "./DeviceMap";
import FirmwareOta from "./FirmwareOta";
import { deviceKind, devicePosition, kindLabels, zoneCenters } from "./deviceGeo";

type Theme = "light" | "dark" | "system";
type Notice = { text: string; kind?: "error" | "success" };
type PageProps = {
  devices: Device[];
  alerts: Alert[];
  farm: string;
  go: (path: string) => void;
  notify: (text: string, kind?: "error" | "success") => void;
  refresh: () => void;
};
const read = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
};
const iconMap = {
  dashboard: Grid2X2,
  devices: DeviceTablet,
  analytics: Activity,
  "historical-data": History,
  alerts: Bell,
  reports: FileBarChart,
  "firmware-ota": CloudUpload,
  profile: UserRound,
  settings: SettingsIcon,
};
const nav: [string, string][] = [
  ["dashboard", "Overview"],
  ["devices", "Devices"],
  ["analytics", "Sensor Analytics"],
  ["historical-data", "Historical Data"],
  ["alerts", "Alerts"],
  ["reports", "Reports"],
  ["firmware-ota", "Firmware OTA"],
];
const badge = (text: string) =>
  `badge ${/critical|offline|missing|error/i.test(text) ? "danger" : /warning|stale|suspect|low/i.test(text) ? "warning" : /information|recent/i.test(text) ? "info" : "success"}`;
const fmt = (v: number, unit = "") =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: unit === "lux" ? 0 : 1 }).format(v)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
const isPublic = (p: string) =>
  ["/login", "/signup", "/forgot-password", "/reset-password"].includes(p);
const deviceFarm = (d: Device) =>
  `${farmName(d.farmId)} · ${zoneName(d.zoneId)}`;
const timeShort = (s: string) => formatTime(s).replace(", 2026", "");
const thresholds = (sensor: Sensor) =>
  sensor.type === "soil_moisture"
    ? {
        min: Number(read("agrivaid-soil-min", "25")),
        max: Number(read("agrivaid-soil-max", "65")),
      }
    : { min: sensor.min, max: sensor.max };
const freshness = (device: Device) => {
  if (device.status === "offline") return "Offline";
  const ageSeconds = Math.max(
    0,
    (Date.parse(DEMO_NOW) - Date.parse(device.lastSeen)) / 1000,
  );
  if (ageSeconds <= device.intervalSeconds * 2) return "Recently updated";
  if (ageSeconds <= device.intervalSeconds * 5) return "Stale";
  return "Unknown";
};

function useRoute() {
  const [path, setPath] = useState(
    location.pathname === "/" ? "/dashboard" : location.pathname,
  );
  useEffect(() => {
    const f = () =>
      setPath(location.pathname === "/" ? "/dashboard" : location.pathname);
    addEventListener("popstate", f);
    return () => removeEventListener("popstate", f);
  }, []);
  const go = (p: string) => {
    if (p !== location.pathname + location.search) {
      history.pushState({}, "", p);
      setPath(new URL(p, location.href).pathname);
      scrollTo(0, 0);
    }
  };
  return [path, go] as const;
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <Leaf size={20} />
      </span>
      <span>
        <b>AgrivaID</b>
        <small>Monitor Smarter. Grow Better.</small>
      </span>
    </div>
  );
}
function Button({
  children,
  onClick,
  variant = "secondary",
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      className={`btn ${variant}`}
      onClick={onClick}
      type={type}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Badge({ children }: { children: string }) {
  return (
    <span className={badge(children)}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-symbol">
        <Database size={22} />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
function PageHead({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">AGRIVAID / OPERATIONS</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="head-actions">{actions}</div>
    </div>
  );
}
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
function PanelHead({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel-head">
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  );
}
function Stat({
  label,
  value,
  detail,
  Icon,
  accent,
  onClick,
}: {
  label: string;
  value: string | number;
  detail: string;
  Icon: typeof Activity;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <button className={`stat-card ${accent || ""}`} onClick={onClick}>
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </button>
  );
}
function Spark({ seed = 0 }: { seed?: number }) {
  const points = Array.from(
    { length: 18 },
    (_, i) =>
      `${i * 12},${24 + Math.sin(i * 0.85 + seed) * 7 - Math.cos(i * 0.38 + seed) * 5}`,
  ).join(" ");
  return (
    <svg
      className="spark"
      viewBox="0 0 204 48"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={points} />
    </svg>
  );
}
function LabelSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="control">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, n]) => (
          <option value={v} key={v}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
function SearchBox({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-box">
      <Search size={17} />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
function Pager({
  page,
  setPage,
  total,
  size,
}: {
  page: number;
  setPage: (n: number) => void;
  total: number;
  size: number;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="pager">
      <span>
        Showing {total ? (page - 1) * size + 1 : 0}–
        {Math.min(page * size, total)} of {total}
      </span>
      <div>
        <button
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          {page} / {pages}
        </span>
        <button
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", f);
    return () => removeEventListener("keydown", f);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-title">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function downloadDevices(devices: Device[]) {
  downloadFile(
    "agrivaid-devices.csv",
    csv([
      [
        "Device ID",
        "Name",
        "Farm",
        "Zone",
        "Model",
        "Protocol",
        "Status",
        "Battery %",
        "Last seen UTC",
      ],
      ...devices.map((d) => [
        d.id,
        d.name,
        farmName(d.farmId),
        zoneName(d.zoneId),
        d.model,
        d.protocol,
        d.status,
        d.battery,
        d.lastSeen,
      ]),
    ]),
    "text/csv",
  );
}

function TrendChart({
  sensor,
  device,
  range,
  showPrevious = true,
}: {
  sensor: Sensor;
  device: Device;
  range: string;
  showPrevious?: boolean;
}) {
  const hours: { [k: string]: number } = {
    "1H": 2,
    "6H": 6,
    "24H": 24,
    "7D": 168,
    "30D": 720,
  };
  const n = hours[range] || 24;
  const series = initialTelemetry.filter((t) => t.sensorId === sensor.id);
  const entries = series.slice(-Math.min(n, 168));
  const previousEntries = series.slice(-Math.min(n * 2, 168), -n);
  const upperLimit = thresholds(sensor).max;
  const data = entries.map((t, i) => ({
    time:
      range === "7D" || range === "30D"
        ? new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Jakarta",
            month: "short",
            day: "numeric",
          }).format(new Date(t.timestamp))
        : new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(new Date(t.timestamp)),
    value: t.quality === "missing" ? null : t.value,
    previous:
      previousEntries[i]?.quality === "valid" ? previousEntries[i].value : null,
  }));
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 14, bottom: 4, left: 0 }}
        >
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={25}
          />
          <YAxis
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={48}
            domain={["auto", "auto"]}
            unit={sensor.unit === "%" ? "%" : ""}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              color: "var(--text)",
            }}
            formatter={(value, name) => [
              value == null ? "Missing" : `${value} ${sensor.unit}`,
              name === "value" ? "Selected period" : "Previous period",
            ]}
          />
          {upperLimit != null && (
            <ReferenceLine
              y={upperLimit}
              stroke="var(--warning)"
              strokeDasharray="4 4"
              label={{ value: "Max", fill: "var(--warning)", fontSize: 10 }}
            />
          )}
          {showPrevious && (
            <Line
              type="monotone"
              dataKey="previous"
              stroke="var(--chart-secondary)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              name="Previous period"
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--primary)"
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
            name="Selected period"
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="chart-footer">
        <span>Device: {device.name}</span>
        <span>
          Unit: {sensor.unit} · Missing samples remain gaps · Asia/Jakarta
        </span>
      </div>
    </div>
  );
}

function AppShell({
  path,
  go,
  theme,
  setTheme,
  farm,
  setFarm,
  devices,
  alerts,
  children,
  logout,
}: {
  path: string;
  go: (p: string) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  farm: string;
  setFarm: (f: string) => void;
  devices: Device[];
  alerts: Alert[];
  children: React.ReactNode;
  logout: () => void;
}) {
  const [mobile, setMobile] = useState(false);
  const [globalQuery, setGlobalQuery] = useState("");
  const matches = globalQuery.trim()
    ? devices
        .filter((d) =>
          `${d.name} ${d.id}`.toLowerCase().includes(globalQuery.toLowerCase()),
        )
        .slice(0, 4)
    : [];
  const title =
    nav.find(([p]) => path === `/${p}`)?.[1] ||
    (/\/devices\//.test(path)
      ? "Device Detail"
      : path === "/profile"
        ? "User Profile"
        : "Settings");
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Brand />
        <div className="side-farm">
          <span>ACTIVE SCOPE</span>
          <strong>{farm === "all" ? "All demo farms" : farmName(farm)}</strong>
          <small>Demo workspace</small>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map(([key, name]) => {
            const Icon = iconMap[key as keyof typeof iconMap];
            return (
              <button
                key={key}
                className={
                  path === `/${key}` ||
                  (key === "devices" && path.startsWith("/devices/"))
                    ? "active"
                    : ""
                }
                onClick={() => {
                  go(`/${key}`);
                  setMobile(false);
                }}
              >
                <Icon size={18} />
                <span>{name}</span>
                {key === "alerts" &&
                  alerts.filter((a) => !a.resolvedAt).length > 0 && (
                    <em>{alerts.filter((a) => !a.resolvedAt).length}</em>
                  )}
              </button>
            );
          })}
        </nav>
        <div className="side-bottom">
          <button
            className={path === "/settings" ? "active" : ""}
            onClick={() => {
              go("/settings");
              setMobile(false);
            }}
          >
            <SettingsIcon size={18} /> Settings
          </button>
          <button
            className={path === "/profile" ? "active" : ""}
            onClick={() => {
              go("/profile");
              setMobile(false);
            }}
          >
            <UserRound size={18} /> User profile
          </button>
          <button onClick={logout}>
            <LogOut size={18} /> Leave demo
          </button>
          <div className="side-user">
            <span className="avatar">AM</span>
            <span>
              <b>Alex Morgan</b>
              <small>Demo administrator</small>
            </span>
          </div>
        </div>
      </aside>
      {mobile && (
        <div className="mobile-shade" onClick={() => setMobile(false)} />
      )}
      <div className="shell-main">
        <header className="topbar">
          <div className="top-left">
            <button
              className="icon-button menu-button"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span className="crumb">
              Workspace <span>/</span> <b>{title}</b>
            </span>
          </div>
          <div className="top-right">
            <span className="demo-chip">
              <span className="status-pulse" /> DEMO DATA
            </span>
            <div className="global-search">
              <Search size={15} />
              <input
                aria-label="Search all devices"
                placeholder="Search devices…"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
              />
              {globalQuery && (
                <div className="global-results">
                  {matches.length ? (
                    matches.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => {
                          go(`/devices/${encodeURIComponent(d.id)}`);
                          setGlobalQuery("");
                        }}
                      >
                        <b>{d.name}</b>
                        <small>
                          {d.id} · {farmName(d.farmId)}
                        </small>
                      </button>
                    ))
                  ) : (
                    <span>No matching demo devices</span>
                  )}
                </div>
              )}
            </div>
            <select
              aria-label="Select farm"
              className="top-select"
              value={farm}
              onChange={(e) => setFarm(e.target.value)}
            >
              <option value="all">All demo farms</option>
              {farms.map((f) => (
                <option value={f.id} key={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <button
              className="icon-button"
              aria-label="Toggle theme"
              title="Toggle light and dark theme"
              onClick={() =>
                setTheme(
                  document.documentElement.dataset.theme === "dark"
                    ? "light"
                    : "dark",
                )
              }
            >
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              className="icon-button notify-icon"
              aria-label="View alerts"
              onClick={() => go("/alerts")}
            >
              <Bell size={19} />
              <i />
            </button>
            <button
              className="avatar avatar-btn"
              aria-label="User profile"
              onClick={() => go("/profile")}
            >
              AM
            </button>
          </div>
        </header>
        <main className="content">
          {children}
          <footer className="app-footer">
            <span>
              AgrivaID demo · Simulated telemetry, last dataset timestamp{" "}
              {formatTime(DEMO_NOW)}
            </span>
            <span>Device connectivity reflects demo state, not hardware</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Dashboard({ devices, farm, go, notify, refresh }: PageProps) {
  const scoped = devices.filter((d) => farm === "all" || d.farmId === farm);
  const ids = new Set(scoped.map((d) => d.id));
  const sensors = initialSensors.filter((s) => ids.has(s.deviceId));
  const scopedTelemetry = initialTelemetry.filter((t) => ids.has(t.deviceId));
  const availability = scopedTelemetry.length
    ? `${((scopedTelemetry.filter((t) => t.quality === "valid").length / scopedTelemetry.length) * 100).toFixed(1)}%`
    : "—";
  return (
    <>
      <PageHead
        title="Farm Overview"
        description={`${farm === "all" ? "All demo farms" : farmName(farm)} · Smart agriculture monitoring at a glance`}
        actions={
          <>
            <span className="updated">Dataset: {formatTime(DEMO_NOW)}</span>
            <Button onClick={() => { refresh(); notify("Demo dataset checked. Values remain deterministic."); }}>
              <RefreshCw size={16} /> Refresh
            </Button>
          </>
        }
      />
      <div className="dashboard-kpis">
        <Stat label="Total devices" value={scoped.length} detail="Registered in scope" Icon={DeviceTablet} accent="featured" onClick={() => go("/devices")} />
        <Stat label="Online devices" value={scoped.filter((d) => d.status === "online").length} detail="Communicating" Icon={Wifi} onClick={() => go("/devices?status=online")} />
        <Stat label="Offline devices" value={scoped.filter((d) => d.status === "offline").length} detail="Connectivity checks" Icon={AlertTriangle} accent="danger-tint" onClick={() => go("/devices?status=offline")} />
        <Stat label="With warnings" value={scoped.filter((d) => d.status === "warning" || d.status === "critical").length} detail="Needs review" Icon={Bell} accent="warning-tint" onClick={() => go("/devices?status=warning")} />
        <Stat label="Sensor channels" value={sensors.length} detail="Configured channels" Icon={Activity} onClick={() => go("/analytics")} />
        <Stat label="Data availability" value={availability} detail="Valid samples, last 7 days" Icon={Database} onClick={() => go("/historical-data")} />
      </div>
      <DeviceMap devices={devices} farm={farm} go={go} />
    </>
  );
}

function DeviceTable({
  rows,
  go,
  alerts,
  onEdit,
  onDelete,
}: {
  rows: Device[];
  go: (p: string) => void;
  alerts: Alert[];
  onEdit?: (device: Device) => void;
  onDelete?: (device: Device) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Device</th>
            <th>Model</th>
            <th>Farm / zone</th>
            <th>Status</th>
            <th>Sensors</th>
            <th>Last seen</th>
            <th>Battery</th>
            <th>Alerts</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr
              key={d.id}
              onClick={() => go(`/devices/${encodeURIComponent(d.id)}`)}
            >
              <td>
                <b>{d.name}</b>
                <small>{d.id}</small>
              </td>
              <td>{d.model}</td>
              <td>{deviceFarm(d)}</td>
              <td>
                <Badge>{d.status}</Badge>
              </td>
              <td>
                {initialSensors.filter((s) => s.deviceId === d.id).length}
              </td>
              <td>
                {timeShort(d.lastSeen)}
                <small>{freshness(d)}</small>
              </td>
              <td>
                {d.battery == null ? (
                  "Not available"
                ) : (
                  <span className="battery">
                    <span style={{ width: `${d.battery}%` }} />
                    {d.battery}%
                  </span>
                )}
              </td>
              <td>
                {
                  alerts.filter((a) => a.deviceId === d.id && !a.resolvedAt)
                    .length
                }
              </td>
              <td>
                <button
                  className="table-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    go(`/devices/${encodeURIComponent(d.id)}`);
                  }}
                >
                  View →
                </button>
                {onEdit && (
                  <button
                    className="table-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(d);
                    }}
                  >
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    className="table-link danger-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(d);
                    }}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeviceForm({
  device,
  defaultFarm = farms[0].id,
  onSave,
  onCancel,
  devices,
}: {
  device?: Device;
  defaultFarm?: string;
  onSave: (d: Device) => void;
  onCancel: () => void;
  devices: Device[];
}) {
  const [form, setForm] = useState<Device>(
    device || {
      id: "",
      farmId: defaultFarm,
      zoneId: zones.find((z) => z.farmId === defaultFarm)!.id,
      name: "",
      model: "",
      protocol: "MQTT",
      status: "online",
      lastSeen: DEMO_NOW,
      lastTelemetry: DEMO_NOW,
      intervalSeconds: 60,
      description: "",
      tags: [],
      kind: "climate",
      ...zoneCenters[zones.find((z) => z.farmId === defaultFarm)!.id],
    },
  );
  const [error, setError] = useState("");
  const change = (key: keyof Device, value: unknown) =>
    setForm({ ...form, [key]: value });
  const availableZones = zones.filter((z) => z.farmId === form.farmId);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id.trim() || !form.name.trim() || !form.model.trim()) {
      setError("Device ID, name, and model are required.");
      return;
    }
    const position = devicePosition(form);
    if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude) ||
        position.latitude < -90 || position.latitude > 90 || position.longitude < -180 || position.longitude > 180) {
      setError("Enter valid latitude and longitude for the device marker.");
      return;
    }
    if (
      !device &&
      devices.some((d) => d.id.toLowerCase() === form.id.toLowerCase())
    ) {
      setError("This device ID already exists.");
      return;
    }
    onSave({
      ...form,
      id: form.id.trim(),
      name: form.name.trim(),
      model: form.model.trim(),
      ...position,
      zoneId: availableZones.some((z) => z.id === form.zoneId)
        ? form.zoneId
        : availableZones[0].id,
    });
  };
  return (
    <form onSubmit={submit} className="form-grid">
      <p className="form-note full">
        Changes are saved in this browser as demo state. No hardware
        configuration is sent.
      </p>
      <label>
        Device name
        <input
          value={form.name}
          onChange={(e) => change("name", e.target.value)}
          required
        />
      </label>
      <label>
        Device ID
        <input
          value={form.id}
          onChange={(e) => change("id", e.target.value)}
          required
          disabled={!!device}
        />
      </label>
      <label>
        Model
        <input
          value={form.model}
          onChange={(e) => change("model", e.target.value)}
          required
        />
      </label>
      <label>
        Protocol
        <select
          value={form.protocol}
          onChange={(e) => change("protocol", e.target.value)}
        >
          {["MQTT", "HTTP API", "RS485 / Modbus", "UART", "SDI-12"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <label>
        Farm
        <select
          value={form.farmId}
          onChange={(e) =>
            setForm({
              ...form,
              farmId: e.target.value,
              zoneId: zones.find((z) => z.farmId === e.target.value)!.id,
              ...zoneCenters[zones.find((z) => z.farmId === e.target.value)!.id],
            })
          }
        >
          {farms.map((f) => (
            <option value={f.id} key={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Zone
        <select
          value={form.zoneId}
          onChange={(e) => setForm({ ...form, zoneId: e.target.value, ...zoneCenters[e.target.value] })}
        >
          {availableZones.map((z) => (
            <option value={z.id} key={z.id}>
              {z.name}
            </option>
          ))}
        </select>
      </label>
      <label className="full">
        Device type
        <select value={deviceKind(form)} onChange={(e) => change("kind", e.target.value)}>
          {Object.entries(kindLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <label>
        Latitude · demo map
        <input type="number" min="-90" max="90" step="0.000001" value={form.latitude ?? devicePosition(form).latitude} onChange={(e) => change("latitude", Number(e.target.value))} required />
      </label>
      <label>
        Longitude · demo map
        <input type="number" min="-180" max="180" step="0.000001" value={form.longitude ?? devicePosition(form).longitude} onChange={(e) => change("longitude", Number(e.target.value))} required />
      </label>
      <label className="full">
        Description
        <input
          value={form.description}
          onChange={(e) => change("description", e.target.value)}
        />
      </label>
      {error && <p className="error-text full">{error}</p>}
      <div className="form-actions full">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit">
          Save demo device
        </Button>
      </div>
    </form>
  );
}

function Devices({ devices, alerts, farm, go, notify, refresh }: PageProps) {
  const initial = new URLSearchParams(location.search).get("status") || "all";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(initial);
  const [zone, setZone] = useState("all");
  const [protocol, setProtocol] = useState("all");
  const [sort, setSort] = useState<"name" | "status" | "lastSeen">("name");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<"add" | "edit" | "delete" | null>(null);
  const [selected, setSelected] = useState<Device | undefined>();
  const rows = useMemo(
    () =>
      devices
        .filter(
          (d) =>
            (farm === "all" || d.farmId === farm) &&
            (status === "all" || d.status === status) &&
            (zone === "all" || d.zoneId === zone) &&
            (protocol === "all" || d.protocol === protocol) &&
            `${d.name} ${d.id} ${d.model}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) => String(a[sort]).localeCompare(String(b[sort]))),
    [devices, farm, status, zone, protocol, query, sort],
  );
  useEffect(() => setPage(1), [farm, status, zone, protocol, query]);
  const pageRows = rows.slice((page - 1) * 8, page * 8);
  const save = async (d: Device) => {
    await demoService.updateDevice(d);
    refresh();
    setModal(null);
    notify("Demo device saved in this browser.", "success");
  };
  const remove = () => {
    if (!selected) return;
    localStorage.setItem(
      "agrivaid-devices",
      JSON.stringify(devices.filter((d) => d.id !== selected.id)),
    );
    refresh();
    setModal(null);
    notify("Demo device removed.", "success");
  };
  return (
    <>
      <PageHead
        title="Devices"
        description="Manage field nodes, stations, and gateways in your selected farm scope."
        actions={
          <>
            <Button
              onClick={() => {
                downloadDevices(rows);
                notify("Filtered device CSV downloaded.");
              }}
            >
              <Download size={16} /> Export CSV
            </Button>
            <Button variant="primary" onClick={() => setModal("add")}>
              <Plus size={17} /> Add device
            </Button>
          </>
        }
      />
      <Card className="padded">
        <div className="filter-bar">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search devices or IDs"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter status"
          >
            <option value="all">All statuses</option>
            {["online", "offline", "warning", "critical"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            aria-label="Filter zone"
          >
            <option value="all">All zones</option>
            {zones
              .filter((z) => farm === "all" || z.farmId === farm)
              .map((z) => (
                <option value={z.id} key={z.id}>
                  {z.name}
                </option>
              ))}
          </select>
          <select
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
            aria-label="Filter protocol"
          >
            <option value="all">All protocols</option>
            {[...new Set(devices.map((d) => d.protocol))].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Sort devices"
          >
            <option value="name">Sort: name</option>
            <option value="status">Sort: status</option>
            <option value="lastSeen">Sort: last seen</option>
          </select>
          <button
            className="text-action"
            onClick={() => {
              setQuery("");
              setStatus("all");
              setZone("all");
              setProtocol("all");
            }}
          >
            Clear filters
          </button>
        </div>
        <div className="filter-summary">
          <Filter size={14} /> {rows.length} matching devices ·{" "}
          {farm === "all" ? "All farms" : farmName(farm)} · Demo state
        </div>
        {pageRows.length ? (
          <>
            <DeviceTable
              rows={pageRows}
              go={go}
              alerts={alerts}
              onEdit={(d) => {
                setSelected(d);
                setModal("edit");
              }}
              onDelete={(d) => {
                setSelected(d);
                setModal("delete");
              }}
            />
            <Pager page={page} setPage={setPage} total={rows.length} size={8} />
          </>
        ) : (
          <Empty
            title="No matching devices"
            detail="Try a different search or clear the active filters."
            action={
              <Button
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                  setZone("all");
                  setProtocol("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        )}
      </Card>
      {modal === "add" && (
        <Modal title="Add demo device" onClose={() => setModal(null)}>
          <DeviceForm
            devices={devices}
            defaultFarm={farm === "all" ? farms[0].id : farm}
            onSave={save}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal === "edit" && selected && (
        <Modal title="Edit device metadata" onClose={() => setModal(null)}>
          <DeviceForm
            devices={devices}
            device={selected}
            onSave={save}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal === "delete" && selected && (
        <Modal title="Delete demo device?" onClose={() => setModal(null)}>
          <p className="modal-copy">
            This removes <b>{selected.name}</b> from this browser's demo state.
            It does not affect physical hardware.
          </p>
          <div className="form-actions">
            <Button onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="danger" onClick={remove}>
              <Trash2 size={16} /> Delete demo device
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function DeviceDetail({
  id,
  devices,
  alerts,
  farm,
  go,
  notify,
  refresh,
}: PageProps & { id: string }) {
  const d = devices.find((x) => x.id === id);
  const [tab, setTab] = useState("overview");
  const [sensorId, setSensorId] = useState("");
  const [range, setRange] = useState("24H");
  const [modal, setModal] = useState<"edit" | "delete" | null>(null);
  if (!d)
    return (
      <>
        <PageHead
          title="Device not found"
          description="This device is not in the current demo state."
          actions={
            <Button onClick={() => go("/devices")}>Back to devices</Button>
          }
        />
      </>
    );
  const sensors = initialSensors.filter((s) => s.deviceId === d.id);
  const sensor = sensors.find((s) => s.id === sensorId) || sensors[0];
  const rows = initialTelemetry
    .filter((t) => t.deviceId === d.id)
    .slice(-8)
    .reverse();
  const save = async (x: Device) => {
    await demoService.updateDevice(x);
    refresh();
    setModal(null);
    notify("Device metadata saved locally.", "success");
  };
  const del = () => {
    localStorage.setItem(
      "agrivaid-devices",
      JSON.stringify(devices.filter((x) => x.id !== d.id)),
    );
    refresh();
    setModal(null);
    go("/devices");
    notify("Demo device deleted.", "success");
  };
  return (
    <>
      <PageHead
        title={d.name}
        description={`${d.id} · ${d.model} · ${deviceFarm(d)}`}
        actions={
          <>
            <Badge>{d.status}</Badge>
            <Button onClick={() => setModal("edit")}>Edit metadata</Button>
            <Button onClick={() => go("/firmware-ota")}>Firmware OTA</Button>
            <Button variant="ghost" onClick={() => setModal("delete")}>
              <MoreHorizontal size={18} />
            </Button>
          </>
        }
      />
      <div className="device-meta">
        <span>
          <b>Protocol</b>
          {d.protocol}
        </span>
        <span>
          <b>Last seen</b>
          {formatTime(d.lastSeen)}
        </span>
        <span>
          <b>Reporting interval</b>
          {d.intervalSeconds} sec
        </span>
        <span>
          <b>Data freshness</b>
          {freshness(d)}
        </span>
      </div>
      <div className="tabs">
        {["overview", "telemetry", "events", "configuration"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? "active" : ""}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <>
          <div className="detail-stats">
            <Stat
              label="Connection"
              value={d.status}
              detail="Demo state"
              Icon={Wifi}
            />
            <Stat
              label="Battery"
              value={d.voltage == null ? "Not available" : `${d.voltage} V`}
              detail={
                d.battery == null ? "Not reported" : `${d.battery}% capacity`
              }
              Icon={Activity}
            />
            <Stat
              label="Signal"
              value={d.signal == null ? "Not available" : `${d.signal} dBm`}
              detail="Last diagnostic"
              Icon={Wifi}
            />
            <Stat
              label="Firmware"
              value={d.firmware || "Not available"}
              detail="Reported metadata"
              Icon={ShieldCheck}
            />
          </div>
          <div className="two-column">
            <Card className="padded">
              <PanelHead
                title="Sensor history"
                detail="Configured thresholds shown when available"
                action={
                  <div className="inline-controls">
                    <select
                      value={sensor?.id || ""}
                      onChange={(e) => setSensorId(e.target.value)}
                      aria-label="Device sensor"
                    >
                      {sensors.map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={range}
                      onChange={(e) => setRange(e.target.value)}
                      aria-label="Chart range"
                    >
                      {["1H", "6H", "24H", "7D", "30D"].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                }
              />
              {sensor ? (
                <TrendChart
                  sensor={sensor}
                  device={d}
                  range={range}
                  showPrevious={false}
                />
              ) : (
                <Empty
                  title="No sensor channels"
                  detail="This demo device has no configured sensors."
                />
              )}
            </Card>
            <Card className="padded">
              <PanelHead
                title="Device health"
                detail="Metrics exposed by this demo device"
              />
              <div className="key-values">
                {[
                  ["Status", d.status],
                  ["Uptime", d.uptime || "Not available"],
                  ["Last telemetry", formatTime(d.lastTelemetry)],
                  ["Communication errors", "Not available"],
                  ["Firmware", d.firmware || "Not available"],
                  [
                    "Signal",
                    d.signal == null ? "Not available" : `${d.signal} dBm`,
                  ],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span>{k}</span>
                    <b>{v}</b>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <Card className="padded">
            <PanelHead
              title="Sensor channels"
              detail={`${sensors.length} configured channels`}
              action={
                <button
                  className="text-action"
                  onClick={() => go("/analytics")}
                >
                  Open analytics →
                </button>
              }
            />
            {sensors.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Sensor</th>
                      <th>Current reading</th>
                      <th>Configured range</th>
                      <th>Quality</th>
                      <th>Last received</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensors.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <b>{s.name}</b>
                          <small>{s.id}</small>
                        </td>
                        <td className="number">
                          {s.quality === "missing" ? "—" : fmt(s.value, s.unit)}
                        </td>
                        <td>
                          {thresholds(s).min == null ||
                          thresholds(s).max == null
                            ? "Not configured"
                            : `${thresholds(s).min}–${thresholds(s).max} ${s.unit}`}
                        </td>
                        <td>
                          <Badge>{s.quality}</Badge>
                        </td>
                        <td>{timeShort(s.timestamp)}</td>
                        <td>
                          <button
                            className="table-link"
                            onClick={() =>
                              go(
                                `/analytics?sensor=${encodeURIComponent(s.id)}`,
                              )
                            }
                          >
                            Analyze →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No sensors configured"
                detail="Add sensor channels through a connected backend."
              />
            )}
          </Card>
        </>
      )}
      {tab === "telemetry" && (
        <Card className="padded">
          <PanelHead
            title="Recent telemetry"
            detail="UTC source timestamps displayed in Asia/Jakarta"
            action={
              <Button
                onClick={() => {
                  demoService.exportTelemetry(rows, `${d.id}-telemetry.csv`);
                  notify("Telemetry CSV downloaded.");
                }}
              >
                <Download size={16} /> CSV
              </Button>
            }
          />
          <TelemetryTable rows={rows} />
        </Card>
      )}
      {tab === "events" && (
        <Card className="padded">
          <PanelHead title="Device events" detail="Simulated recent events" />
          {alerts.filter((a) => a.deviceId === d.id).length ? (
            alerts
              .filter((a) => a.deviceId === d.id)
              .map((a) => (
                <div className="event-row" key={a.id}>
                  <Badge>{a.severity}</Badge>
                  <b>{a.message}</b>
                  <span>{formatTime(a.triggeredAt)}</span>
                </div>
              ))
          ) : (
            <Empty
              title="No recent events"
              detail="There are no sample alerts for this device."
            />
          )}
        </Card>
      )}
      {tab === "configuration" && (
        <Card className="padded">
          <PanelHead
            title="Device configuration"
            detail="Metadata in the demo state"
          />
          <div className="key-values">
            {[
              ["Farm", farmName(d.farmId)],
              ["Zone", zoneName(d.zoneId)],
              ["Model", d.model],
              ["Protocol", d.protocol],
              ["Interval", `${d.intervalSeconds} sec`],
              ["Tags", d.tags.join(", ") || "None"],
            ].map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
          </div>
          <p className="hint">
            Device side commands are unavailable without a connected backend
            command channel.
          </p>
          <Button onClick={() => setModal("edit")}>Edit metadata</Button>
        </Card>
      )}
      {modal === "edit" && (
        <Modal title="Edit demo device" onClose={() => setModal(null)}>
          <DeviceForm
            device={d}
            devices={devices}
            onSave={save}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal === "delete" && (
        <Modal title="Delete demo device?" onClose={() => setModal(null)}>
          <p className="modal-copy">
            Remove {d.name} from the browser's demo state?
          </p>
          <div className="form-actions">
            <Button onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="danger" onClick={del}>
              Delete device
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function TelemetryTable({ rows }: { rows: Telemetry[] }) {
  return rows.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Timestamp (Asia/Jakarta)</th>
            <th>Device</th>
            <th>Sensor</th>
            <th>Value</th>
            <th>Quality</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = initialSensors.find((s) => s.id === r.sensorId);
            return (
              <tr key={r.id}>
                <td>{formatTime(r.timestamp)}</td>
                <td>{r.deviceId}</td>
                <td>{s?.name || r.sensorId}</td>
                <td className="number">
                  {r.quality === "missing" ? "—" : fmt(r.value, s?.unit)}
                </td>
                <td>
                  <Badge>{r.quality}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      title="No telemetry in this range"
      detail="Select another sensor or time range."
    />
  );
}

function Analytics({ devices, farm, go, notify }: PageProps) {
  const scoped = devices.filter((d) => farm === "all" || d.farmId === farm);
  const sensors = initialSensors.filter((s) =>
    scoped.some((d) => d.id === s.deviceId),
  );
  const initial = new URLSearchParams(location.search).get("sensor") || "";
  const [sensorId, setSensorId] = useState(initial);
  const [range, setRange] = useState("24H");
  const [compare, setCompare] = useState(true);
  const s = sensors.find((x) => x.id === sensorId) || sensors[0];
  const d = devices.find((x) => x.id === s?.deviceId);
  const count =
    range === "1H" ? 2 : range === "6H" ? 7 : range === "24H" ? 24 : 168;
  const rows = initialTelemetry
    .filter((t) => t.sensorId === s?.id)
    .slice(-count)
    .filter((t) => t.quality === "valid");
  const vals = rows.map((r) => r.value);
  const stats = [
    ["Latest", s && s.quality === "valid" ? fmt(s.value, s.unit) : "—"],
    ["Minimum", vals.length ? fmt(Math.min(...vals), s.unit) : "—"],
    ["Maximum", vals.length ? fmt(Math.max(...vals), s.unit) : "—"],
    [
      "Average",
      vals.length
        ? fmt(vals.reduce((a, b) => a + b, 0) / vals.length, s.unit)
        : "—",
    ],
    ["Valid samples", `${rows.length}/${count}`],
    ["Reading count", rows.length.toString()],
  ];
  return (
    <>
      <PageHead
        title="Sensor Analytics"
        description="Explore agricultural conditions with compatible units and clear aggregation."
        actions={
          <Button
            onClick={() => {
              if (s) {
                demoService.exportTelemetry(rows, `${s.id}-analytics.csv`);
                notify("Analytics CSV downloaded.");
              }
            }}
          >
            <Download size={16} /> Export data
          </Button>
        }
      />
      <Card className="padded">
        <div className="filter-bar">
          <LabelSelect
            label="Sensor channel"
            value={s?.id || ""}
            onChange={setSensorId}
            options={sensors.map((x) => [
              x.id,
              `${x.name} · ${devices.find((d) => d.id === x.deviceId)?.name}`,
            ])}
          />
          <LabelSelect
            label="Time range"
            value={range}
            onChange={setRange}
            options={["1H", "6H", "24H", "7D", "30D"].map((x) => [x, x])}
          />
          <label className="check-control">
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => setCompare(e.target.checked)}
            />{" "}
            Previous period
          </label>
        </div>
      </Card>
      <div className="analytics-stats">
        {stats.map(([a, b]) => (
          <Card className="mini-stat" key={a}>
            <span>{a}</span>
            <strong>{b}</strong>
          </Card>
        ))}
      </div>
      <Card className="padded chart-card">
        <PanelHead
          title={s ? `${s.name} trend` : "No sensor selected"}
          detail={`${d?.name || "No device"} · ${s?.unit || "—"} · Hourly demo samples · Asia/Jakarta`}
          action={<Badge>Demo data</Badge>}
        />
        {s && d ? (
          <TrendChart
            sensor={s}
            device={d}
            range={range}
            showPrevious={compare}
          />
        ) : (
          <Empty
            title="No sensors"
            detail="This farm has no configured sensor channels."
          />
        )}
        <p className="hint">
          {range === "30D"
            ? "Only the latest seven days are available in the demo dataset. "
            : ""}
          A threshold crossing is informational until verified against device
          diagnostics and crop configuration.
        </p>
      </Card>
      <div className="two-column">
        <Card className="padded">
          <PanelHead
            title="Distribution"
            detail="Hourly readings across the selected period"
          />
          {s && vals.length ? (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={rows.map((r, i) => ({ x: i, value: r.value }))}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="x" hide />
                <YAxis
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  width={45}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                />
                <Area
                  dataKey="value"
                  stroke="var(--primary)"
                  fill="var(--chart-fill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Empty title="No readings" detail="Choose another range." />
          )}
        </Card>
        <Card className="padded">
          <PanelHead
            title="Interpretation notes"
            detail="Demo analysis, not agronomic advice"
          />
          <div className="key-values">
            <div>
              <span>Aggregation</span>
              <b>Hourly source samples</b>
            </div>
            <div>
              <span>Data quality</span>
              <b>
                {rows.length}/{count} valid
              </b>
            </div>
            <div>
              <span>Configured range</span>
              <b>
                {s == null || thresholds(s).min == null
                  ? "Not configured"
                  : `${thresholds(s).min}–${thresholds(s).max} ${s.unit}`}
              </b>
            </div>
            <div>
              <span>Timezone</span>
              <b>Asia/Jakarta</b>
            </div>
          </div>
          <Button onClick={() => go("/historical-data")}>
            Inspect raw records
          </Button>
        </Card>
      </div>
    </>
  );
}

function HistoryPage({ devices, farm, notify }: PageProps) {
  const ids = new Set(
    devices.filter((d) => farm === "all" || d.farmId === farm).map((d) => d.id),
  );
  const [query, setQuery] = useState("");
  const [quality, setQuality] = useState("all");
  const [device, setDevice] = useState("all");
  const [sensor, setSensor] = useState("all");
  const [fromDate, setFromDate] = useState("2026-10-11");
  const [toDate, setToDate] = useState("2026-10-18");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(15);
  const [utc, setUtc] = useState(false);
  const [desc, setDesc] = useState(true);
  const rows = useMemo(
    () =>
      initialTelemetry
        .filter(
          (t) =>
            ids.has(t.deviceId) &&
            (device === "all" || t.deviceId === device) &&
            (sensor === "all" || t.sensorId === sensor) &&
            (quality === "all" || t.quality === quality) &&
            t.timestamp.slice(0, 10) >= fromDate &&
            t.timestamp.slice(0, 10) <= toDate &&
            `${t.deviceId} ${initialSensors.find((s) => s.id === t.sensorId)?.name || ""}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          desc
            ? b.timestamp.localeCompare(a.timestamp)
            : a.timestamp.localeCompare(b.timestamp),
        ),
    [farm, devices, query, quality, device, sensor, fromDate, toDate, desc],
  );
  useEffect(
    () => setPage(1),
    [farm, query, quality, device, sensor, fromDate, toDate, size],
  );
  const visible = rows.slice((page - 1) * size, page * size);
  const exportRows = async (type: "csv" | "json") => {
    if (type === "csv")
      await demoService.exportTelemetry(rows, "agrivaid-telemetry.csv");
    else
      downloadFile(
        "agrivaid-telemetry.json",
        JSON.stringify(rows, null, 2),
        "application/json",
      );
    notify(`${type.toUpperCase()} export downloaded with current filters.`);
  };
  return (
    <>
      <PageHead
        title="Historical Data"
        description="Explore raw demo telemetry with explicit quality and time context."
        actions={
          <>
            <Button onClick={() => exportRows("json")}>JSON</Button>
            <Button onClick={() => exportRows("csv")}>
              <Download size={16} /> Export CSV
            </Button>
          </>
        }
      />
      <Card className="padded">
        <div className="filter-bar">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search device or sensor"
          />
          <label className="compact-date">
            From
            <input
              aria-label="From date"
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>
          <label className="compact-date">
            To
            <input
              aria-label="To date"
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>
          <select
            value={device}
            onChange={(e) => setDevice(e.target.value)}
            aria-label="Device filter"
          >
            <option value="all">All devices</option>
            {devices
              .filter((d) => ids.has(d.id))
              .map((d) => (
                <option value={d.id} key={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
          <select
            value={sensor}
            onChange={(e) => setSensor(e.target.value)}
            aria-label="Sensor filter"
          >
            <option value="all">All sensors</option>
            {initialSensors
              .filter((s) => ids.has(s.deviceId))
              .map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name} · {s.deviceId}
                </option>
              ))}
          </select>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            aria-label="Quality filter"
          >
            <option value="all">All quality</option>
            <option value="valid">Valid</option>
            <option value="missing">Missing</option>
            <option value="suspect">Suspect</option>
          </select>
          <select
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            aria-label="Rows per page"
          >
            <option value={15}>15 rows</option>
            <option value={30}>30 rows</option>
            <option value={50}>50 rows</option>
          </select>
          <label className="check-control">
            <input
              type="checkbox"
              checked={utc}
              onChange={(e) => setUtc(e.target.checked)}
            />{" "}
            UTC
          </label>
          <button
            className="text-action"
            onClick={() => {
              setQuery("");
              setQuality("all");
              setDevice("all");
              setSensor("all");
              setFromDate("2026-10-11");
              setToDate("2026-10-18");
            }}
          >
            Reset
          </button>
        </div>
        <div className="filter-summary">
          <CalendarDays size={14} /> {rows.length.toLocaleString()} records ·
          {fromDate} to {toDate} · {utc ? "UTC" : "Asia/Jakarta"} · Demo data
        </div>
        {visible.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>
                      <button
                        className="sort-button"
                        onClick={() => setDesc(!desc)}
                      >
                        Timestamp {desc ? "↓" : "↑"}
                      </button>
                    </th>
                    <th>Device</th>
                    <th>Sensor</th>
                    <th>Reading</th>
                    <th>Quality</th>
                    <th>Farm / zone</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const d = devices.find((d) => d.id === r.deviceId);
                    const s = initialSensors.find((s) => s.id === r.sensorId);
                    return (
                      <tr key={r.id}>
                        <td>
                          {utc
                            ? r.timestamp.replace("T", " ").slice(0, 16) +
                              " UTC"
                            : formatTime(r.timestamp)}
                        </td>
                        <td>
                          <b>{d?.name || "Removed device"}</b>
                          <small>{r.deviceId}</small>
                        </td>
                        <td>{s?.name || r.sensorId}</td>
                        <td className="number">
                          {r.quality === "missing"
                            ? "—"
                            : fmt(r.value, s?.unit)}
                        </td>
                        <td>
                          <Badge>{r.quality}</Badge>
                        </td>
                        <td>{d ? deviceFarm(d) : "Not available"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager
              page={page}
              setPage={setPage}
              total={rows.length}
              size={size}
            />
          </>
        ) : (
          <Empty
            title="No telemetry matches"
            detail="Change the filters to see historical records."
          />
        )}
      </Card>
    </>
  );
}

function AlertsPage({ devices, alerts, farm, go, notify, refresh }: PageProps) {
  const scoped = alerts.filter(
    (a) =>
      farm === "all" ||
      devices.find((d) => d.id === a.deviceId)?.farmId === farm,
  );
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [state, setState] = useState("all");
  const filtered = scoped.filter(
    (a) =>
      (severity === "all" || a.severity === severity) &&
      (state === "all" ||
        (state === "open" && !a.resolvedAt) ||
        (state === "resolved" && !!a.resolvedAt)) &&
      `${a.message} ${a.deviceId}`.toLowerCase().includes(query.toLowerCase()),
  );
  const acknowledge = async (id: string) => {
    await demoService.acknowledgeAlert(id);
    refresh();
    notify("Demo alert acknowledged.", "success");
  };
  const resolve = (id: string) => {
    const all: Alert[] = read("agrivaid-alerts", initialAlerts);
    const a = all.find((x) => x.id === id);
    if (a) {
      a.resolvedAt = new Date().toISOString();
      localStorage.setItem("agrivaid-alerts", JSON.stringify(all));
      refresh();
      notify("Demo alert resolved.", "success");
    }
  };
  return (
    <>
      <PageHead
        title="Alerts & Notifications"
        description="Review simulated exceptions and record your response."
        actions={
          <Badge>{`${scoped.filter((a) => !a.resolvedAt).length} open`}</Badge>
        }
      />
      <Card className="padded">
        <div className="filter-bar">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search alerts"
          />
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            aria-label="Severity filter"
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="information">Information</option>
          </select>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            aria-label="Resolution filter"
          >
            <option value="all">All states</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Alert</th>
                  <th>Device</th>
                  <th>Reading / threshold</th>
                  <th>Triggered</th>
                  <th>Acknowledgment</th>
                  <th>Resolution</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const d = devices.find((x) => x.id === a.deviceId);
                  return (
                    <tr key={a.id}>
                      <td>
                        <Badge>{a.severity}</Badge>
                      </td>
                      <td>
                        <b>{a.message}</b>
                        <small>{a.id} · simulated</small>
                      </td>
                      <td>
                        <button
                          className="table-link"
                          onClick={() => go(`/devices/${a.deviceId}`)}
                        >
                          {d?.name || a.deviceId}
                        </button>
                        <small>{a.deviceId}</small>
                      </td>
                      <td>
                        {a.current || "—"} / {a.threshold || "—"}
                      </td>
                      <td>{formatTime(a.triggeredAt)}</td>
                      <td>{a.acknowledgedAt ? "Acknowledged" : "Pending"}</td>
                      <td>{a.resolvedAt ? "Resolved" : "Open"}</td>
                      <td>
                        <div className="row-actions">
                          {!a.acknowledgedAt && (
                            <button onClick={() => acknowledge(a.id)}>
                              Acknowledge
                            </button>
                          )}
                          {!a.resolvedAt && (
                            <button onClick={() => resolve(a.id)}>
                              Resolve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No matching alerts"
            detail="Adjust the search or filters to see sample events."
          />
        )}
      </Card>
    </>
  );
}

function Reports({ devices, farm, notify }: PageProps) {
  const [device, setDevice] = useState("all");
  const [format, setFormat] = useState("csv");
  const [range, setRange] = useState("7D");
  const ids = new Set(
    devices
      .filter(
        (d) =>
          (farm === "all" || d.farmId === farm) &&
          (device === "all" || d.id === device),
      )
      .map((d) => d.id),
  );
  const count = range === "24H" ? 24 : 168;
  const rows = initialTelemetry
    .filter((t) => ids.has(t.deviceId))
    .filter(
      (t) => Date.parse(t.timestamp) >= Date.parse(DEMO_NOW) - count * 3600000,
    );
  const exportReport = () => {
    if (format === "csv")
      downloadFile(
        "agrivaid-report.csv",
        csv([
          [
            "Timestamp UTC",
            "Farm",
            "Zone",
            "Device ID",
            "Sensor",
            "Value",
            "Unit",
            "Quality",
          ],
          ...rows.map((r) => {
            const d = devices.find((x) => x.id === r.deviceId);
            const s = initialSensors.find((x) => x.id === r.sensorId);
            return [
              r.timestamp,
              d ? farmName(d.farmId) : "",
              d ? zoneName(d.zoneId) : "",
              r.deviceId,
              s?.name,
              r.quality === "missing" ? "" : r.value,
              s?.unit,
              r.quality,
            ];
          }),
        ]),
        "text/csv",
      );
    else
      downloadFile(
        "agrivaid-report.json",
        JSON.stringify(rows, null, 2),
        "application/json",
      );
    notify(
      `${format.toUpperCase()} report downloaded. ${rows.length.toLocaleString()} records.`,
      `success`,
    );
  };
  return (
    <>
      <PageHead
        title="Reports & Exports"
        description="Create an on demand report from the selected demo farm scope."
        actions={
          <Button onClick={() => window.print()}>
            <FileBarChart size={16} /> Printable view
          </Button>
        }
      />
      <div className="two-column reports-layout">
        <Card className="padded">
          <PanelHead
            title="Report builder"
            detail="Choose a scope, period, and supported output"
          />
          <div className="report-form">
            <LabelSelect
              label="Farm"
              value={farm}
              onChange={() => {}}
              options={[
                [farm, farm === "all" ? "All demo farms" : farmName(farm)],
              ]}
            />
            <LabelSelect
              label="Device"
              value={device}
              onChange={setDevice}
              options={[
                ["all", "All devices"],
                ...devices
                  .filter((d) => farm === "all" || d.farmId === farm)
                  .map((d) => [d.id, d.name] as [string, string]),
              ]}
            />
            <LabelSelect
              label="Period"
              value={range}
              onChange={setRange}
              options={[
                ["24H", "Last 24 hours"],
                ["7D", "Last 7 days"],
              ]}
            />
            <LabelSelect
              label="Format"
              value={format}
              onChange={setFormat}
              options={[
                ["csv", "CSV telemetry"],
                ["json", "JSON records"],
              ]}
            />
            <Button variant="primary" onClick={exportReport}>
              <ArrowDownToLine size={16} /> Download {format.toUpperCase()}
            </Button>
          </div>
          <p className="hint">
            PDF generation and scheduled delivery require a configured backend.
            Printing uses your browser's print dialog.
          </p>
        </Card>
        <Card className="padded">
          <PanelHead title="Report preview" detail="Current filters applied" />
          <div className="report-preview">
            <div>
              <span>Farm scope</span>
              <strong>
                {farm === "all" ? "All demo farms" : farmName(farm)}
              </strong>
            </div>
            <div>
              <span>Period</span>
              <strong>{range === "24H" ? "24 hours" : "7 days"}</strong>
            </div>
            <div>
              <span>Devices</span>
              <strong>{ids.size}</strong>
            </div>
            <div>
              <span>Telemetry rows</span>
              <strong>{rows.length.toLocaleString()}</strong>
            </div>
            <div>
              <span>Timezone</span>
              <strong>UTC source / Asia/Jakarta display</strong>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function Profile({
  farm,
  notify,
  theme,
  setTheme,
}: {
  farm: string;
  notify: (m: string, k?: "error" | "success") => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}) {
  const [name, setName] = useState(
    read("agrivaid-profile-name", "Alex Morgan"),
  );
  const [job, setJob] = useState(
    read("agrivaid-profile-job", "Farm Operations Manager"),
  );
  const [timezone, setTimezone] = useState(
    read("agrivaid-timezone", "Asia/Jakarta"),
  );
  const save = () => {
    if (!name.trim()) {
      notify("Full name is required.", "error");
      return;
    }
    localStorage.setItem("agrivaid-profile-name", JSON.stringify(name.trim()));
    localStorage.setItem("agrivaid-profile-job", JSON.stringify(job));
    localStorage.setItem("agrivaid-timezone", JSON.stringify(timezone));
    notify("Demo profile saved in this browser.", "success");
  };
  return (
    <>
      <PageHead
        title="User Profile"
        description="Manage your demo identity and display preferences."
        actions={
          <Button variant="primary" onClick={save}>
            Save changes
          </Button>
        }
      />
      <div className="settings-stack">
        <Card className="padded">
          <PanelHead
            title="Personal information"
            detail="Editable demo profile"
          />
          <div className="profile-intro">
            <span className="avatar large">AM</span>
            <div>
              <b>{name}</b>
              <span>Demo administrator · AgrivaID</span>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Full name
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Job title
              <input value={job} onChange={(e) => setJob(e.target.value)} />
            </label>
            <label>
              Work email
              <input value="alex@agrivaid.example" disabled />
            </label>
            <label>
              Organization
              <input value="AgrivaID Demo Workspace" disabled />
            </label>
          </div>
        </Card>
        <Card className="padded">
          <PanelHead title="Preferences" detail="Applied to this browser" />
          <div className="form-grid">
            <LabelSelect
              label="Theme"
              value={theme}
              onChange={(v) => setTheme(v as Theme)}
              options={[
                ["light", "Light"],
                ["dark", "Dark"],
                ["system", "System"],
              ]}
            />
            <LabelSelect
              label="Timezone"
              value={timezone}
              onChange={setTimezone}
              options={[
                ["Asia/Jakarta", "Asia/Jakarta (UTC+7)"],
                ["UTC", "UTC"],
              ]}
            />
            <label>
              Default farm
              <input
                value={farm === "all" ? "All demo farms" : farmName(farm)}
                disabled
              />
            </label>
            <label>
              Temperature unit
              <input value="Celsius (°C)" disabled />
            </label>
          </div>
        </Card>
        <Card className="padded">
          <PanelHead
            title="Security & account"
            detail="Authentication provider not configured"
          />
          <div className="key-values">
            <div>
              <span>Role</span>
              <b>Demo administrator</b>
            </div>
            <div>
              <span>Two factor authentication</span>
              <b>Unavailable in demo mode</b>
            </div>
            <div>
              <span>Session management</span>
              <b>Browser local demo session</b>
            </div>
            <div>
              <span>Account creation date</span>
              <b>Not available</b>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function SettingsPage({
  farm,
  notify,
  theme,
  setTheme,
}: {
  farm: string;
  notify: (m: string, k?: "error" | "success") => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}) {
  const [tab, setTab] = useState("general");
  const [min, setMin] = useState(read("agrivaid-soil-min", "25"));
  const [max, setMax] = useState(read("agrivaid-soil-max", "65"));
  const [inApp, setInApp] = useState(read("agrivaid-notify", true));
  const save = () => {
    if (Number(min) >= Number(max)) {
      notify("Minimum threshold must be below maximum.", "error");
      return;
    }
    localStorage.setItem("agrivaid-soil-min", JSON.stringify(min));
    localStorage.setItem("agrivaid-soil-max", JSON.stringify(max));
    localStorage.setItem("agrivaid-notify", JSON.stringify(inApp));
    notify("Demo settings saved.", "success");
  };
  return (
    <>
      <PageHead
        title="Settings"
        description="Configure this browser's demo workspace preferences."
        actions={
          <Button variant="primary" onClick={save}>
            Save changes
          </Button>
        }
      />
      <div className="settings-layout">
        <Card className="settings-menu">
          {[
            ["general", "General"],
            ["farms", "Farms & zones"],
            ["thresholds", "Sensor thresholds"],
            ["notifications", "Notifications"],
            ["integrations", "Integrations"],
            ["team", "Team & permissions"],
          ].map(([k, n]) => (
            <button
              key={k}
              className={tab === k ? "active" : ""}
              onClick={() => setTab(k)}
            >
              {n}
            </button>
          ))}
        </Card>
        <div>
          {tab === "general" && (
            <Card className="padded">
              <PanelHead
                title="General preferences"
                detail="Browser local settings for the demo"
              />
              <div className="form-grid">
                <LabelSelect
                  label="Theme"
                  value={theme}
                  onChange={(v) => setTheme(v as Theme)}
                  options={[
                    ["light", "Light"],
                    ["dark", "Dark"],
                    ["system", "System"],
                  ]}
                />
                <label>
                  Active farm
                  <input
                    value={farm === "all" ? "All demo farms" : farmName(farm)}
                    disabled
                  />
                </label>
                <label>
                  Display timezone
                  <input value="Asia/Jakarta (UTC+7)" disabled />
                </label>
                <label>
                  Language
                  <input value="English" disabled />
                </label>
              </div>
            </Card>
          )}
          {tab === "farms" && (
            <Card className="padded">
              <PanelHead
                title="Farms & zones"
                detail="Demo portfolio metadata"
              />
              {farms.map((f) => (
                <div className="farm-row" key={f.id}>
                  <span className="farm-icon">
                    <Leaf size={18} />
                  </span>
                  <div>
                    <b>{f.name}</b>
                    <small>
                      {f.location} ·{" "}
                      {zones
                        .filter((z) => z.farmId === f.id)
                        .map((z) => z.name)
                        .join(", ")}
                    </small>
                  </div>
                </div>
              ))}
            </Card>
          )}
          {tab === "thresholds" && (
            <Card className="padded">
              <PanelHead
                title="Soil moisture thresholds"
                detail="Configurable demo range for the selected measurement"
              />
              <div className="form-grid">
                <label>
                  Minimum (%)
                  <input
                    type="number"
                    value={min}
                    onChange={(e) => setMin(e.target.value)}
                  />
                </label>
                <label>
                  Maximum (%)
                  <input
                    type="number"
                    value={max}
                    onChange={(e) => setMax(e.target.value)}
                  />
                </label>
              </div>
              <p className="hint">
                These are example monitoring thresholds. Crop guidance requires
                crop and soil context.
              </p>
            </Card>
          )}
          {tab === "notifications" && (
            <Card className="padded">
              <PanelHead
                title="Notifications"
                detail="Demo browser preferences"
              />
              <label className="setting-toggle">
                <span>
                  <b>In app alerts</b>
                  <small>Show monitoring events in the alert center</small>
                </span>
                <input
                  type="checkbox"
                  checked={inApp}
                  onChange={(e) => setInApp(e.target.checked)}
                />
              </label>
              <div className="key-values">
                <div>
                  <span>Email delivery</span>
                  <b>Not configured</b>
                </div>
              </div>
            </Card>
          )}
          {tab === "integrations" && (
            <Card className="padded">
              <PanelHead
                title="Integrations"
                detail="No live data connection is configured"
              />
              <div className="key-values">
                {[
                  ["MQTT ingestion", "Not configured"],
                  ["HTTP ingestion endpoint", "Not configured"],
                  ["Supabase Auth & database", "Not configured"],
                  ["Realtime subscription", "Not configured"],
                  ["Last successful live ingestion", "Not available"],
                ].map(([a, b]) => (
                  <div key={a}>
                    <span>{a}</span>
                    <b>{b}</b>
                  </div>
                ))}
              </div>
              <p className="hint">
                MQTT, RS485, UART, and SDI-12 device data require a backend
                ingestion bridge. The browser stores no broker credentials.
              </p>
            </Card>
          )}
          {tab === "team" && (
            <Card className="padded">
              <PanelHead
                title="Team & permissions"
                detail="Requires configured authentication and backend authorization"
              />
              <Empty
                title="Team management unavailable"
                detail="Connect an authentication provider and organization scoped access control before inviting members."
              />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function AuthPage({
  path,
  go,
  login,
  notify,
}: {
  path: string;
  go: (p: string) => void;
  login: () => void;
  notify: (s: string, k?: "error" | "success") => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [terms, setTerms] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const signup = path === "/signup",
    forgot = path === "/forgot-password",
    reset = path === "/reset-password";
  const title = signup
    ? "Create your account"
    : forgot
      ? "Reset your password"
      : reset
        ? "Choose a new password"
        : "Welcome back";
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!reset && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError("Enter a valid email address.");
      return;
    }
    if (signup && (!name.trim() || !org.trim())) {
      setError("Full name and farm or organization are required.");
      return;
    }
    if (!forgot && password.length < 8) {
      setError("Use at least 8 characters for the password.");
      return;
    }
    if ((signup || reset) && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (signup && !terms) {
      setError("Accept the terms to continue.");
      return;
    }
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      if (forgot)
        setSuccess(
          "If an account exists, a reset request would be sent by the configured provider. Email delivery is unavailable in demo mode.",
        );
      else if (reset)
        setError(
          "Password reset is unavailable: no authentication provider or valid reset token is configured.",
        );
      else if (signup)
        setSuccess(
          "Form validated. Account creation and email verification require a configured authentication provider. Try demo access below.",
        );
      else
        setError(
          "Production sign in is unavailable. Use “Enter demo workspace” to explore simulated data.",
        );
    }, 350);
  };
  return (
    <div className="auth-page">
      <aside className="auth-side">
        <Brand />
        <div className="auth-message">
          <span className="auth-kicker">
            <span className="status-pulse" /> SMART FARMING INTELLIGENCE
          </span>
          <h1>
            See your fields
            <br />
            with clarity.
          </h1>
          <p>
            Track field conditions, inspect devices, and turn telemetry into
            useful decisions across your farm portfolio.
          </p>
          <div className="auth-tiles">
            <div>
              <b>12</b>
              <span>sample devices</span>
            </div>
            <div>
              <b>3</b>
              <span>demo farms</span>
            </div>
            <div>
              <b>7d</b>
              <span>sensor history</span>
            </div>
          </div>
        </div>
        <small>
          Illustrative product demo · no live hardware or secure account
          connection
        </small>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-form-card">
          <div className="auth-label">AGRIVAID ACCOUNT</div>
          <h2>{title}</h2>
          <p>
            {signup
              ? "Set up your smart agriculture workspace."
              : forgot
                ? "Enter your email to request recovery."
                : reset
                  ? "Create a stronger password for your account."
                  : "Sign in to your monitoring workspace."}
          </p>
          {reset && (
            <p className="auth-error" role="status">
              No valid reset token is configured for this demo. Password changes
              require a connected authentication provider.
            </p>
          )}
          <form onSubmit={submit} noValidate>
            {signup && (
              <>
                <label>
                  Full name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </label>
                <label>
                  Farm or organization
                  <input
                    value={org}
                    onChange={(e) => setOrg(e.target.value)}
                    required
                  />
                </label>
              </>
            )}
            {!reset && (
              <label>
                Work email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@farm.com"
                  required
                />
              </label>
            )}
            {!forgot && (
              <label>
                {reset ? "New password" : "Password"}
                <span className="password-field">
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={signup ? "new-password" : "current-password"}
                    required
                  />
                  <button type="button" onClick={() => setShow(!show)}>
                    {show ? "Hide" : "Show"}
                  </button>
                </span>
              </label>
            )}
            {(signup || reset) && (
              <>
                <label>
                  Confirm password
                  <input
                    type={show ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </label>
                <div className="password-strength">
                  <span
                    style={{ width: `${Math.min(password.length * 10, 100)}%` }}
                  />
                </div>
                <small className="muted">
                  Password strength:{" "}
                  {password.length >= 12
                    ? "strong"
                    : password.length >= 8
                      ? "moderate"
                      : "needs at least 8 characters"}
                </small>
              </>
            )}
            {signup && (
              <label className="terms">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                />{" "}
                I agree to the{" "}
                <button
                  type="button"
                  className="inline-link"
                  onClick={() => setLegal("terms")}
                >
                  Terms
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  className="inline-link"
                  onClick={() => setLegal("privacy")}
                >
                  Privacy Policy
                </button>
              </label>
            )}
            {!signup && !forgot && !reset && (
              <div className="auth-options">
                <label>
                  <input type="checkbox" defaultChecked /> Remember this browser
                </label>
                <button type="button" onClick={() => go("/forgot-password")}>
                  Forgot password?
                </button>
              </div>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="auth-success" role="status">
                {success}
              </p>
            )}
            <Button variant="primary" type="submit" disabled={busy}>
              {busy
                ? "Checking…"
                : signup
                  ? "Create account"
                  : forgot
                    ? "Request reset"
                    : reset
                      ? "Reset password"
                      : "Sign in"}
            </Button>
          </form>
          <div className="auth-divider">or</div>
          <Button
            onClick={() => {
              login();
              notify(
                "Demo session started. No live data is connected.",
                "success",
              );
            }}
          >
            <Leaf size={16} /> Enter demo workspace
          </Button>
          <p className="auth-switch">
            {signup || forgot || reset ? (
              <>
                Already have access?{" "}
                <button onClick={() => go("/login")}>Sign in</button>
              </>
            ) : (
              <>
                New to AgrivaID?{" "}
                <button onClick={() => go("/signup")}>Create account</button>
              </>
            )}
          </p>
        </div>
      </main>
      {legal && (
        <Modal
          title={legal === "terms" ? "Terms of Service" : "Privacy Policy"}
          onClose={() => setLegal(null)}
        >
          <p className="modal-copy">
            This is a local product demo. A production{" "}
            {legal === "terms" ? "Terms of Service" : "Privacy Policy"} has not
            been configured. No account or data is submitted by this form.
          </p>
          <div className="form-actions">
            <Button onClick={() => setLegal(null)}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function App() {
  const [path, go] = useRoute();
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem("agrivaid-theme") as Theme) || "system",
  );
  const [farm, setFarmState] = useState(
    () => localStorage.getItem("agrivaid-farm") || "all",
  );
  const [session, setSession] = useState(
    () => localStorage.getItem("agrivaid-demo-session") === "true",
  );
  const [devices, setDevices] = useState<Device[]>(() =>
    read("agrivaid-devices", initialDevices),
  );
  const [alerts, setAlerts] = useState<Alert[]>(() =>
    read("agrivaid-alerts", initialAlerts),
  );
  const [notice, setNotice] = useState<Notice | null>(null);
  const refresh = () => {
    setDevices(read("agrivaid-devices", initialDevices));
    setAlerts(read("agrivaid-alerts", initialAlerts));
  };
  const notify = (text: string, kind: "error" | "success" = "success") => {
    setNotice({ text, kind });
    setTimeout(() => setNotice(null), 3600);
  };
  const setTheme = (v: Theme) => {
    setThemeState(v);
    localStorage.setItem("agrivaid-theme", v);
  };
  const setFarm = (v: string) => {
    setFarmState(v);
    localStorage.setItem("agrivaid-farm", v);
  };
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system"
          ? matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : theme;
    };
    apply();
    const m = matchMedia("(prefers-color-scheme: dark)");
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    if (!session && !isPublic(path)) {
      sessionStorage.setItem("agrivaid-return", path + location.search);
      go("/login");
    } else if (session && isPublic(path)) go("/dashboard");
  }, [session, path]);
  const login = () => {
    localStorage.setItem("agrivaid-demo-session", "true");
    setSession(true);
    const target = sessionStorage.getItem("agrivaid-return") || "/dashboard";
    sessionStorage.removeItem("agrivaid-return");
    go(target);
  };
  const logout = () => {
    localStorage.removeItem("agrivaid-demo-session");
    setSession(false);
    go("/login");
  };
  const props = { devices, alerts, farm, go, notify, refresh };
  let page: React.ReactNode = null;
  if (!session && isPublic(path))
    page = <AuthPage path={path} go={go} login={login} notify={notify} />;
  else if (session) {
    if (path === "/dashboard") page = <Dashboard {...props} />;
    else if (path === "/devices") page = <Devices {...props} />;
    else if (path.startsWith("/devices/"))
      page = (
        <DeviceDetail {...props} id={decodeURIComponent(path.split("/")[2])} />
      );
    else if (path === "/analytics") page = <Analytics {...props} />;
    else if (path === "/historical-data") page = <HistoryPage {...props} />;
    else if (path === "/alerts") page = <AlertsPage {...props} />;
    else if (path === "/reports") page = <Reports {...props} />;
    else if (path === "/firmware-ota") page = <FirmwareOta devices={devices} farm={farm} refresh={refresh} />;
    else if (path === "/profile")
      page = (
        <Profile
          farm={farm}
          notify={notify}
          theme={theme}
          setTheme={setTheme}
        />
      );
    else if (path === "/settings")
      page = (
        <SettingsPage
          farm={farm}
          notify={notify}
          theme={theme}
          setTheme={setTheme}
        />
      );
    else
      page = (
        <Empty
          title="Page unavailable"
          detail="Choose a destination from the main navigation."
        />
      );
  }
  return (
    <>
      {session ? (
        <AppShell
          path={path}
          go={go}
          theme={theme}
          setTheme={setTheme}
          farm={farm}
          setFarm={setFarm}
          devices={devices}
          alerts={alerts}
          logout={logout}
        >
          {page}
        </AppShell>
      ) : (
        page
      )}
      {notice && (
        <div className={`toast ${notice.kind}`} role="status">
          <Check size={17} />
          {notice.text}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}

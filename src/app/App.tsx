import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  TabletSmartphone as DeviceTablet,
  Download,
  FileBarChart,
  Filter,
  CloudUpload,
  Grid2X2,
  History,
  Info,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  RadioTower,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Trash2,
  UserRound,
  Wifi,
  X,
  Pencil,
  Users,
  Shield,
  Server,
} from "lucide-react";
import type { Alert, Device, Sensor, Telemetry } from "../shared/types/domain";
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
  onDataUpdate,
  replaceRegisteredSensors,
  updateLiveData,
  updateSensor,
  zoneName,
  zones,
} from "../store/liveData";
import {
  fetchDeviceData,
  saveSensorChannelConfiguration,
} from "../services/sensorApi";
import { createCompany, createSensorChannel, deleteCompany, deleteRegisteredDevice, deleteSensorChannel, getCompany, listCompanies, listRegisteredDevices, listRegisteredSensors, saveRegisteredDevice, updateCompany, type Company } from "../services/registry";
import { demoService } from "../services/dataService";
import DeviceMap from "../features/dashboard/components/DeviceMap";
import FirmwareOta from "../features/firmware/components/FirmwareOta";
import DeviceMonitor from "../features/devices/components/DeviceMonitor";
import { deviceKind, devicePosition, kindLabels } from "../features/devices/lib/deviceGeo";
import { supabase, signIn, signUp, signOut, createRole, deleteRole, deleteUser, getCompanyName, getCurrentProfile, getUserPermissions, listRoles, updateRole, type AppRole, type UserProfile, type Permission, type Role, ROLE_LABELS, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "../services/supabase";

const POLL_INTERVAL = 15 * 1000;

function useLiveData(devices: Device[], onReading: (deviceId: string) => void) {
  const [, tick] = useState(0);
  const prevValues = useRef<Map<string, number>>(new Map());
  const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      const results = await Promise.all(
        devices.map((device) => fetchDeviceData(device.id)),
      );
      if (mounted) {
        const changed = new Set<string>();
        for (const [index, result] of results.entries()) {
          if (!result) continue;
          for (const s of result.sensors) {
            if (s.quality === "valid" && prevValues.current.get(s.id) !== s.value) {
              changed.add(s.id);
              prevValues.current.set(s.id, s.value);
            }
          }
          updateLiveData(result.sensors, result.telemetry, result.lastSeen);
          onReading(devices[index].id);
        }
        if (changed.size > 0) {
          setUpdatedIds(changed);
          setTimeout(() => setUpdatedIds(new Set()), 1500);
        }
      }
    };
    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    const unsub = onDataUpdate(() => tick((n) => n + 1));
    return () => { mounted = false; clearInterval(id); unsub(); };
  }, [devices]);

  return updatedIds;
}

type Theme = "light" | "dark" | "system";
type Notice = { text: string; kind?: "error" | "success" };
type PageProps = {
  devices: Device[];
  alerts: Alert[];
  farm: string;
  go: (path: string) => void;
  notify: (text: string, kind?: "error" | "success") => void;
  refresh: () => void;
  updatedSensorIds?: Set<string>;
};
const read = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
};
function loadDevices() {
  return initialDevices;
}
const iconMap = {
  dashboard: Grid2X2,
  devices: DeviceTablet,
  analytics: Activity,
  "historical-data": History,
  alerts: Bell,
  reports: FileBarChart,
  "firmware-ota": CloudUpload,
  company: Building2,
  profile: UserRound,
  settings: SettingsIcon,
};
const nav: [string, string][] = [
  ["dashboard", "Overview"],
  ["devices", "Devices"],
  ["firmware-ota", "Firmware OTA"],
  ["company", "Company"],
];
const badge = (text: string) =>
  `badge ${/critical|offline|missing|error/i.test(text) ? "danger" : /warning|stale|suspect|low/i.test(text) ? "warning" : /information|recent/i.test(text) ? "info" : "success"}`;
const fmt = (v: number, unit = "", decimals?: number) => {
  const d = decimals != null ? decimals : unit === "lux" ? 0 : 1;
  return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals != null ? d : 0, maximumFractionDigits: d }).format(v)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
};
const sinceNow = (iso: string) => {
  const minutes = Math.max(
    1,
    Math.round((Date.parse(DEMO_NOW) - Date.parse(iso)) / 60000),
  );
  if (minutes < 60)
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
};
const alertIcon = { critical: AlertTriangle, warning: Activity, information: Info };
const isPublic = (p: string) =>
  ["/login", "/signup", "/forgot-password", "/reset-password"].includes(p);
const deviceFarm = (d: Device) => d.companyName ?? "No company assigned";
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
function DSTxLogo({ size = 36 }: { size?: number }) {
  return (
    <img src="/images/logo-orange.png" alt="DSTx" width={size} height={size} style={{ objectFit: "contain" }} />
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <DSTxLogo />
      </span>
      <span>
        <b>DSTx</b>
        <small>IoT Solution</small>
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
        <div className="eyebrow">DSTX / OPERATIONS</div>
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
    "dstx-devices.csv",
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

function NotificationPopover({
  devices,
  alerts,
  farm,
  go,
}: {
  devices: Device[];
  alerts: Alert[];
  farm: string;
  go: (p: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const scoped = alerts.filter(
    (a) =>
      farm === "all" ||
      devices.find((d) => d.id === a.deviceId)?.farmId === farm,
  );
  const unresolved = scoped
    .filter((a) => !a.resolvedAt)
    .sort((a, b) => Date.parse(b.triggeredAt) - Date.parse(a.triggeredAt));
  const unread = unresolved.filter((a) => !a.acknowledgedAt).length;
  const shown = unresolved.slice(0, 4);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="notify-wrap" ref={wrap}>
      <button
        className={`icon-button notify-icon ${open ? "active" : ""}`}
        aria-label="View notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={19} />
        {unresolved.length > 0 && <i />}
      </button>
      {open && (
        <div className="notify-panel" role="dialog" aria-label="Notifications">
          <div className="notify-head">
            <b>Notification</b>
            <small>
              You have {unread} unread {unread === 1 ? "message" : "messages"}
            </small>
          </div>
          <div className="notify-section">New</div>
          <div className="notify-list">
            {shown.length ? (
              shown.map((a) => {
                const Icon = alertIcon[a.severity];
                const device = devices.find((d) => d.id === a.deviceId);
                return (
                  <button
                    key={a.id}
                    className="notify-item"
                    onClick={() => {
                      setOpen(false);
                      go(`/devices/${encodeURIComponent(a.deviceId)}`);
                    }}
                  >
                    <span className={`notify-mark ${a.severity}`}>
                      <Icon size={16} />
                    </span>
                    <span className="notify-body">
                      <span className="notify-text">
                        <b>{a.message}</b> on {device?.name || a.deviceId}
                      </span>
                      <span className="notify-time">
                        <Clock size={13} /> {sinceNow(a.triggeredAt)}
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="notify-empty">
                No open demo alerts in the current farm scope.
              </p>
            )}
          </div>
          <button
            className="notify-all"
            onClick={() => {
              setOpen(false);
              go("/devices");
            }}
          >
            View all alerts
          </button>
        </div>
      )}
    </div>
  );
}

function AppShell({
  path,
  go,
  theme,
  setTheme,
  farm,
  devices,
  alerts,
  children,
  logout,
  profile,
}: {
  path: string;
  go: (p: string) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  farm: string;
  devices: Device[];
  alerts: Alert[];
  children: React.ReactNode;
  logout: () => void;
  profile: UserProfile | null;
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
      : path === "/profile" || path === "/settings"
        ? "User Profile"
        : "Settings");
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Brand />
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
              </button>
            );
          })}
        </nav>
        <div className="side-bottom">
          {profile?.role === "admin" && (
            <button
              className={path === "/users" ? "active" : ""}
              onClick={() => {
                go("/users");
                setMobile(false);
              }}
            >
              <Users size={18} /> User Management
            </button>
          )}
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
            <LogOut size={18} /> {profile ? "Sign out" : "Leave demo"}
          </button>
          <div className="side-user">
            <span className="avatar">{profile ? profile.full_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "AM"}</span>
            <span>
              <b>{profile ? profile.full_name : "Alex Morgan"}</b>
              <small>{profile ? ROLE_LABELS[profile.role] : "Demo administrator"}</small>
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
            <NotificationPopover
              devices={devices}
              alerts={alerts}
              farm={farm}
              go={go}
            />
            <button
              className="avatar avatar-btn"
              aria-label="User profile"
              onClick={() => go("/profile")}
            >
              {profile ? profile.full_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "AM"}
            </button>
          </div>
        </header>
        <main className="content">
          {children}
          <footer className="app-footer">
            <span>
              DSTx IoT · Simulated telemetry, last dataset timestamp{" "}
              {formatTime(DEMO_NOW)}
            </span>
            <span>Device connectivity reflects demo state, not hardware</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function SensorCarousel({ devices, go, updatedSensorIds }: { devices: Device[]; go: (p: string) => void; updatedSensorIds?: Set<string> }) {
  const deviceMap = new Map(devices.map((d) => [d.id, d]));
  const allSensors = devices.flatMap((d) => initialSensors.filter((s) => s.deviceId === d.id));
  const deviceKey = devices.map((d) => d.id).join(",");
  const scrollRef = useRef<HTMLDivElement>(null);
  const programmatic = useRef(false);
  const [active, setActive] = useState(1);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !allSensors.length) return;
    const next = Math.min(1, allSensors.length - 1);
    setActive(next);
    const frame = requestAnimationFrame(() => {
      const card = el.children[next] as HTMLElement | undefined;
      if (card) el.scrollLeft = card.offsetLeft - el.offsetWidth / 2 + card.offsetWidth / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, [deviceKey]);
  const goTo = (idx: number) => {
    const next = Math.max(0, Math.min(allSensors.length - 1, idx));
    setActive(next);
    programmatic.current = true;
    const el = scrollRef.current;
    if (!el) return;
    const card = el.children[next] as HTMLElement;
    if (!card) return;
    const offset = card.offsetLeft - el.offsetWidth / 2 + card.offsetWidth / 2;
    el.scrollTo({ left: offset, behavior: "smooth" });
    setTimeout(() => { programmatic.current = false; }, 500);
  };
  const onScroll = () => {
    if (programmatic.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const cards = el.querySelectorAll(".sc-card");
    const center = el.scrollLeft + el.offsetWidth / 2;
    let closest = 0;
    let minDist = Infinity;
    cards.forEach((c, i) => {
      const dist = Math.abs((c as HTMLElement).offsetLeft + (c as HTMLElement).offsetWidth / 2 - center);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setActive(closest);
  };
  const inRange = (s: Sensor) => {
    if (s.quality === "missing") return false;
    if (s.min != null && s.value < s.min) return false;
    if (s.max != null && s.value > s.max) return false;
    return true;
  };
  if (!allSensors.length) {
    return (
      <div className="sc-wrapper">
        <div className="sc-track">
          <div className="sc-card sc-active" role="status">
            <div className="sc-card-inner">
              <span className="sc-sensor-name">No sensor parameter</span>
              <span className="sc-value sc-warn">—</span>
              <span className="sc-unit">&nbsp;</span>
              <span className="sc-range sc-range-warn">No sensor ID configured</span>
              <span className="sc-id sc-id-active">—</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="sc-section">
      <div className="sc-wrapper">
        <button className="sc-arrow sc-arrow-left" onClick={() => goTo(active - 1)} aria-label="Previous reading" disabled={active === 0}><ChevronLeft size={16} /></button>
        <div className="sc-track" ref={scrollRef} onScroll={onScroll}>
          {allSensors.map((s, i) => (
            <button type="button" key={s.id} className={`sc-card ${i === active ? "sc-active" : ""} ${updatedSensorIds?.has(s.id) ? "sc-updated" : ""}`}
              aria-pressed={i === active}
              aria-label={`${s.name}: ${s.quality === "missing" ? "no reading" : `${s.value} ${s.unit}`}. ${i === active ? "Open device details" : "Select reading"}`}
              onClick={() => { if (i !== active) goTo(i); else go(`/devices/${encodeURIComponent(s.deviceId)}`); }}
            >
              <div className="sc-card-inner">
                <span className="sc-sensor-name">{s.name}</span>
                <span className={`sc-value ${inRange(s) ? "" : "sc-warn"}`}>
                  {s.quality === "missing" ? "—" : s.value.toLocaleString("en-US", { minimumFractionDigits: s.decimals ?? 0, maximumFractionDigits: s.decimals ?? 3 })}
                </span>
                <span className="sc-unit">{s.unit}</span>
                <span className={`sc-range ${inRange(s) ? "" : "sc-range-warn"}`}>
                  {s.quality === "missing" ? "No reading" : inRange(s) ? "Normal range" : "Out of range"}
                </span>
                <span className={`sc-id ${i === active ? "sc-id-active" : ""}`}>{s.id}</span>
              </div>
            </button>
          ))}
        </div>
        <button className="sc-arrow sc-arrow-right" onClick={() => goTo(active + 1)} aria-label="Next reading" disabled={active === allSensors.length - 1}><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

function Dashboard({ devices, farm, go, notify, refresh, updatedSensorIds }: PageProps) {
  const scoped = devices.filter((d) => farm === "all" || d.farmId === farm);
  return (
    <>
      <PageHead
        title="Overview"
        description="A clear, welcoming view of your sensors and connected devices."
        actions={
          <span className="updated">Dataset: {formatTime(DEMO_NOW)}</span>
        }
      />
      <div className="overview-section-heading">
        <div className="overview-section-icon"><Activity size={18} /></div>
        <div>
          <h2>Live readings</h2>
          <p>Browse {scoped.length} device{scoped.length === 1 ? "" : "s"}, then open a reading for details.</p>
        </div>
        <span className="overview-section-chip">Updated {formatTime(DEMO_NOW)}</span>
      </div>
      <div className="sc-grid">
        <SensorCarousel devices={scoped} go={go} updatedSensorIds={updatedSensorIds} />
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
            <th>Company</th>
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
              <td>{d.companyName ?? "—"}</td>
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
  onSave,
  onCancel,
  devices,
}: {
  device?: Device;
  onSave: (d: Device) => void | Promise<void>;
  onCancel: () => void;
  devices: Device[];
}) {
  const [form, setForm] = useState<Device>(
    device || {
      id: "",
      farmId: "company",
      zoneId: "default",
      name: "",
      model: "",
      protocol: "MQTT",
      status: "offline",
      lastSeen: DEMO_NOW,
      lastTelemetry: DEMO_NOW,
      intervalSeconds: 60,
      description: "",
      tags: [],
      kind: "climate",
      latitude: -7.2756,
      longitude: 112.7946,
    },
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingInterval] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const change = (key: keyof Device, value: unknown) =>
    setForm({ ...form, [key]: value });

  useEffect(() => {
    void listCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id.trim() || !form.name.trim() || !form.model.trim()) {
      setError("Device ID, name, and model are required.");
      return;
    }
    if (!form.companyId) {
      setError("Select the company that owns this device.");
      return;
    }
    if (
      !Number.isFinite(form.intervalSeconds) ||
      form.intervalSeconds < 0.1
    ) {
      setError("Reporting interval must be at least 0.1 seconds.");
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
    setSaving(true);
    setError("");
    try {
      const id = form.id.trim();
      await onSave({
        ...form,
        id,
        name: form.name.trim(),
        model: form.model.trim(),
        intervalSeconds: form.intervalSeconds,
        ...position,
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save device interval.",
      );
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="form-grid">
      <p className="form-note full">
        Device metadata is stored in the Supabase registry. Telemetry is stored
        separately in MongoDB through the ingestion service.
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
        Reporting interval (seconds)
        <input
          type="number"
          min="0.1"
          step="0.1"
          value={form.intervalSeconds}
          onChange={(e) => change("intervalSeconds", Number(e.target.value))}
          disabled={loadingInterval || saving}
          required
        />
      </label>
      <label>
        Company
        <select value={form.companyId ?? ""} onChange={(event) => change("companyId", event.target.value)} disabled={saving || !companies.length} required>
          <option value="">{companies.length ? "Select company" : "No company available"}</option>
          {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
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
        <input type="number" min="-90" max="90" step="any" value={form.latitude ?? devicePosition(form).latitude} onChange={(e) => change("latitude", Number(e.target.value))} required />
      </label>
      <label>
        Longitude · demo map
        <input type="number" min="-180" max="180" step="any" value={form.longitude ?? devicePosition(form).longitude} onChange={(e) => change("longitude", Number(e.target.value))} required />
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
        <Button onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={saving || loadingInterval}>
          {saving ? "Saving…" : "Save device"}
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
    await saveRegisteredDevice(d);
    refresh();
    setModal(null);
    notify("Device saved to the company registry.", "success");
  };
  const remove = async () => {
    if (!selected) return;
    await deleteRegisteredDevice(selected.id);
    refresh();
    setModal(null);
    notify("Demo device removed.", "success");
  };
  return (
    <>
      <PageHead
        title="Devices"
        description="Manage field nodes, stations, and gateways across your workspace."
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
        <Modal title="Add device" onClose={() => setModal(null)}>
          <DeviceForm
            devices={devices}
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
        <Modal title="Delete device?" onClose={() => setModal(null)}>
          <p className="modal-copy">
            This removes <b>{selected.name}</b> and its sensor registry from
            Supabase. It does not affect physical hardware or historical telemetry.
          </p>
          <div className="form-actions">
            <Button onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="danger" onClick={remove}>
              <Trash2 size={16} /> Delete device
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function SensorEditModal({ sensor, companyId, onClose, notify }: { sensor: Sensor; companyId?: string; onClose: () => void; notify: (m: string, kind?: "error" | "success") => void }) {
  const [name, setName] = useState(sensor.name);
  const [unit, setUnit] = useState(sensor.unit);
  const [min, setMin] = useState(sensor.min != null ? String(sensor.min) : "");
  const [max, setMax] = useState(sensor.max != null ? String(sensor.max) : "");
  const [decimals, setDecimals] = useState(sensor.decimals != null ? String(sensor.decimals) : "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const patch = {
      name: name.trim() || undefined,
      unit: unit.trim(),
      min: min.trim() !== "" ? Number(min) : null,
      max: max.trim() !== "" ? Number(max) : null,
      decimals: decimals.trim() !== "" ? Number(decimals) : null,
    };
    const next: Sensor = {
      ...sensor,
      name: patch.name ?? sensor.name,
      unit: patch.unit,
      min: patch.min ?? undefined,
      max: patch.max ?? undefined,
      decimals: patch.decimals ?? undefined,
    };
    setSaving(true);
    try {
      await saveSensorChannelConfiguration(next, companyId);
      updateSensor(sensor.id, patch);
      notify("Sensor configuration saved to the database.");
      onClose();
    } catch (error) {
      console.error("Unable to save sensor configuration", error);
      notify("Sensor configuration could not be saved to the database.", "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box sensor-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sensor-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 id="sensor-edit-title">Edit sensor</h3>
            <p>Fine-tune the channel display and valid reading range.</p>
          </div>
          <button className="sensor-modal-close" aria-label="Close sensor editor" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="modal-body">
          <div className="sensor-id-row">
            <span>Sensor ID</span>
            <code>{sensor.id}</code>
          </div>
          <label className="modal-label">
            <span>Sensor name</span>
            <input className="ch-edit-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <div className="sensor-form-grid">
            <label className="modal-label">
              <span>Unit</span>
              <input className="ch-edit-input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. %RH" />
            </label>
            <label className="modal-label">
              <span>Decimal places</span>
              <input className="ch-edit-input" value={decimals} onChange={(e) => setDecimals(e.target.value)} type="number" min="0" max="6" placeholder="0–6" />
            </label>
          </div>
          <fieldset className="sensor-range-field">
            <legend>Reading range</legend>
            <div className="ch-range-edit">
              <label><span>Minimum</span><input className="ch-edit-input" placeholder="Min" value={min} onChange={(e) => setMin(e.target.value)} type="number" /></label>
              <i>to</i>
              <label><span>Maximum</span><input className="ch-edit-input" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value)} type="number" /></label>
            </div>
          </fieldset>
        </div>
        <div className="modal-footer">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SensorCreateModal({ deviceId, companyId, onClose, notify, onCreated }: {
  deviceId: string;
  companyId?: string;
  onClose: () => void;
  notify: (message: string, kind?: "error" | "success") => void;
  onCreated: () => void | Promise<void>;
}) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id.trim() || !name.trim() || !type.trim()) {
      notify("Sensor ID, name, and type are required.", "error");
      return;
    }
    setSaving(true);
    try {
      await createSensorChannel({
        id: id.trim(), deviceId, name: name.trim(), type: type.trim(), unit: unit.trim(),
        value: 0, quality: "missing", timestamp: "",
      }, companyId);
      await onCreated();
      notify("Sensor ID saved to the company registry.");
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not create the sensor ID.", "error");
    } finally {
      setSaving(false);
    }
  };
  return <Modal title="Add sensor ID" onClose={onClose}>
    <form onSubmit={save} className="form-grid">
      <p className="form-note full">Only an administrator or a role with sensor-create permission can add a channel.</p>
      <label>Sensor ID<input value={id} onChange={(event) => setId(event.target.value)} placeholder="e.g. RSC-tem" required /></label>
      <label>Sensor name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Air temperature" required /></label>
      <label>Sensor type<input value={type} onChange={(event) => setType(event.target.value)} placeholder="e.g. temperature" required /></label>
      <label>Unit<input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="e.g. °C" /></label>
      <div className="form-actions full"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Create sensor ID"}</Button></div>
    </form>
  </Modal>;
}

function ChannelsTab({ deviceId, companyId, sensors, notify, refresh }: { deviceId: string; companyId?: string; sensors: Sensor[]; notify: (m: string, kind?: "error" | "success") => void; refresh: () => void | Promise<void> }) {
  const [editing, setEditing] = useState<Sensor | null>(null);
  const [creating, setCreating] = useState(false);
  const remove = async (sensor: Sensor) => {
    if (!window.confirm(`Delete sensor ID ${sensor.id}?`)) return;
    try {
      await deleteSensorChannel(sensor.deviceId, sensor.id);
      await refresh();
      notify("Sensor ID deleted.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not delete the sensor ID.", "error");
    }
  };
  return (
    <Card className="padded">
      <div className="split-head"><PanelHead title="Sensor channels" detail={`${sensors.length} configured channels`} /><Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} /> Add sensor ID</Button></div>
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
                <th style={{ width: 60 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sensors.map((s) => (
                <tr key={s.id}>
                  <td><b>{s.name}</b><small>{s.id}</small></td>
                  <td className="number">{s.quality === "missing" ? "—" : fmt(s.value, s.unit, s.decimals)}</td>
                  <td>
                    {thresholds(s).min == null || thresholds(s).max == null
                      ? "Not configured"
                      : `${thresholds(s).min}–${thresholds(s).max} ${s.unit}`}
                  </td>
                  <td><Badge>{s.quality}</Badge></td>
                  <td>{s.quality === "missing" || !s.timestamp ? "—" : timeShort(s.timestamp)}</td>
                  <td><div className="table-actions"><button className="ch-btn ch-btn-edit" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}><Pencil size={14} /></button><button className="ch-btn ch-btn-edit" onClick={() => void remove(s)} aria-label={`Delete ${s.name}`}><Trash2 size={14} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No sensors configured" detail="Create the first sensor ID for this device from the administrator dashboard." />
      )}
      {editing && <SensorEditModal sensor={editing} companyId={companyId} onClose={() => setEditing(null)} notify={notify} />}
      {creating && <SensorCreateModal deviceId={deviceId} companyId={companyId} onClose={() => setCreating(false)} notify={notify} onCreated={refresh} />}
    </Card>
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
    await saveRegisteredDevice(x);
    refresh();
    setModal(null);
    notify("Device metadata saved to the company registry.", "success");
  };
  const del = async () => {
    await deleteRegisteredDevice(d.id);
    refresh();
    setModal(null);
    go("/devices");
    notify("Device deleted from the company registry.", "success");
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
      <div className="tabs">
        {["overview", "channels"].map((t) => (
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
        <DeviceMonitor device={d} sensors={sensors} notify={notify} />
      )}
      {tab === "channels" && (
        <ChannelsTab deviceId={d.id} companyId={d.companyId} sensors={sensors} notify={notify} refresh={refresh} />
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

function Profile({
  farm,
  notify,
  theme,
  setTheme,
  profile,
}: {
  farm: string;
  notify: (m: string, k?: "error" | "success") => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  profile: UserProfile | null;
}) {
  const [name, setName] = useState(
    profile?.full_name ?? read("agrivaid-profile-name", "Alex Morgan"),
  );
  useEffect(() => {
    if (profile?.full_name) setName(profile.full_name);
  }, [profile?.full_name]);
  const [job, setJob] = useState(
    read("agrivaid-profile-job", "Farm Operations Manager"),
  );
  const [timezone, setTimezone] = useState(
    read("agrivaid-timezone", "Asia/Jakarta"),
  );
  const [companyName, setCompanyName] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getCompanyName(profile?.company_id ?? null).then((name) => {
      if (active) setCompanyName(name);
    });
    return () => { active = false; };
  }, [profile?.company_id]);
  const save = async () => {
    if (!name.trim()) {
      notify("Full name is required.", "error");
      return;
    }
    if (profile) {
      try {
        const { error } = await supabase.from("user_profiles").update({ full_name: name.trim(), updated_at: new Date().toISOString() }).eq("id", profile.id);
        if (error) throw error;
        notify("Profile updated.", "success");
      } catch (err: any) {
        notify(err.message || "Failed to save.", "error");
      }
    } else {
      localStorage.setItem("agrivaid-profile-name", JSON.stringify(name.trim()));
      localStorage.setItem("agrivaid-profile-job", JSON.stringify(job));
      localStorage.setItem("agrivaid-timezone", JSON.stringify(timezone));
      notify("Demo profile saved in this browser.", "success");
    }
  };
  return (
    <>
      <PageHead
        title="User Profile"
        description="Manage your account identity and display preferences."
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
            detail={profile ? "Synced with your account" : "Editable demo profile"}
          />
          <div className="profile-intro">
            <span className="avatar large">{profile ? profile.full_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "AM"}</span>
            <div>
              <b>{name}</b>
              <span>{profile ? `${ROLE_LABELS[profile.role]} · ${companyName ?? "No company assigned"}` : "Demo administrator · DSTx"}</span>
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
              <input value={profile?.email ?? "admin@dstx.io"} disabled />
            </label>
            <label>
              Organization
              <input value={companyName ?? "No company assigned"} disabled />
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
            detail={profile ? "Connected to Supabase Auth" : "Authentication provider not configured"}
          />
          <div className="key-values">
            <div>
              <span>Role</span>
              <b>{profile ? ROLE_LABELS[profile.role] : "Demo administrator"}</b>
            </div>
            <div>
              <span>Two factor authentication</span>
              <b>Unavailable in demo mode</b>
            </div>
            <div>
              <span>Session management</span>
              <b>{profile ? "Supabase Auth session" : "Browser local demo session"}</b>
            </div>
            <div>
              <span>Account creation date</span>
              <b>{profile ? formatTime(profile.created_at) : "Not available"}</b>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function CompanyPage({
  profile,
  notify,
  onCompanyChanged,
}: {
  profile: UserProfile | null;
  notify: (message: string, kind?: "error" | "success") => void;
  onCompanyChanged: () => Promise<void>;
}) {
  const [company, setCompany] = useState<Company | null>(null);
  const [creating, setCreating] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [companyProfile, setCompanyProfile] = useState("");
  const [address, setAddress] = useState("");
  const [commodity, setCommodity] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canManage = profile?.role === "admin";

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const [next, allCompanies] = await Promise.all([
        profile?.company_id ? getCompany(profile.company_id) : Promise.resolve(null),
        canManage ? listCompanies() : Promise.resolve([]),
      ]);
      if (active) {
        setCompany(next);
        setCreating(false);
        setCompanies(allCompanies);
        setName(next?.name ?? "");
        setSlug(next?.slug ?? "");
        setCompanyProfile(next?.profile ?? "");
        setAddress(next?.address ?? "");
        setCommodity(next?.commodity ?? "");
        setCompanyNumber(next?.company_number ?? "");
        setLocation(next?.location ?? "");
        setEmail(next?.email ?? "");
        setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [profile?.company_id, canManage]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanName || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
      notify("Enter a company name and a lowercase slug using letters, numbers, or hyphens.", "error");
      return;
    }
    setSaving(true);
    try {
      const details = {
        name: cleanName,
        slug: cleanSlug,
        profile: companyProfile.trim(),
        address: address.trim(),
        commodity: commodity.trim(),
        company_number: companyNumber.trim(),
        location: location.trim(),
        email: email.trim(),
      };
      const next = !creating && company
        ? await updateCompany(company.id, details)
        : await createCompany(cleanName, cleanSlug).then((created) => updateCompany(created.id, details));
      setCompany(next);
      setCreating(false);
      setCompanies(await listCompanies());
      await onCompanyChanged();
      notify(!creating && company ? "Company updated." : "Company created.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save the company.", "error");
    } finally {
      setSaving(false);
    }
  };

  const removeCompany = async (item: Company) => {
    if (!window.confirm(`Delete ${item.name}? Its device and sensor registry will also be deleted. Telemetry in MongoDB is not deleted.`)) return;
    try {
      await deleteCompany(item.id);
      setCompanies((items) => items.filter((current) => current.id !== item.id));
      if (company?.id === item.id) {
        setCompany(null);
        setName("");
        setSlug("");
      }
      await onCompanyChanged();
      notify("Company deleted.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not delete the company.", "error");
    }
  };

  return <>
    <PageHead
      title="Company"
      description="Manage the company that owns users, devices, sensor IDs, and telemetry access."
      actions={canManage ? <Button variant="primary" onClick={() => { setCreating(true); setCompany(null); setName(""); setSlug(""); setCompanyProfile(""); setAddress(""); setCommodity(""); setCompanyNumber(""); setLocation(""); setEmail(""); }}><Plus size={16} /> New Company</Button> : undefined}
    />
    <div className="settings-stack company-page">
      <Card className="padded company-detail-card">
        {!creating && company ? (
          <div className="company-hero">
            <div className="company-monogram" aria-hidden="true">{company.name.slice(0, 2).toUpperCase()}</div>
            <div className="company-hero-copy"><span>COMPANY WORKSPACE</span><h2>{company.name}</h2><p>{company.profile || "Complete the company profile to give your team useful context."}</p></div>
            <div className="company-hero-meta"><span>{company.commodity || "No commodity"}</span><span>{company.location || "Location pending"}</span></div>
          </div>
        ) : <PanelHead title="Create new company" detail="Create a company before registering devices and sensor IDs." />}
        {loading ? <p className="muted">Loading company…</p> : (
          <form onSubmit={save} className="form-grid company-form">
            <div className="company-form-section full"><div><h3>Identity</h3><p>Core details used across the workspace.</p></div></div>
            <label>
              Company name
              <input value={name} onChange={(event) => setName(event.target.value)} disabled={!canManage || saving} required />
            </label>
            <label>
              Company slug
              <input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="dstx-indonesia" disabled={!canManage || saving} required />
            </label>
            <label className="full">Company profile<textarea value={companyProfile} onChange={(event) => setCompanyProfile(event.target.value)} disabled={!canManage || saving} placeholder="Brief company profile" rows={3} /></label>
            <div className="company-form-section full"><div><h3>Contact & location</h3><p>Details for team and operational reference.</p></div></div>
            <label>Company email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={!canManage || saving} placeholder="company@example.com" /></label>
            <label>Company number<input value={companyNumber} onChange={(event) => setCompanyNumber(event.target.value)} disabled={!canManage || saving} placeholder="Phone or registration number" /></label>
            <label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} disabled={!canManage || saving} placeholder="City, province, country" /></label>
            <label>Commodity<input value={commodity} onChange={(event) => setCommodity(event.target.value)} disabled={!canManage || saving} placeholder="e.g. Coffee, rice" /></label>
            <label className="full">Address<textarea value={address} onChange={(event) => setAddress(event.target.value)} disabled={!canManage || saving} placeholder="Full company address" rows={3} /></label>
            {!creating && company && <div className="company-audit full"><span><b>Company ID</b><code>{company.id}</code></span><span><b>Created</b>{formatTime(company.created_at)}</span></div>}
            {!canManage && <p className="hint full">Only a company administrator can create or edit this record.</p>}
            {canManage && <div className="form-actions full">{creating && <Button onClick={() => { setCreating(false); void getCompany(profile?.company_id ?? "").then((current) => { setCompany(current); setName(current?.name ?? ""); setSlug(current?.slug ?? ""); setCompanyProfile(current?.profile ?? ""); setAddress(current?.address ?? ""); setCommodity(current?.commodity ?? ""); setCompanyNumber(current?.company_number ?? ""); setLocation(current?.location ?? ""); setEmail(current?.email ?? ""); }); }}>Cancel</Button>}<Button variant="primary" type="submit" disabled={saving}>{saving ? "Saving…" : !creating && company ? "Save company" : "Create company"}</Button></div>}
          </form>
        )}
      </Card>
      {canManage && <Card className="padded">
        <PanelHead title="All companies" detail={`${companies.length} registered companies`} />
        {companies.length ? <div className="table-scroll"><table><thead><tr><th>Company</th><th>Slug</th><th>Created</th><th>Action</th></tr></thead><tbody>
          {companies.map((item) => <tr key={item.id}><td><b>{item.name}</b><small>{item.id}</small></td><td>{item.slug}</td><td>{formatTime(item.created_at)}</td><td><div className="table-actions"><button className="text-action" onClick={() => { setCreating(false); setCompany(item); setName(item.name); setSlug(item.slug); setCompanyProfile(item.profile); setAddress(item.address); setCommodity(item.commodity); setCompanyNumber(item.company_number); setLocation(item.location); setEmail(item.email); }}>Edit</button><button className="text-action danger" onClick={() => void removeCompany(item)}>Delete</button></div></td></tr>)}
        </tbody></table></div> : <Empty title="No companies" detail="Create the first company to begin registering devices." />}
      </Card>}
    </div>
  </>;
}

const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: "Device", permissions: ["devices.view", "devices.edit", "devices.create", "devices.delete"] },
  { label: "Sensor", permissions: ["sensors.view", "sensors.create", "sensors.edit", "sensors.delete"] },
  { label: "Member", permissions: ["users.view", "users.edit", "users.create", "users.delete"] },
  { label: "Settings", permissions: ["settings.view", "settings.edit"] },
];

const PERM_LABELS: Record<string, string> = {
  "devices.view": "Dapat melihat device",
  "devices.edit": "Dapat mengubah device",
  "devices.create": "Dapat menambah device",
  "devices.delete": "Dapat menghapus device",
  "sensors.view": "Dapat melihat sensor",
  "sensors.create": "Dapat menambah sensor",
  "sensors.edit": "Dapat mengubah sensor",
  "sensors.delete": "Dapat menghapus sensor",
  "users.view": "Dapat melihat anggota",
  "users.edit": "Dapat mengubah anggota",
  "users.create": "Dapat mengundang anggota",
  "users.delete": "Dapat menghapus anggota",
  "settings.view": "Dapat melihat pengaturan",
  "settings.edit": "Dapat mengubah pengaturan",
};

function UserManagement({
  notify,
  profile,
}: {
  notify: (m: string, k?: "error" | "success") => void;
  profile: UserProfile | null;
}) {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const allRoles = roles.map((role) => role.key);
  const [selectedRole, setSelectedRole] = useState<Role>("admin");
  const [tab, setTab] = useState<"users" | "permissions">("users");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newRoleOpen, setNewRoleOpen] = useState(false);

  const [matrix, setMatrix] = useState<Record<string, Set<string>>>(() => {
    const m: Record<string, Set<string>> = {};
    for (const r of allRoles) m[r] = new Set(DEFAULT_ROLE_PERMISSIONS[r]);
    return m;
  });
  const [permLoading, setPermLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("user_profiles").select("*, companies(name)").order("created_at", { ascending: false });
    if (error) notify(error.message, "error");
    else setUsers((data ?? []) as UserProfile[]);
    setLoading(false);
  };

  const loadPermissions = async () => {
    const { data, error } = await supabase.from("role_permissions").select("role, permission");
    if (!error && data && data.length > 0) {
      const m: Record<string, Set<string>> = {};
      for (const r of allRoles) m[r] = new Set<string>();
      for (const row of data) {
        if (m[row.role]) m[row.role].add(row.permission);
      }
      setMatrix(m);
    }
    setPermLoading(false);
  };

  const loadRoles = async () => {
    try {
      const next = await listRoles();
      next.forEach((role) => { ROLE_LABELS[role.key] = role.label; });
      setRoles(next);
      setMatrix((current) => {
        const nextMatrix = { ...current };
        next.forEach((role) => { nextMatrix[role.key] ??= new Set(DEFAULT_ROLE_PERMISSIONS[role.key] ?? []); });
        return nextMatrix;
      });
    } catch (error) { notify(error instanceof Error ? error.message : "Gagal memuat role.", "error"); }
  };

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("um-role-labels") || "{}");
      for (const k of Object.keys(saved)) if (k in ROLE_LABELS) (ROLE_LABELS as any)[k] = saved[k];
    } catch {}
    void loadRoles().then(loadPermissions);
    loadUsers();
  }, []);

  const filteredUsers = users.filter(
    (u) => u.role === selectedRole && (
      !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    )
  );

  const [deleteConfirm, setDeleteConfirm] = useState<UserProfile | null>(null);

  const handleDelete = async (u: UserProfile) => {
    if (u.id === profile?.id) { notify("Tidak bisa menghapus akun sendiri.", "error"); return; }
    setDeleteConfirm(u);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteUser(deleteConfirm.id);
      notify(`${deleteConfirm.full_name} dihapus.`);
      await loadUsers();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal menghapus pengguna.", "error");
    }
    setDeleteConfirm(null);
  };

  const togglePerm = (perm: string) => {
    if (selectedRole === "admin") return;
    setMatrix((prev) => {
      const next = { ...prev };
      const s = new Set(prev[selectedRole]);
      if (s.has(perm)) s.delete(perm); else s.add(perm);
      next[selectedRole] = s;
      return next;
    });
  };

  const savePerms = async () => {
    setSaving(true);
    const rows: { role: string; permission: string }[] = [];
    for (const role of allRoles) {
      for (const perm of matrix[role]) {
        rows.push({ role, permission: perm });
      }
    }
    const { error: delErr } = await supabase.from("role_permissions").delete().in("role", allRoles);
    if (delErr) { notify(delErr.message, "error"); setSaving(false); return; }
    const { error: insErr } = await supabase.from("role_permissions").insert(rows);
    if (insErr) notify(insErr.message, "error");
    else notify("Hak akses disimpan.");
    setSaving(false);
  };

  const userCountByRole = (r: Role) => users.filter(u => u.role === r).length;
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / 25));
  const [editRoleOpen, setEditRoleOpen] = useState<Role | null>(null);
  const [deleteRoleConfirm, setDeleteRoleConfirm] = useState<Role | null>(null);
  const [roleMenuOpen, setRoleMenuOpen] = useState<Role | null>(null);
  const customRoles = roles.filter((role) => role.key !== "admin");
  const hiddenRoles: Role[] = [];

  const handleDeleteRole = (r: Role) => {
    setRoleMenuOpen(null);
    if (roles.find((role) => role.key === r)?.is_system) { notify("Role bawaan tidak bisa dihapus.", "error"); return; }
    const count = userCountByRole(r);
    if (count > 0) {
      notify(`Role ${ROLE_LABELS[r]} masih digunakan oleh ${count} pengguna. Pindahkan pengguna ke role lain terlebih dahulu.`, "error");
      return;
    }
    setDeleteRoleConfirm(r);
  };

  const confirmDeleteRole = () => {
    if (!deleteRoleConfirm) return;
    void deleteRole(deleteRoleConfirm).then(() => {
      if (selectedRole === deleteRoleConfirm) setSelectedRole("admin");
      notify(`Role ${ROLE_LABELS[deleteRoleConfirm]} dihapus.`);
      setDeleteRoleConfirm(null);
      void loadRoles();
      void loadPermissions();
    }).catch((error) => notify(error instanceof Error ? error.message : "Gagal menghapus role.", "error"));
  };

  return (
    <>
      <PageHead title="Peran Pengguna" description="Kelola peran, pengguna, dan hak akses." />
      <div className="um-layout">
        <aside className="um-sidebar" onClick={() => { if (roleMenuOpen) setRoleMenuOpen(null); }}>
          <button className={`um-role-item ${selectedRole === "admin" ? "active" : ""}`} onClick={() => setSelectedRole("admin")}>
            Admin
          </button>
          <div className="um-sidebar-divider" />
          <div className="um-sidebar-section">Custom Role</div>
          {customRoles.length > 0 ? customRoles.map((role) => (
            <div key={role.key} className="um-role-item-wrap">
              <button className={`um-role-item ${selectedRole === role.key ? "active" : ""}`} onClick={() => setSelectedRole(role.key)}>
                {role.label}
              </button>
              {!role.is_system && <button className="um-role-menu-btn" onClick={(e) => { e.stopPropagation(); setRoleMenuOpen(roleMenuOpen === role.key ? null : role.key); }}>
                <MoreHorizontal size={16} />
              </button>}
              {!role.is_system && roleMenuOpen === role.key && (
                <div className="um-role-dropdown" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setRoleMenuOpen(null); setEditRoleOpen(role.key); }}>
                    <Pencil size={14} /> Edit
                  </button>
                  <button className="um-dropdown-danger" onClick={() => handleDeleteRole(role.key)}>
                    <Trash2 size={14} /> Hapus
                  </button>
                </div>
              )}
            </div>
          )) : (
            <div className="um-sidebar-empty">
              <Info size={14} />
              <span>Belum ada role ditambahkan</span>
            </div>
          )}
          <button className="um-new-role-btn" onClick={() => setNewRoleOpen(true)}>
            <Plus size={14} /> Role Baru
          </button>
        </aside>

        <div className="um-main">
          <div className="um-tabs">
            <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
              <Users size={15} /> Pengguna
            </button>
            <button className={tab === "permissions" ? "active" : ""} onClick={() => setTab("permissions")}>
              <Shield size={15} /> Hak Akses
            </button>
          </div>

          {tab === "users" && (
            <div className="um-content">
              <div className="um-search-bar">
                <div className="um-search-input">
                  <Search size={16} />
                  <input placeholder="Nama User" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Button variant="primary" onClick={() => setAddOpen(true)}><Plus size={16} /> Tambah Pengguna</Button>
              </div>
              <div className="table-wrap">
                <table className="um-table">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Email</th>
                      <th>Company</th>
                      <th>Verified</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", opacity: 0.5 }}>Memuat...</td></tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", opacity: 0.5 }}>Tidak ada pengguna dengan role ini.</td></tr>
                    ) : filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td>{u.full_name}</td>
                        <td>{u.email}</td>
                        <td>{Array.isArray(u.companies) ? u.companies[0]?.name ?? "—" : u.companies?.name ?? "—"}</td>
                        <td>
                          <span className={`um-verified ${u.is_active ? "yes" : "no"}`}>
                            {u.is_active ? <Check size={14} /> : <X size={14} />}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="um-action-btn" onClick={() => setEditUser(u)}>
                              <Pencil size={14} /> Ubah Role
                            </button>
                            {u.id !== profile?.id && (
                              <button className="um-action-btn um-action-danger" onClick={() => handleDelete(u)}>
                                <Trash2 size={14} /> Hapus
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="um-pagination">
                <span>Tampilkan</span>
                <select className="um-page-select" defaultValue={25}><option>25</option><option>50</option></select>
                <span>{totalPages > 0 ? `1 dari ${totalPages} Halaman` : "0 Halaman"}</span>
                <div className="um-page-nav">
                  <button className="icon-button" disabled><ChevronLeft size={16} /></button>
                  <button className="icon-button" disabled><ChevronRight size={16} /></button>
                </div>
              </div>
            </div>
          )}

          {tab === "permissions" && (
            <div className="um-content">
              {selectedRole === "admin" && (
                <div className="um-admin-banner">
                  <AlertTriangle size={16} />
                  Admin instansi memiliki semua akses. Hak akses tidak dapat di ubah!
                </div>
              )}
              {permLoading ? (
                <p style={{ padding: "2rem", opacity: 0.5 }}>Memuat hak akses...</p>
              ) : (
                <>
                  <table className="um-perm-table">
                    <thead>
                      <tr>
                        <th>Resource</th>
                        <th>Hak Akses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSION_GROUPS.map((g) => (
                        <React.Fragment key={g.label}>
                          <tr className="um-perm-row">
                            <td className="um-perm-resource">{g.label}</td>
                            <td className="um-perm-checks">
                              {g.permissions.map((p) => (
                                <label key={p} className="um-perm-check-label">
                                  <input
                                    type="checkbox"
                                    checked={matrix[selectedRole]?.has(p) ?? false}
                                    disabled={selectedRole === "admin"}
                                    onChange={() => togglePerm(p)}
                                  />
                                  {PERM_LABELS[p] || p}
                                </label>
                              ))}
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                  {selectedRole !== "admin" && (
                    <div style={{ padding: "16px 0", display: "flex", justifyContent: "flex-end" }}>
                      <Button variant="primary" onClick={savePerms} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Hak Akses"}</Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {editUser && (
        <UserEditModal user={editUser} onClose={() => setEditUser(null)} notify={notify} onSave={loadUsers} hiddenRoles={hiddenRoles} />
      )}
      {addOpen && (
        <UserAddModal onClose={() => setAddOpen(false)} notify={notify} onSave={loadUsers} hiddenRoles={hiddenRoles} />
      )}
      {newRoleOpen && (
        <Modal title="Buat Role Baru" onClose={() => setNewRoleOpen(false)}>
          <NewRoleForm onClose={() => setNewRoleOpen(false)} notify={notify} onSaved={loadRoles} />
        </Modal>
      )}
      {deleteConfirm && (
        <Modal title="Hapus Pengguna" onClose={() => setDeleteConfirm(null)}>
          <div className="modal-body">
            <div className="um-admin-banner" style={{ background: "#fef0f0", borderColor: "#f0c0c0", color: "#b00" }}>
              <AlertTriangle size={16} />
              Apakah Anda yakin ingin menghapus pengguna ini? Tindakan ini tidak dapat dibatalkan.
            </div>
            <div style={{ padding: "8px 0", fontSize: "0.9rem" }}>
              <div><b>Nama:</b> {deleteConfirm.full_name}</div>
              <div><b>Email:</b> {deleteConfirm.email}</div>
              <div><b>Role:</b> {ROLE_LABELS[deleteConfirm.role]}</div>
            </div>
          </div>
          <div className="modal-footer">
            <Button onClick={() => setDeleteConfirm(null)}>Batal</Button>
            <Button variant="danger" onClick={confirmDelete}>Hapus</Button>
          </div>
        </Modal>
      )}
      {deleteRoleConfirm && (
        <Modal title="Hapus Role" onClose={() => setDeleteRoleConfirm(null)}>
          <div className="modal-body">
            <div className="um-admin-banner" style={{ background: "#fef0f0", borderColor: "#f0c0c0", color: "#b00" }}>
              <AlertTriangle size={16} />
              Apakah Anda yakin ingin menghapus role <b>{ROLE_LABELS[deleteRoleConfirm]}</b>? Role akan disembunyikan dari daftar.
            </div>
          </div>
          <div className="modal-footer">
            <Button onClick={() => setDeleteRoleConfirm(null)}>Batal</Button>
            <Button variant="danger" onClick={confirmDeleteRole}>Hapus Role</Button>
          </div>
        </Modal>
      )}
      {editRoleOpen && (
        <EditRoleModal role={editRoleOpen} onClose={() => setEditRoleOpen(null)} notify={notify} onSaved={loadRoles} />
      )}
    </>
  );
}

function NewRoleForm({ onClose, notify, onSaved }: { onClose: () => void; notify: (m: string, k?: "error" | "success") => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const roleKey = key.trim().toLowerCase();
    if (!name.trim() || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(roleKey)) { notify("Nama dan key role (huruf kecil, angka, underscore) wajib diisi.", "error"); return; }
    setSaving(true);
    try { await createRole(roleKey, name.trim()); await onSaved(); notify("Custom role dibuat."); onClose(); }
    catch (error) { notify(error instanceof Error ? error.message : "Gagal membuat custom role.", "error"); }
    finally { setSaving(false); }
  };
  return (
    <>
      <div className="modal-body">
        <div className="um-admin-banner" style={{ marginBottom: 12 }}>
          <Info size={16} />
          Role ini akan menentukan apa yang bisa dilakukan oleh pengguna yang diberi peran ini. Masukkan nama role (misalnya: Administrator, Manager, dll.)
        </div>
        <label className="modal-label">
          Nama Role <span style={{ color: "var(--danger)" }}>*</span>
          <input className="ch-edit-input" value={name} onChange={e => setName(e.target.value)} placeholder="Masukkan Nama Role" />
        </label>
        <label className="modal-label">Key role <input className="ch-edit-input" value={key} onChange={e => setKey(e.target.value.toLowerCase())} placeholder="field_supervisor" /></label>
      </div>
      <div className="modal-footer">
        <Button onClick={onClose}>Batal</Button>
        <Button variant="primary" disabled={!name.trim() || !key.trim() || saving} onClick={save}>{saving ? "Menyimpan…" : "Simpan"}</Button>
      </div>
    </>
  );
}

function EditRoleModal({ role, onClose, notify, onSaved }: { role: Role; onClose: () => void; notify: (m: string, k?: "error" | "success") => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(ROLE_LABELS[role]);
  const save = async () => {
    if (!name.trim()) { notify("Nama role wajib diisi.", "error"); return; }
    try { await updateRole(role, name.trim()); await onSaved(); notify(`Role diperbarui menjadi "${name.trim()}".`); onClose(); }
    catch (error) { notify(error instanceof Error ? error.message : "Gagal memperbarui role.", "error"); }
  };
  return (
    <Modal title="Edit Role" onClose={onClose}>
      <div className="modal-body">
        <label className="modal-label">
          Nama Role <span style={{ color: "var(--danger)" }}>*</span>
          <input className="ch-edit-input" value={name} onChange={e => setName(e.target.value)} placeholder="Masukkan nama role" />
        </label>
      </div>
      <div className="modal-footer">
        <Button onClick={onClose}>Batal</Button>
        <Button variant="primary" onClick={save} disabled={!name.trim()}>Simpan</Button>
      </div>
    </Modal>
  );
}

function UserEditModal({ user, onClose, notify, onSave, hiddenRoles = [] }: { user: UserProfile; onClose: () => void; notify: (m: string, k?: "error" | "success") => void; onSave: () => void; hiddenRoles?: Role[] }) {
  const [name, setName] = useState(user.full_name);
  const [role, setRole] = useState<Role>(user.role);
  const [companyId, setCompanyId] = useState(user.company_id ?? "");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [active, setActive] = useState(user.is_active);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  const save = async () => {
    if (!name.trim()) { notify("Nama wajib diisi.", "error"); return; }
    setBusy(true);
    const { error } = await supabase.from("user_profiles").update({
      full_name: name.trim(), role, company_id: companyId || null, is_active: active, updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    setBusy(false);
    if (error) notify(error.message, "error");
    else { notify(`${name.trim()} diperbarui.`); onSave(); onClose(); }
  };

  return (
    <Modal title="Ubah Role" onClose={onClose}>
      <div className="modal-body">
        <label className="modal-label">Email<div className="modal-static">{user.email}</div></label>
        <label className="modal-label">Nama lengkap<input className="ch-edit-input" value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="modal-label">Role
          <select className="ch-edit-input" value={role} onChange={e => setRole(e.target.value as Role)}>
            {(Object.entries(ROLE_LABELS) as [Role, string][]).filter(([v]) => !hiddenRoles.includes(v)).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="modal-label">Company
          <select className="ch-edit-input" value={companyId} onChange={e => setCompanyId(e.target.value)}>
            <option value="">No company assigned</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </label>
        <label className="modal-label" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Aktif
        </label>
      </div>
      <div className="modal-footer">
        <Button onClick={onClose}>Batal</Button>
        <Button variant="primary" onClick={save} disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</Button>
      </div>
    </Modal>
  );
}

function UserAddModal({ onClose, notify, onSave, hiddenRoles = [] }: { onClose: () => void; notify: (m: string, k?: "error" | "success") => void; onSave: () => void; hiddenRoles?: Role[] }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("asisten");
  const [companyId, setCompanyId] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  const save = async () => {
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) { notify("Masukkan email yang valid.", "error"); return; }
    if (!name.trim()) { notify("Nama wajib diisi.", "error"); return; }
    if (password.length < 8) { notify("Password minimal 8 karakter.", "error"); return; }
    if (!companyId) { notify("Pilih perusahaan untuk pengguna baru.", "error"); return; }
    setBusy(true);
    try {
      await signUp(email, password, name.trim(), role, companyId);
      notify(`${name.trim()} berhasil dibuat.`);
      onSave();
      onClose();
    } catch (err: any) {
      notify(err.message || "Gagal membuat pengguna.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Tambah Pengguna" onClose={onClose}>
      <div className="modal-body">
        <label className="modal-label">Email<input className="ch-edit-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" /></label>
        <label className="modal-label">Nama lengkap<input className="ch-edit-input" value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="modal-label">Password<input className="ch-edit-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 karakter" /></label>
        <label className="modal-label">Role
          <select className="ch-edit-input" value={role} onChange={e => setRole(e.target.value as Role)}>
            {(Object.entries(ROLE_LABELS) as [Role, string][]).filter(([v]) => !hiddenRoles.includes(v as Role)).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="modal-label">Perusahaan
          <select className="ch-edit-input" value={companyId} onChange={e => setCompanyId(e.target.value)}>
            <option value="">{companies.length ? "Pilih perusahaan" : "Tidak ada perusahaan"}</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>
      <div className="modal-footer">
        <Button onClick={onClose}>Batal</Button>
        <Button variant="primary" onClick={save} disabled={busy}>{busy ? "Membuat..." : "Buat pengguna"}</Button>
      </div>
    </Modal>
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
                    <DSTxLogo size={18} />
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
    (async () => {
      try {
        if (forgot) {
          const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email);
          if (resetErr) throw resetErr;
          setSuccess("If an account exists, a password reset link has been sent to your email.");
        } else if (reset) {
          const { error: updateErr } = await supabase.auth.updateUser({ password });
          if (updateErr) throw updateErr;
          setSuccess("Password updated. You can now sign in.");
          setTimeout(() => go("/login"), 1500);
        } else if (signup) {
          await signUp(email, password, name, "asisten");
          setSuccess("Account created! Check your email to verify, or use demo access below.");
        } else {
          await signIn(email, password);
          login();
        }
      } catch (err: any) {
        setError(err.message || "Authentication failed.");
      } finally {
        setBusy(false);
      }
    })();
  };
  return (
    <div className="auth-page">
      <aside className="auth-side">
        <Brand />
        <div className="auth-message">
          <span className="auth-kicker">
            <span className="status-pulse" /> IOT MONITORING PLATFORM
          </span>
          <h1>
            Monitor smarter,
            <br />
            act faster.
          </h1>
          <p>
            Track devices, inspect sensor data, and turn telemetry into
            actionable insights across your IoT deployments.
          </p>
          <div className="auth-iot-flow" role="img" aria-label="Live IoT device data flowing securely to edge compute">
            <div className="auth-iot-node auth-iot-device">
              <span className="auth-node-icon"><RadioTower size={22} /></span>
              <span>
                <small>FIELD DEVICE</small>
                <b>Sensor node</b>
              </span>
              <i className="auth-node-status" aria-hidden="true" />
            </div>
            <div className="auth-data-link" aria-hidden="true">
              <span className="auth-link-line" />
              <i className="auth-packet packet-one" />
              <i className="auth-packet packet-two" />
              <i className="auth-packet packet-three" />
              <span className="auth-link-label"><Wifi size={12} /> encrypted telemetry</span>
            </div>
            <div className="auth-iot-node auth-iot-compute">
              <span className="auth-node-icon"><Cpu size={22} /></span>
              <span>
                <small>EDGE COMPUTE</small>
                <b>Processing live</b>
              </span>
              <span className="auth-compute-bars" aria-hidden="true"><i /><i /><i /></span>
            </div>
            <span className="auth-cloud-node" aria-hidden="true"><Server size={15} /></span>
          </div>
          <div className="auth-tiles">
            <div>
              <b>1</b>
              <span>weather station</span>
            </div>
            <div>
              <b>8</b>
              <span>sensor channels</span>
            </div>
            <div>
              <b>Live</b>
              <span>data feed</span>
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
          <div className="auth-label">DSTX ACCOUNT</div>
          <h2>{title}</h2>
          <p>
            {signup
              ? "Set up your IoT monitoring workspace."
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
            <DSTxLogo size={16} /> Enter demo workspace
          </Button>
          <p className="auth-switch">
            {signup || forgot || reset ? (
              <>
                Already have access?{" "}
                <button onClick={() => go("/login")}>Sign in</button>
              </>
            ) : (
              <>
                New to DSTx?{" "}
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
  const farm = "all";
  const [session, setSession] = useState(
    () => localStorage.getItem("agrivaid-demo-session") === "true",
  );
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [devices, setDevices] = useState<Device[]>(() =>
    loadDevices(),
  );
  const [alerts, setAlerts] = useState<Alert[]>(() =>
    read("agrivaid-alerts", initialAlerts),
  );
  const [notice, setNotice] = useState<Notice | null>(null);
  const refresh = async () => {
    try {
      const [registeredDevices, registeredSensors] = await Promise.all([
        listRegisteredDevices(),
        listRegisteredSensors(),
      ]);
      setDevices(registeredDevices);
      replaceRegisteredSensors(registeredSensors);
    } catch (error) {
      console.warn("Unable to load the device registry", error);
      setDevices([]);
      replaceRegisteredSensors([]);
    }
    setAlerts(read("agrivaid-alerts", initialAlerts));
  };
  const updatedSensorIds = useLiveData(devices, (deviceId) => {
    setDevices((current) => {
      const target = current.find((device) => device.id === deviceId);
      if (!target || target.status === "online") return current;
      return current.map((device) =>
        device.id === deviceId ? { ...device, status: "online" } : device,
      );
    });
  });
  const notify = (text: string, kind: "error" | "success" = "success") => {
    setNotice({ text, kind });
    setTimeout(() => setNotice(null), 3600);
  };
  const reloadProfile = async () => {
    const next = await getCurrentProfile();
    setProfile(next);
    if (next) {
      setPermissions(await getUserPermissions(next.role));
      await refresh();
    }
  };
  const setTheme = (v: Theme) => {
    setThemeState(v);
    localStorage.setItem("agrivaid-theme", v);
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
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) {
        setSession(true);
        void reloadProfile();
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) {
        setSession(true);
        void reloadProfile();
      } else if (!localStorage.getItem("agrivaid-demo-session")) {
        setSession(false);
        setProfile(null);
        setPermissions([]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
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
  const logout = async () => {
    localStorage.removeItem("agrivaid-demo-session");
    try { await signOut(); } catch {}
    setSession(false);
    setProfile(null);
    setPermissions([]);
    go("/login");
  };
  const props = { devices, alerts, farm, go, notify, refresh, updatedSensorIds };
  let page: React.ReactNode = null;
  if (!session && isPublic(path))
    page = <AuthPage path={path} go={go} login={login} notify={notify} />;
  else if (session) {
    if (path === "/dashboard") page = <Dashboard {...props} />;
    else if (path === "/company") page = <CompanyPage profile={profile} notify={notify} onCompanyChanged={reloadProfile} />;
    else if (path === "/devices") page = <Devices {...props} />;
    else if (path.startsWith("/devices/"))
      page = (
        <DeviceDetail {...props} id={decodeURIComponent(path.split("/")[2])} />
      );
    else if (path === "/firmware-ota") page = <FirmwareOta devices={devices} farm={farm} refresh={refresh} />;
    else if (path === "/profile")
      page = (
        <Profile
          farm={farm}
          notify={notify}
          theme={theme}
          setTheme={setTheme}
          profile={profile}
        />
      );
    else if (path === "/users" && profile?.role === "admin")
      page = (
        <UserManagement notify={notify} profile={profile} />
      );
    else if (path === "/settings")
      page = (
        <Profile
          farm={farm}
          notify={notify}
          theme={theme}
          setTheme={setTheme}
          profile={profile}
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
          devices={devices}
          alerts={alerts}
          logout={logout}
          profile={profile}
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

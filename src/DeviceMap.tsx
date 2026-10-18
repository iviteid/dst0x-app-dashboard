import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ChevronDown,
  CloudSun,
  Droplets,
  Layers3,
  Lightbulb,
  LocateFixed,
  Map as MapIcon,
  Minus,
  Plus,
  Search,
  Settings2,
  Sprout,
  Thermometer,
  X,
} from "lucide-react";
import type { Device } from "./types";
import { farmName, formatTime, zoneName } from "./data";
import { deviceKind, devicePosition, kindLabels } from "./deviceGeo";

const icons = {
  climate: Thermometer,
  weather: CloudSun,
  soil: Sprout,
  light: Lightbulb,
  water: Droplets,
  control: Settings2,
};
type MapStyle = "light" | "standard";
const tiles: Record<MapStyle, { url: string; attribution: string }> = {
  light: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  standard: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
};

function markerIcon(device: Device) {
  const kind = deviceKind(device);
  const Icon = icons[kind];
  const glyph = renderToStaticMarkup(<Icon size={19} strokeWidth={2.1} />);
  return L.divIcon({
    className: "device-map-leaflet-icon",
    html: `<span class="geo-pin kind-${kind} status-${device.status}"><span class="geo-pin-inner">${glyph}</span></span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -18],
  });
}

function devicePopup(device: Device, go: (path: string) => void) {
  const root = document.createElement("div");
  root.className = "geo-popup";
  const heading = document.createElement("div");
  heading.className = "geo-popup-heading";
  const name = document.createElement("strong");
  name.textContent = device.name;
  const id = document.createElement("small");
  id.textContent = device.id;
  const status = document.createElement("span");
  status.className = `geo-popup-status status-${device.status}`;
  status.textContent = device.status;
  heading.append(name, id, status);
  root.append(heading);
  const details = document.createElement("div");
  details.className = "geo-popup-details";
  for (const [label, value] of [
    ["Type", kindLabels[deviceKind(device)]],
    ["Site", `${farmName(device.farmId)} · ${zoneName(device.zoneId)}`],
    ["Last update", formatTime(device.lastSeen)],
    ["Battery", device.battery == null ? "Not reported" : `${device.battery}%`],
    ["Firmware", device.firmware || "Not reported"],
  ]) {
    const row = document.createElement("div");
    const key = document.createElement("span");
    key.textContent = label;
    const val = document.createElement("b");
    val.textContent = value;
    row.append(key, val);
    details.append(row);
  }
  root.append(details);
  const actions = document.createElement("div");
  actions.className = "geo-popup-actions";
  const position = devicePosition(device);
  const route = document.createElement("a");
  route.href = `https://www.google.com/maps/dir/?api=1&destination=${position.latitude},${position.longitude}`;
  route.target = "_blank";
  route.rel = "noopener noreferrer";
  route.textContent = "Directions ↗";
  const detail = document.createElement("button");
  detail.type = "button";
  detail.textContent = "View details →";
  detail.addEventListener("click", () => go(`/devices/${encodeURIComponent(device.id)}`));
  actions.append(route, detail);
  root.append(actions);
  const note = document.createElement("small");
  note.className = "geo-popup-note";
  note.textContent = "Illustrative demo coordinates; verify before travel.";
  root.append(note);
  return root;
}

export default function DeviceMap({ devices, farm, go }: { devices: Device[]; farm: string; go: (path: string) => void }) {
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tileLayer = useRef<L.TileLayer | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const [style, setStyle] = useState<MapStyle>("light");
  const [showLayers, setShowLayers] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [showLegend, setShowLegend] = useState(false);
  const [showData, setShowData] = useState(false);
  const [count, setCount] = useState(devices.length);
  const goRef = useRef(go);
  goRef.current = go;
  const matches = query.trim()
    ? devices.filter((d) => `${d.name} ${d.id} ${farmName(d.farmId)}`.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : [];

  useEffect(() => {
    if (!mapElement.current || map.current) return;
    const instance = L.map(mapElement.current, { zoomControl: false, scrollWheelZoom: true, minZoom: 8, maxZoom: 18, preferCanvas: true });
    instance.setView([-6.77, 106.99], 10);
    map.current = instance;
    markerLayer.current = L.layerGroup().addTo(instance);
    const resize = new ResizeObserver(() => instance.invalidateSize());
    resize.observe(mapElement.current);
    return () => { resize.disconnect(); instance.remove(); map.current = null; markerLayer.current = null; markers.current.clear(); };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    if (tileLayer.current) map.current.removeLayer(tileLayer.current);
    const source = tiles[style];
    tileLayer.current = L.tileLayer(source.url, { attribution: source.attribution, maxZoom: 19 }).addTo(map.current);
    tileLayer.current.bringToBack();
  }, [style]);

  useEffect(() => {
    const instance = map.current;
    const layer = markerLayer.current;
    if (!instance || !layer) return;
    layer.clearLayers();
    markers.current.clear();
    const points: L.LatLngExpression[] = [];
    for (const device of devices) {
      const position = devicePosition(device);
      const point: L.LatLngExpression = [position.latitude, position.longitude];
      const marker = L.marker(point, { icon: markerIcon(device), opacity: farm !== "all" && device.farmId !== farm ? 0.42 : 1, title: `${device.name} · ${device.status}` });
      marker.bindPopup(() => devicePopup(device, goRef.current), { maxWidth: 290, minWidth: 240, autoPanPadding: [28, 28] });
      marker.addTo(layer);
      markers.current.set(device.id, marker);
      points.push(point);
    }
    if (points.length) instance.fitBounds(L.latLngBounds(points), { padding: [75, 75], maxZoom: 12 });
    setCount(devices.length);
  }, [devices, farm]);

  const focus = (device: Device) => {
    setQuery("");
    setShowSearch(false);
    setShowData(false);
    const position = devicePosition(device);
    map.current?.setView([position.latitude, position.longitude], Math.max(map.current.getZoom(), 12), { animate: false });
    markers.current.get(device.id)?.openPopup();
  };
  const resetView = () => {
    const positions = devices.map((d) => devicePosition(d));
    if (positions.length) map.current?.fitBounds(L.latLngBounds(positions.map((p) => [p.latitude, p.longitude])), { padding: [75, 75], maxZoom: 12 });
  };
  return <section className="device-map-card map-full" aria-label="Installed device map">
    <div className="map-full-heading"><div><span>LIVE NETWORK / DEMO</span><h2>Device location map</h2><p>{count} installed demo devices · West Java, Indonesia</p></div><span className="map-demo-badge">Approximate demo positions</span></div>
    <div className={`map-stage map-style-${style}`}>
      <div ref={mapElement} className="map-leaflet" aria-label="Interactive map of installed devices" />
      <div className="map-top-left">
        {showSearch ? <div className="map-search-panel"><div className="map-search-input"><Search size={17} /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a device or site" aria-label="Find device on map" /><button aria-label="Close map search" onClick={() => { setShowSearch(false); setQuery(""); }}><X size={17} /></button></div>{matches.length > 0 && <div className="map-search-results">{matches.map((device) => <button key={device.id} onClick={() => focus(device)}><b>{device.name}</b><small>{farmName(device.farmId)} · {device.id}</small></button>)}</div>}{query && !matches.length && <div className="map-search-empty">No matching devices</div>}</div> : <button className="map-control" aria-label="Search map devices" onClick={() => setShowSearch(true)}><Search size={20} /></button>}
      </div>
      <div className="map-top-right"><button className="map-control" aria-label="Map layers" aria-expanded={showLayers} onClick={() => setShowLayers(!showLayers)}><Layers3 size={20} /></button>{showLayers && <div className="map-layer-menu"><strong>Base map</strong><button className={style === "light" ? "active" : ""} onClick={() => { setStyle("light"); setShowLayers(false); }}><MapIcon size={15} /> Light streets</button><button className={style === "standard" ? "active" : ""} onClick={() => { setStyle("standard"); setShowLayers(false); }}><MapIcon size={15} /> Standard</button></div>}</div>
      <div className="map-bottom-right"><button className="map-control" aria-label="Zoom in" onClick={() => map.current?.zoomIn()}><Plus size={20} /></button><button className="map-control" aria-label="Zoom out" onClick={() => map.current?.zoomOut()}><Minus size={20} /></button><button className="map-control" aria-label="Fit all devices" onClick={resetView}><LocateFixed size={19} /></button></div>
      <div className="map-bottom-left"><button className="map-drawer-tab" aria-expanded={showLegend} onClick={() => setShowLegend(!showLegend)}>Legend <ChevronDown size={16} className={showLegend ? "rotated" : ""} /></button>{showLegend && <div className="map-legend-panel"><b>Device type</b>{Object.entries(kindLabels).map(([kind, label]) => { const Icon = icons[kind as keyof typeof icons]; return <span key={kind}><i className={`kind-${kind}`}><Icon size={14} /></i>{label}</span>; })}<b>Status ring</b><span><i className="map-status-dot online" /> Online</span><span><i className="map-status-dot warning" /> Warning</span><span><i className="map-status-dot offline" /> Offline / critical</span></div>}</div>
      <div className="map-bottom-center"><button className="map-drawer-tab" aria-expanded={showData} onClick={() => setShowData(!showData)}>Monitoring data <ChevronDown size={16} className={showData ? "rotated" : ""} /></button>{showData && <div className="map-data-panel"><div className="map-data-head"><b>Installed devices</b><span>{devices.length} total · {devices.filter((d) => farm === "all" || d.farmId === farm).length} in active scope</span></div><div className="map-data-list">{devices.map((device) => { const Icon = icons[deviceKind(device)]; return <button key={device.id} onClick={() => focus(device)}><span className={`map-list-icon kind-${deviceKind(device)}`}><Icon size={15} /></span><span><b>{device.name}</b><small>{farmName(device.farmId)} · {device.id}</small></span><i className={`map-list-dot status-${device.status}`} /></button>; })}</div></div>}</div>
      <div className="map-scope-note">Markers show all devices. Non-selected farms are faded. Demo coordinates are not surveyed.</div>
    </div>
  </section>;
}

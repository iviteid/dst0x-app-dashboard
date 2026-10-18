# AgrivaID

AgrivaID is a responsive smart agriculture IoT monitoring frontend. This checkout is a clearly labeled demo: it does not connect to a sensor, MQTT broker, database, or authentication provider.

## Run locally

```sh
npm install
npm run dev
```

`npm run build` type checks the React and TypeScript code and produces the static Site in `dist/`.

## What is implemented

- Public routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`.
- Demo session routes: `/dashboard`, `/devices`, `/devices/:deviceId`, `/analytics`, `/historical-data`, `/alerts`, `/reports`, `/firmware-ota`, `/profile`, `/settings`.
- Deterministic data for three farms, six zones, 12 devices, 47 sensor channels, seven days of hourly telemetry, and sample alerts.
- The device Overview tab is a monitoring panel: device header with status and a full-screen toggle, multi-sensor picker with search and apply, realtime toggle, date-time range, aggregation by hour/day/week/month/year, CSV download, chart settings with per-series colours, a multi-axis line chart with a toggleable legend, and a monitoring data table with one column per selected channel. Realtime replays the fixed demo dataset and never contacts hardware.
- Farm scoping, device search/filter/sort/pagination, device add/edit/delete with local confirmation, alert acknowledgment and resolution, chart range and sensor controls, and CSV/JSON exports.
- The topbar bell opens a notification popover listing the newest open alerts in the current farm scope, with severity icon, device, and relative time. It closes on outside click or Escape, links each row to the device, and links to the full `/alerts` page.
- Light, dark, and system themes with browser persistence. Demo changes are stored in browser local storage.
- Overview contains a full-size interactive map with device-type markers, status rings, search, layer styles, zoom controls, a legend, monitoring list, and device detail popups. The bundled coordinates are illustrative approximations around the three demo sites, not surveyed device locations. New demo devices can be given coordinates and a marker type. The default base map is the Esri light gray canvas with its label overlay; the layer menu also offers standard OpenStreetMap tiles. Both are public tile services with the attribution shown on the map.
- Firmware OTA is a browser-local simulation: it hashes a selected firmware file, checks model, battery, status, and version, and can update the displayed demo firmware version with a local run history. It never uploads the file or contacts hardware. A real OTA integration requires signed packages, device acknowledgments, rollback, authorization, and audit storage.

The demo login stores only a local session flag. Signup, password recovery, and production sign in explain that an authentication provider is unavailable. The demo form never stores a password or sends an email.

## Integration boundary

`src/types.ts` holds the domain types. `src/data.ts` supplies deterministic demo data. `src/service.ts` defines `DataService`, a local `demoService`, and a `BackendAdapter` contract for authenticated HTTP endpoints. The application currently uses the demo adapter only.

A live deployment needs an authenticated backend, organization scoped authorization, validated telemetry ingestion, persisted data, and error handling. MQTT or device side RS485, UART, and SDI-12 traffic must terminate at an authorized gateway or server. Do not place broker credentials or service role keys in the browser bundle. Telemetry is represented in UTC and displayed in Asia/Jakarta in the demo.

## Data semantics

The dataset timestamp is fixed at 18 October 2026, 11:42 Asia/Jakarta, so screenshots and interactions are repeatable. Data availability is calculated from valid versus total demo telemetry samples in the selected farm scope. A missing reading is displayed as unavailable rather than zero. Device status and freshness are separate: freshness uses each device's reporting interval; physical connectivity is never inferred from demo refresh clicks.

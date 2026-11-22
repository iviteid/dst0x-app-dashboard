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

The source is organized by responsibility:

```
src/
├── app/                 # application entry point, shell, and global styles
├── features/            # feature-specific UI and domain logic
├── services/            # API clients and data-service adapters
├── shared/              # cross-cutting types and configuration
└── store/               # live in-browser demo state
```

`src/shared/types/domain.ts` holds the domain types. `src/store/liveData.ts` supplies live in-browser demo state. `src/services/dataService.ts` defines `DataService`, a local `demoService`, and a `BackendAdapter` contract for authenticated HTTP endpoints. The application currently uses the demo adapter only.

A live deployment needs an authenticated backend, organization scoped authorization, validated telemetry ingestion, persisted data, and error handling. MQTT or device side RS485, UART, and SDI-12 traffic must terminate at an authorized gateway or server. Do not place broker credentials or service role keys in the browser bundle. Telemetry is represented in UTC and displayed in Asia/Jakarta in the demo.

## Production data stores

The application uses a control-plane/data-plane split:

- **Supabase:** Auth users, companies, user-to-company assignment, role permissions, device IDs, and sensor IDs. Apply [003_companies_devices_and_company_access.sql](supabase/migrations/003_companies_devices_and_company_access.sql) after the existing migrations.
- **MongoDB:** sensor readings only. The browser accesses readings through an authenticated ingestion/query API; it must not access MongoDB directly. The required document shape and indexes are in [mongodb-telemetry-schema.md](docs/mongodb-telemetry-schema.md).

The dashboard starts with no registered device or sensor ID. An administrator can create a company from **Peran Pengguna**, then create device and sensor IDs from the dashboard. With no sensor ID, the overview deliberately displays one unnamed placeholder card rather than bundled sample parameters.

If these migrations are executed manually in Supabase SQL Editor, run them in numeric order through `008_user_company_and_admin_delete.sql` before creating the first account.

Copy `.env.example` to `.env.local` and set the Supabase project URL/key. Set `VITE_TELEMETRY_API_URL` only to the authenticated telemetry API URL (for example `https://api.example.com/v1/sensor-records`). Never set a MongoDB connection string in a `VITE_*` variable because Vite exposes those values to every browser.

## Data semantics

The dataset timestamp is fixed at 18 October 2026, 11:42 Asia/Jakarta, so screenshots and interactions are repeatable. Data availability is calculated from valid versus total demo telemetry samples in the selected farm scope. A missing reading is displayed as unavailable rather than zero. Device status and freshness are separate: freshness uses each device's reporting interval; physical connectivity is never inferred from demo refresh clicks.

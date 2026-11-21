# MongoDB telemetry contract

MongoDB is the telemetry data plane. Only a trusted ingestion service may write
to it; the dashboard calls that service with a Supabase access token and never
receives a MongoDB URI or credential.

## Collection: `sensor_readings`

```json
{
  "_id": "ObjectId",
  "companyId": "uuid from Supabase companies.id",
  "deviceId": "hardware device ID from Supabase devices.id",
  "sensorId": "sensor ID from Supabase sensor_channels.sensor_id",
  "timestamp": "BSON Date in UTC",
  "receivedAt": "BSON Date in UTC",
  "value": 23.7,
  "quality": "valid",
  "sequence": 1042
}
```

Required indexes:

```javascript
db.sensor_readings.createIndex({ companyId: 1, deviceId: 1, sensorId: 1, timestamp: -1 })
db.sensor_readings.createIndex({ companyId: 1, deviceId: 1, timestamp: -1 })
db.sensor_readings.createIndex(
  { timestamp: 1 },
  { expireAfterSeconds: 31536000 } // optional one-year retention policy
)
```

## Ingestion rules

1. Validate the Supabase device/sensor registry before inserting.
2. Derive `companyId` server-side from the registered device; do not trust a value supplied by hardware.
3. Deduplicate with a unique key such as `{ deviceId, sensorId, sequence }`, or `{ deviceId, sensorId, timestamp }` when no sequence exists.
4. Store device time and receive time separately when clock drift matters.
5. Query telemetry through an authenticated API scoped to `companyId`; do not expose MongoDB to the browser.

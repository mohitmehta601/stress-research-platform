import { settings } from "../config/settings.js";

export const THINGSPEAK_FIELD_DEFS = [
  { field: "field1", name: "Mean_Temp", key: "mean_temp", alias: "temperature", unit: "C" },
  { field: "field2", name: "RMSSD_ms", key: "rmssd_ms", alias: "hrv", unit: "ms" },
  { field: "field3", name: "SDNN_ms", key: "sdnn_ms", unit: "ms" },
  { field: "field4", name: "Heart_Rate_bpm", key: "heart_rate_bpm", alias: "heart_rate", unit: "bpm" },
  { field: "field5", name: "SpO2_percent", key: "spo2_percent", unit: "%" },
  { field: "field6", name: "SCL_uS", key: "scl_us", alias: "eda", unit: "uS" },
  { field: "field7", name: "SCR_Peak_Count", key: "scr_peak_count", unit: "count" },
  { field: "field8", name: "SCR_Mean", key: "scr_mean", unit: "" }
];

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function configured() {
  return Boolean(settings.thingSpeakApiKey && settings.thingSpeakChannelId);
}

function qualityFromFields(values) {
  const present = THINGSPEAK_FIELD_DEFS.filter((def) => values[def.key] !== null && values[def.key] !== undefined).length;
  if (present >= 7) return "good";
  if (present >= 4) return "moderate";
  if (present > 0) return "poor";
  return "pending";
}

export function normalizePhysiologicalPayload(payload = {}) {
  const values = {};
  const rawThingSpeak = {};

  for (const def of THINGSPEAK_FIELD_DEFS) {
    const rawValue = payload[def.key] ?? payload[def.name] ?? payload[def.field] ?? payload[def.alias];
    const value = numberOrNull(rawValue);
    values[def.key] = value;
    rawThingSpeak[def.field] = rawValue ?? null;
    if (def.alias) values[def.alias] = value;
  }

  return {
    ...payload,
    ...values,
    sensor_fields: THINGSPEAK_FIELD_DEFS.map((def) => ({
      name: def.name,
      key: def.key,
      field: def.field,
      value: values[def.key],
      unit: def.unit
    })),
    thingspeak: {
      ...(payload.thingspeak || {}),
      channel_id: payload.thingspeak?.channel_id || settings.thingSpeakChannelId || null,
      entry_id: payload.entry_id ?? payload.thingspeak?.entry_id ?? null,
      raw_fields: payload.thingspeak?.raw_fields || rawThingSpeak
    },
    signal_quality: payload.signal_quality || qualityFromFields(values)
  };
}

export async function fetchLatestThingSpeakReading() {
  if (!configured()) {
    const error = new Error("ThingSpeak channel ID and API key are not configured");
    error.status = 400;
    error.detail = error.message;
    throw error;
  }

  const url = new URL(`https://api.thingspeak.com/channels/${settings.thingSpeakChannelId}/feeds.json`);
  url.searchParams.set("api_key", settings.thingSpeakApiKey);
  url.searchParams.set("results", "1");

  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`ThingSpeak request failed (${response.status})`);
    error.status = 502;
    error.detail = error.message;
    throw error;
  }

  const body = await response.json();
  const feed = body.feeds?.[0];
  if (!feed) {
    const error = new Error("ThingSpeak channel has no feed records");
    error.status = 404;
    error.detail = error.message;
    throw error;
  }

  return normalizePhysiologicalPayload({
    ...Object.fromEntries(THINGSPEAK_FIELD_DEFS.map((def) => [def.field, feed[def.field]])),
    recorded_at: feed.created_at,
    entry_id: feed.entry_id,
    thingspeak: {
      channel_id: String(body.channel?.id || settings.thingSpeakChannelId),
      entry_id: feed.entry_id,
      fetched_at: new Date().toISOString(),
      raw_fields: Object.fromEntries(THINGSPEAK_FIELD_DEFS.map((def) => [def.field, feed[def.field] ?? null]))
    }
  });
}

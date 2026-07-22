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

const SENSOR_RANGES = {
  mean_temp: [20, 45],
  rmssd_ms: [0, 300],
  sdnn_ms: [0, 300],
  heart_rate_bpm: [30, 220],
  spo2_percent: [70, 100],
  scl_us: [0, 100],
  scr_peak_count: [0, 100],
  scr_mean: [0, 100]
};

export function normalizeSensorValue(key, rawValue) {
  let value = numberOrNull(rawValue);
  if (value === null) return null;

  if (key === "mean_temp" && value > 100 && value <= 4500) {
    value = value / 100;
  }

  const range = SENSOR_RANGES[key];
  if (range && (value < range[0] || value > range[1])) return null;
  return Math.round(value * 100) / 100;
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
    const value = normalizeSensorValue(def.key, rawValue);
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

function normalizeThingSpeakFeed(feed, channelId = settings.thingSpeakChannelId) {
  return normalizePhysiologicalPayload({
    ...Object.fromEntries(THINGSPEAK_FIELD_DEFS.map((def) => [def.field, feed[def.field]])),
    recorded_at: feed.created_at,
    entry_id: feed.entry_id,
    thingspeak: {
      channel_id: String(channelId || ""),
      entry_id: feed.entry_id,
      fetched_at: new Date().toISOString(),
      raw_fields: Object.fromEntries(THINGSPEAK_FIELD_DEFS.map((def) => [def.field, feed[def.field] ?? null]))
    }
  });
}

export async function fetchThingSpeakReadings({ minutes = 5, results = 8000 } = {}) {
  if (!configured()) {
    const error = new Error("ThingSpeak channel ID and API key are not configured");
    error.status = 400;
    error.detail = error.message;
    throw error;
  }

  const end = new Date();
  const start = new Date(end.getTime() - Math.max(1, Number(minutes) || 5) * 60 * 1000);
  const formatThingSpeakDate = (date) => date.toISOString().slice(0, 19).replace("T", " ");
  const url = new URL(`https://api.thingspeak.com/channels/${settings.thingSpeakChannelId}/feeds.json`);
  url.searchParams.set("api_key", settings.thingSpeakApiKey);
  url.searchParams.set("start", formatThingSpeakDate(start));
  url.searchParams.set("end", formatThingSpeakDate(end));
  url.searchParams.set("results", String(results));

  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`ThingSpeak request failed (${response.status})`);
    error.status = 502;
    error.detail = error.message;
    throw error;
  }

  const body = await response.json();
  const feeds = Array.isArray(body.feeds) ? body.feeds : [];
  if (!feeds.length) {
    const error = new Error("ThingSpeak channel has no feed records for the recording window");
    error.status = 404;
    error.detail = error.message;
    throw error;
  }

  const channelId = body.channel?.id || settings.thingSpeakChannelId;
  return feeds.map((feed) => normalizeThingSpeakFeed(feed, channelId));
}

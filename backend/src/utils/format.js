import { Types } from "mongoose";

export function serialize(value) {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Types.ObjectId) return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    const result = {};
    for (const [key, nested] of Object.entries(value)) {
      if (key === "__v") continue;
      result[key === "_id" ? "id" : key] = serialize(nested);
    }
    return result;
  }
  return value;
}

export function cleanDocument(document) {
  if (!document) return null;
  const raw = typeof document.toObject === "function" ? document.toObject() : document;
  return serialize(raw);
}

export function average(items, key) {
  const values = items.map((item) => item?.[key]).filter((value) => typeof value === "number");
  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100 : 0;
}

export function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvResponse(rows, preferredFields) {
  const fields = [...preferredFields];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!fields.includes(key)) fields.push(key);
    }
  }
  return [
    fields.map(csvEscape).join(","),
    ...rows.map((row) => fields.map((field) => csvEscape(row[field])).join(","))
  ].join("\r\n");
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

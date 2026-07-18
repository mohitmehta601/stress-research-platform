import dotenv from "dotenv";
import dns from "dns";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(configDir, "../..");

dotenv.config({ path: resolve(backendDir, ".env"), override: true });
dotenv.config();

dns.setDefaultResultOrder("ipv4first");

if (process.env.DNS_SERVERS) {
  dns.setServers(
    process.env.DNS_SERVERS
      .split(",")
      .map((server) => server.trim())
      .filter(Boolean)
  );
}

const numberFromEnv = (key, fallback) => {
  const value = Number.parseInt(process.env[key] || "", 10);
  return Number.isFinite(value) ? value : fallback;
};

const defaultCorsOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5175",
  "https://stress-research-platform-ashen.vercel.app"
];

const normalizedUrl = (value) => (value || "").replace(/\/$/, "");

const listFromEnv = (value) => (value || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigins = Array.from(new Set([
  ...defaultCorsOrigins,
  normalizedUrl(process.env.FRONTEND_URL),
  normalizedUrl(process.env.MOBILE_URL),
  ...listFromEnv(process.env.CORS_ORIGINS)
].filter(Boolean)));

export const settings = {
  appName: process.env.APP_NAME || "Stress Research Platform API",
  appEnv: process.env.APP_ENV || "development",
  apiPrefix: process.env.API_PREFIX || "/api",
  port: numberFromEnv("PORT", 8010),
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017",
  mongodbDirectUri: process.env.MONGODB_DIRECT_URI || "",
  mongodbDatabase: process.env.MONGODB_DATABASE || process.env.MONGODB_DB_NAME || "stress_research_platform",
  corsOrigins,
  jwtSecret: process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || "development-only-change-me-32-characters-minimum",
  jwtAlgorithm: process.env.JWT_ALGORITHM || "HS256",
  accessTokenMinutes: numberFromEnv("ACCESS_TOKEN_MINUTES", 60),
  refreshTokenDays: numberFromEnv("REFRESH_TOKEN_DAYS", 30),
  consentVersion: process.env.CONSENT_VERSION || "1.0",
  bootstrapSuperAdminEmail: process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL || process.env.BOOTSTRAP_RESEARCHER_EMAIL || "",
  bootstrapSuperAdminPassword: process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD || process.env.BOOTSTRAP_RESEARCHER_PASSWORD || "",
  bootstrapSuperAdminName: process.env.BOOTSTRAP_SUPER_ADMIN_NAME || process.env.BOOTSTRAP_RESEARCHER_NAME || "Super Administrator",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  mobileUrl: process.env.MOBILE_URL || "http://localhost:5174",
  brevoApiKey: process.env.BREVO_API_KEY || "",
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL || "",
  brevoSenderName: process.env.BREVO_SENDER_NAME || "Stress Research Platform",
  thingSpeakApiKey: process.env.THINGSPEAK_API_KEY || process.env.ThingSpeak_API_KEY || process.env.ThinkSpeak_API_KEY || "",
  thingSpeakChannelId: process.env.THINGSPEAK_CHANNEL_ID || process.env.ThingSpeak_CHANNEL_ID || process.env.ThinkSpeak_CHANNEL_ID || ""
};

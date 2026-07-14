import mongoose from "mongoose";
import { settings } from "./settings.js";

const redactMongoUri = (uri) => uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
const srvDnsErrorCodes = new Set(["ECONNREFUSED", "ETIMEOUT", "ENOTFOUND", "ENODATA"]);

function atlasDirectUriFromSrv(uri) {
  if (!uri.startsWith("mongodb+srv://")) return "";

  const parsed = new URL(uri);
  const [clusterName, ...domainParts] = parsed.hostname.split(".");
  if (!clusterName || domainParts.length < 2) return "";

  const shardHosts = [0, 1, 2]
    .map((index) => `${clusterName}-shard-00-0${index}.${domainParts.join(".")}:27017`)
    .join(",");
  const database = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : `/${settings.mongodbDatabase}`;
  const params = parsed.searchParams;

  if (!params.has("ssl") && !params.has("tls")) params.set("ssl", "true");
  if (!params.has("authSource")) params.set("authSource", "admin");
  if (!params.has("retryWrites")) params.set("retryWrites", "true");
  if (!params.has("w")) params.set("w", "majority");

  return `mongodb://${parsed.username}:${parsed.password}@${shardHosts}${database}?${params.toString()}`;
}

async function connectWithUri(uri, label) {
  try {
    await mongoose.connect(uri, {
      dbName: settings.mongodbDatabase,
      autoIndex: true,
      serverSelectionTimeoutMS: 15000
    });
  } catch (error) {
    const nestedErrors = [...(error?.reason?.servers?.values?.() || [])]
      .map((server) => server?.error?.cause?.code || server?.error?.code)
      .filter(Boolean);

    if (
      error?.code === "ENOTFOUND"
      || error?.code === "ECONNREFUSED"
      || nestedErrors.some((code) => srvDnsErrorCodes.has(code))
    ) {
      error.message = [
        error.message,
        "",
        "MongoDB Atlas hostname lookup failed on this network.",
        "Fix options:",
        "1. Keep DNS_SERVERS=8.8.8.8,1.1.1.1 in backend/.env and restart the terminal.",
        "2. If your network blocks public DNS, switch to another network or VPN.",
        "3. In Atlas, open Connect > Drivers and copy the non-SRV mongodb:// seed-list URI into MONGODB_DIRECT_URI."
      ].join("\n");
    }

    throw error;
  }
  console.log(`MongoDB connected (${label}): ${redactMongoUri(uri)} / ${settings.mongodbDatabase}`);
}

export async function connectDatabase() {
  mongoose.set("strictQuery", false);
  try {
    await connectWithUri(settings.mongodbUri, "configured URI");
  } catch (error) {
    const shouldTryDirect =
      settings.mongodbUri.startsWith("mongodb+srv://")
      && srvDnsErrorCodes.has(error?.code);
    const directUri = settings.mongodbDirectUri || atlasDirectUriFromSrv(settings.mongodbUri);

    if (!shouldTryDirect || !directUri) {
      throw error;
    }

    console.warn(
      `MongoDB SRV DNS lookup failed (${error.code}); retrying with direct Atlas seed list.`
    );
    await connectWithUri(directUri, "direct seed list fallback");
  }
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export async function ensureIndexes(models) {
  await Promise.all(Object.values(models).map((model) => model.createIndexes()));
}

export function utcNow() {
  return new Date();
}

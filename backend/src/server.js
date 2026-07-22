import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { settings } from "./config/settings.js";
import { connectDatabase, disconnectDatabase, ensureIndexes } from "./config/database.js";
import { models } from "./models/index.js";
import { bootstrapResearcher } from "./services/auth.js";
import apiRouter from "./routes/api.js";

const app = express();

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (settings.corsOrigins.includes(origin)) return true;

  try {
    const { hostname, protocol } = new URL(origin);
    if (
      settings.appEnv !== "production"
      && ["http:", "https:", "capacitor:"].includes(protocol)
      && ["localhost", "127.0.0.1", "::1"].includes(hostname)
    ) {
      return true;
    }
    return (
      protocol === "https:"
      && /^stress-research-platform(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(hostname)
    );
  } catch {
    return false;
  }
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(settings.appEnv === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => res.json({ status: "ok", database: "mongodb" }));
app.get("/", (_req, res) => res.redirect(`${settings.frontendUrl.replace(/\/$/, "")}/researcher/login`));
app.use(settings.apiPrefix, apiRouter);

app.use((_req, res) => {
  res.status(404).json({ detail: "Not found" });
});

app.use((error, _req, res, _next) => {
  const isDuplicateKey = error?.code === 11000;
  const status = isDuplicateKey ? 409 : error.status || 500;
  const detail = isDuplicateKey
    ? "A record with the same unique value already exists"
    : error.detail || error.message || "Internal server error";
  if (status >= 500) console.error(error);
  res.status(status).json({ detail });
});

async function start() {
  await connectDatabase();
  await ensureIndexes(models);
  await bootstrapResearcher();
  const server = app.listen(settings.port, () => {
    console.log(`${settings.appName} listening on http://127.0.0.1:${settings.port}`);
  });

  server.on("error", async (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${settings.port} is already in use. Stop the process using it or start this API with a different PORT.`
      );
    } else {
      console.error("Backend server error", error);
    }

    await disconnectDatabase();
    process.exit(1);
  });

  const shutdown = async () => {
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});

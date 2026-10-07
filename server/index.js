import { createStore } from "./store.js";
import { demoData } from "./data.js";
import { createApp } from "./app.js";
import { hashPassword, token } from "./security.js";
import { createApplicationNotifier, createAppointmentNotifier, createEmailSender, createEmergencyNotifier, createOrderNotifier, createSignupNotifier } from "./email.js";
import { databaseUri, emailConfig, aiKey } from "./local-secrets.js";
import { configureAtlasDns } from "./atlas-dns.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
configureAtlasDns();
// Honour the build-watch output directory used by `npm run dev` so direct
// navigation and page refreshes serve the same preview build being rebuilt.
const distDirectory = process.env.AERIX_DIST_DIR;
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
if (distDirectory) process.env.AERIX_DIST_DIR = path.resolve(projectRoot, distDirectory);
const production = process.env.NODE_ENV === "production";
const demoMode = process.env.DEMO_MODE ? process.env.DEMO_MODE === "true" : !production;
// A local preview can use Gmail verification when the current Windows account
// can unlock its saved settings. If not, keep the preview usable and let the
// account screen clearly show that email signup is unavailable.
let mail = {};
try {
  mail = emailConfig();
} catch (error) {
  if (!demoMode) throw error;
  console.warn("AERIX preview email is not configured for this Windows account. Email signup is paused; demo accounts remain available.");
}
const config = {
  production,
  demo: demoMode,
  // Local previews use a dedicated Atlas database when enabled. Never point
  // sample accounts or appointments at the live database.
  mongoUri: undefined,
  dbName: undefined,
  origin: process.env.APP_ORIGIN || "http://localhost:5173",
  // A local demo must never spend API credit; use the offline guide instead.
  openaiKey: demoMode ? undefined : aiKey(),
  openaiModel: process.env.OPENAI_MODEL,
  trustProxy: process.env.TRUST_PROXY,
  sendEmail: createEmailSender(mail),
  notifyApplication: createApplicationNotifier(mail),
  notifyEmergency: createEmergencyNotifier(mail),
  notifySignup: createSignupNotifier(mail),
  notifyAppointment: createAppointmentNotifier(mail),
  notifyOrder: createOrderNotifier(mail),
  emailSecret: mail.EMAIL_CODE_SECRET,
};
// The presentation preview is local-first so an intermittent Atlas/network
// outage cannot break signup or OTP persistence. Opt into the separate Atlas
// preview database explicitly when you want to test that integration.
if (
  demoMode &&
  process.env.DEMO_USE_DATABASE === "true" &&
  process.env.DEMO_ALLOW_ATLAS_PREVIEW === "true"
) {
  try {
    config.mongoUri = databaseUri();
    config.dbName = process.env.MONGODB_DEMO_DB || "aerix_demo";
    if (config.dbName === (process.env.MONGODB_DB || "aerix")) {
      throw new Error("The preview database must be separate from the live database.");
    }
  } catch {
    config.mongoUri = undefined;
    config.dbName = undefined;
    console.warn("AERIX preview is using local storage. Atlas credentials are unavailable or the preview database is not separate from live data.");
  }
} else if (!demoMode) {
  config.mongoUri = databaseUri();
  config.dbName = process.env.MONGODB_DB;
}
if (
  production &&
  (config.demo || !config.mongoUri || !config.origin.startsWith("https://"))
)
  throw new Error(
    "Production requires DEMO_MODE=false, MongoDB and an HTTPS APP_ORIGIN.",
  );
config.dummyHash = await hashPassword(token());
let store;
try {
  store = await createStore(config);
} catch {
  if (!demoMode || !config.mongoUri) {
    console.error("AERIX could not connect to Atlas. Run npm run check:database for a private diagnosis. Your database credential was not printed.");
    process.exit(1);
  }
  console.warn("Atlas is unavailable. AERIX is continuing with local preview storage; preview data will not sync.");
  store = await createStore({ ...config, mongoUri: undefined, dbName: undefined });
  // Keep the reported runtime configuration aligned with the store actually
  // selected after a failed Atlas connection.
  config.mongoUri = undefined;
  config.dbName = undefined;
}
if (demoMode) {
  for (const [collection, rows] of Object.entries(demoData())) {
    for (const row of rows) {
      if (!(await store.one(collection, { _id: row._id }))) {
        await store.insert(collection, row);
      }
    }
  }
}
const app = createApp(store, config);
const port = Number(process.env.PORT || 4000);
const server = app.listen(
  port,
  process.env.HOST || (production ? "0.0.0.0" : "127.0.0.1"),
  (error) => {
    if (error) {
      console.error(
        `AERIX could not start: ${error.code === "EADDRINUSE" ? `port ${port} is already in use. Stop the existing preview first.` : error.message}`,
      );
      store.close().finally(() => {
        process.exitCode = 1;
      });
      return;
    }
    console.log(
      `AERIX API ready on port ${port}. Mode: ${config.demo ? "preview" : "live"}. Database: ${config.mongoUri ? "MongoDB preview database" : "local preview storage"}. Health guide: free and offline. Email: ${config.sendEmail ? "configured" : "not configured"}.`,
    );
  },
);
async function stop() {
  server.close();
  await store.close();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

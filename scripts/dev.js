import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const useAtlas = process.argv.includes("--atlas");
const preferredPort = Number(process.env.PORT || 4000);

async function portIsFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
  });
}

let port = preferredPort;
while (port < preferredPort + 20 && !(await portIsFree(port))) port += 1;
if (port >= preferredPort + 20) {
  console.error(`No free AERIX preview port found from ${preferredPort} to ${port - 1}.`);
  process.exit(1);
}

const env = {
  ...process.env,
  PORT: String(port),
  APP_ORIGIN: `http://localhost:${port}`,
  DEMO_MODE: "true",
  DEMO_USE_DATABASE: "true",
  DEMO_ALLOW_ATLAS_PREVIEW: useAtlas ? "true" : "false",
  AERIX_DIST_DIR: path.join(root, ".aerix-preview-dist"),
};

console.log(`AERIX preview will open at http://localhost:${port}`);
console.log("Use demo accounts for the presentation; no real patient data.");

const child = spawn(
  process.execPath,
  [
    path.join(root, "node_modules", "concurrently", "dist", "bin", "concurrently.js"),
    "-k",
    "-n",
    "API,BUILD",
    "node --env-file-if-exists=.env server/index.js",
    "vite build --watch --configLoader native --outDir .aerix-preview-dist",
  ],
  { cwd: root, env, stdio: "inherit", windowsHide: true },
);

child.on("error", (error) => {
  console.error(`Could not start AERIX preview: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

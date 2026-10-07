import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
export function databaseUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const file = path.join(root, ".secrets", "mongodb.dpapi");
  if (!fs.existsSync(file)) return undefined;
  if (process.platform !== "win32")
    throw new Error(
      "Set MONGODB_URI in your hosting environment. Windows credentials are local only.",
    );
  try {
    return execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-File",
        path.join(root, "server", "read-secret.ps1"),
        "-SecretFile",
        file,
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 10000,
        stdio: ["ignore", "pipe", "pipe"],
      },
    ).trim();
  } catch {
    throw new Error(
      "Cannot unlock the local database credential. Run SETUP-DATABASE.ps1 with this Windows account.",
    );
  }
}

export function aiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const file = path.join(root, ".secrets", "openai.dpapi");
  if (!fs.existsSync(file)) return undefined;
  if (process.platform !== "win32")
    throw new Error("Set OPENAI_API_KEY in your hosting environment.");
  try {
    return execFileSync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-File",
      path.join(root, "server", "read-secret.ps1"), "-SecretFile", file,
    ], { encoding: "utf8", windowsHide: true, timeout: 10000, stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    throw new Error("Cannot unlock the local AI credential. Run npm run setup:ai with this Windows account.");
  }
}

const emailKeys = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "EMAIL_FROM",
  "EMAIL_CODE_SECRET",
  "EMAIL_WEB_URL",
  "EMAIL_WEB_TOKEN",
];

export function emailConfig(env = process.env) {
  if (
    ((env.EMAIL_WEB_URL && env.EMAIL_WEB_TOKEN && env.EMAIL_CODE_SECRET) ||
      ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM", "EMAIL_CODE_SECRET"].every(
        (key) => !!env[key],
      ))
  )
    return Object.fromEntries(emailKeys.map((key) => [key, env[key] || ""]));
  const file = path.join(root, ".secrets", "email.dpapi");
  let local = {};
  if (fs.existsSync(file)) {
    if (process.platform !== "win32")
      throw new Error("Set email credentials in the hosting environment.");
    try {
      const plain = execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-File",
          path.join(root, "server", "read-secret.ps1"),
          "-SecretFile",
          file,
        ],
        {
          encoding: "utf8",
          windowsHide: true,
          timeout: 10000,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      local = JSON.parse(plain);
    } catch {
      throw new Error(
        "Cannot unlock the local email credential. Run setup:email with this Windows account.",
      );
    }
  }
  return Object.fromEntries(
    emailKeys.map((key) => [key, env[key] || local[key] || ""]),
  );
}

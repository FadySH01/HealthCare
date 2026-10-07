import { emailConfig } from "./local-secrets.js";
import { createEmailTransport, validWebConfig, webRequest } from "./email.js";

let transport;
let config;
try {
  config = emailConfig();
  transport = createEmailTransport(config);
  if (config.EMAIL_WEB_URL || config.EMAIL_WEB_TOKEN) {
    if (!validWebConfig(config)) throw new Error("Gmail HTTPS settings are incomplete");
    await webRequest(config, { action: "check" });
    console.log("AERIX Gmail HTTPS connection succeeded. No email was sent.");
  } else if (!transport || !config.EMAIL_CODE_SECRET || config.EMAIL_CODE_SECRET.length < 32) {
    console.error("Email is not configured. Run npm run setup:email first.");
    process.exitCode = 1;
  } else {
    await transport.verify();
    console.log("AERIX email connection succeeded. No email was sent.");
  }
} catch (error) {
  const code = typeof error?.code === "string" ? error.code : "";
  const reason = code === "EAUTH" || Number(error?.responseCode) === 535
    ? "Gmail rejected the sign-in. Confirm the sender address and create a fresh Google App Password, then run npm run setup:email again."
    : ["ETIMEDOUT", "ECONNECTION", "ESOCKET", "ENOTFOUND", "EAI_AGAIN"].includes(code)
      ? "Could not reach Gmail SMTP. Check the internet connection, firewall, or VPN, then try again."
      : error?.message?.startsWith("Cannot unlock the local email credential")
        ? "The encrypted email settings cannot be opened by this Windows account. Run npm run setup:email in this account again."
        : config?.EMAIL_WEB_URL || config?.EMAIL_WEB_TOKEN
          ? "Check the Google Apps Script deployment URL, access settings and private token."
          : "Check the Gmail address, App Password, 2-Step Verification, and internet connection.";
  console.error(`Email connection not confirmed${code ? ` (${code})` : ""}. ${reason}`);
  console.error("No email credentials were printed.");
  process.exitCode = 1;
} finally {
  transport?.close();
}

import OpenAI from "openai";
import { aiKey } from "./local-secrets.js";
try {
  const key = aiKey();
  if (!key) throw new Error("No API key");
  console.log("Checking the OpenAI connection with one short test response. API charges may apply.");
  const client = new OpenAI({ apiKey: key, timeout: 20000, maxRetries: 0 });
  const result = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    input: "Reply with OK.",
    max_output_tokens: 40,
    store: false,
  });
  if (!result.output_text) throw new Error("No response");
  console.log("AERIX AI connection succeeded. No health information was sent.");
} catch (error) {
  const status = Number.isInteger(error?.status) ? `HTTP ${error.status}` : null;
  const code = typeof error?.code === "string" ? error.code : null;
  const safeReasons = {
    invalid_api_key: "The API key was rejected. Create a new key in the same OpenAI project and run npm run setup:ai again.",
    insufficient_quota: "This OpenAI API project has no available credit. Add API billing or credits, then try again.",
    billing_hard_limit_reached: "The OpenAI API project reached its spending limit. Review its API billing limits.",
    model_not_found: "The selected model is unavailable to this API project. Check model access or change OPENAI_MODEL.",
    permission_denied: "The API key does not have permission to create Responses. Set Responses to Write.",
  };
  const reason = safeReasons[code]
    || (error?.status === 401 ? "The API key was rejected. Create a new key and save it again."
      : error?.status === 403 ? "The API key or project does not have permission for this request."
        : error?.status === 429 ? "The API project has no available credit, reached a usage limit, or is temporarily rate limited. Check API billing and usage."
          : error?.name === "APIConnectionError" ? "The computer could not reach OpenAI. Check the internet connection, firewall, or VPN."
            : "Check the API key, project billing, Responses permission, model access, and internet connection.");
  console.error(`AERIX AI connection is not confirmed${status || code ? ` (${[status, code].filter(Boolean).join(", ")})` : ""}.`);
  console.error(reason);
  console.error("No API key or private response was printed.");
  process.exitCode = 1;
}

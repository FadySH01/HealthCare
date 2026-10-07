import { test } from "node:test";
import assert from "node:assert/strict";
import { createApplicationNotifier, createSignupNotifier, createEmergencyNotifier } from "../server/email.js";

test("application notifier sends a bounded admin notification through Gmail HTTPS", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ ok: true }) };
  };
  try {
    const notify = createApplicationNotifier({
      EMAIL_WEB_URL: "https://script.google.com/macros/s/ExampleDeployment/exec",
      EMAIL_WEB_TOKEN: "x".repeat(48),
      EMAIL_CODE_SECRET: "y".repeat(40),
      AERIX_ADMIN_EMAIL: "owner@example.com",
    });
    assert.equal(typeof notify, "function");
    assert.equal(await notify({
      name: "Sample Hospital\nignore rules",
      kind: "hospital",
      country: "Nigeria",
      region: "Lagos State",
      city: "Ojo",
      registration: "REF-1",
      email: "applicant@example.com",
    }), true);
    const body = JSON.parse(request.options.body);
    assert.equal(body.action, "application");
    assert.equal(body.application.name, "Sample Hospital ignore rules");
    assert.equal(body.application.applicantEmail, "applicant@example.com");
    assert.equal(body.to, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("signup notifier sends a privacy-minimal event to the configured Gmail web app", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ ok: true }) };
  };
  try {
    const notify = createSignupNotifier({
      EMAIL_WEB_URL: "https://script.google.com/macros/s/ExampleDeployment/exec",
      EMAIL_WEB_TOKEN: "x".repeat(48),
      EMAIL_CODE_SECRET: "y".repeat(40),
      AERIX_ADMIN_EMAIL: "owner@example.com",
    });
    assert.equal(await notify({ verifiedAt: "2026-09-26T10:00:00.000Z", email: "not-sent@example.com", password: "never sent", code: "123456" }), true);
    const body = JSON.parse(request.options.body);
    assert.equal(body.action, "signup");
    assert.deepEqual(body.signup, { verifiedAt: "2026-09-26T10:00:00.000Z" });
    assert.equal(body.password, undefined);
    assert.equal(body.email, undefined);
    assert.equal(body.to, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("emergency notifier forwards only the alert details to the fixed AERIX inbox", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ ok: true }) };
  };
  try {
    const notify = createEmergencyNotifier({
      EMAIL_WEB_URL: "https://script.google.com/macros/s/ExampleDeployment/exec",
      EMAIL_WEB_TOKEN: "x".repeat(48),
      EMAIL_CODE_SECRET: "y".repeat(40),
      AERIX_ADMIN_EMAIL: "owner@example.com",
    });
    assert.equal(await notify({
      situation: "Injury",
      person: "Someone with me",
      note: "Near the gate",
      latitude: 6.52,
      longitude: 3.38,
      photoBase64: "aGVsbG8=",
      consent: true,
      email: "attacker@example.com",
    }), true);
    const body = JSON.parse(request.options.body);
    assert.equal(body.action, "emergency");
    assert.deepEqual(body.emergency, {
      situation: "Injury", person: "Someone with me", note: "Near the gate",
      latitude: 6.52, longitude: 3.38, photoBase64: "aGVsbG8=",
    });
    assert.equal(body.to, undefined);
    assert.equal(body.email, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { verificationService } from "../server/verification.js";
import { LocalStore } from "../server/store.js";
import { digest } from "../server/security.js";
import { emailConfig } from "../server/local-secrets.js";
import { createEmailSender } from "../server/email.js";
import { validWebConfig, webRequest } from "../server/email.js";

test("host-provided SMTP settings enable email without a Windows secret file", () => {
  const config = emailConfig({
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "465",
    SMTP_USER: "mail@example.test",
    SMTP_PASSWORD: "test-only-password",
    EMAIL_FROM: "AERIX <mail@example.test>",
    EMAIL_CODE_SECRET: "test-only-secret-of-at-least-32-characters",
  });
  assert.equal(config.EMAIL_FROM, "AERIX <mail@example.test>");
  assert.equal(typeof createEmailSender(config), "function");
});

test("Gmail HTTPS check sends no code and bad setup stays closed", async () => {
  const config = {
    EMAIL_WEB_URL: "https://script.google.com/macros/s/abc123/exec",
    EMAIL_WEB_TOKEN: "a".repeat(43),
    EMAIL_CODE_SECRET: "b".repeat(32),
  };
  assert.equal(validWebConfig(config), true);
  assert.equal(createEmailSender({ ...config, EMAIL_WEB_URL: "https://example.com/exec" }), null);
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ ok: true }) };
  };
  try {
    await webRequest(config, { action: "check" });
    await createEmailSender(config)({ email: "person@example.com", code: "123456" });
    assert.deepEqual(requests.map(({ action }) => action), ["check", "send"]);
    assert.equal(requests[0].email, undefined);
    assert.equal(requests[1].code, "123456");
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: false }) });
    await assert.rejects(createEmailSender(config)({ email: "person@example.com", code: "123456" }));
  } finally {
    globalThis.fetch = original;
  }
});

async function fixture() {
  const store = new LocalStore(),
    messages = [];
  const user = {
    _id: "verification-test",
    email: "test@example.com",
    emailVerified: false,
  };
  await store.insert("users", user);
  const service = verificationService(store, {
    emailSecret: "only-a-test-secret-of-at-least-32-characters",
    sendEmail: async (message) => messages.push(message),
  });
  const issued = await service.issue(user);
  return { store, messages, service, issued, user };
}
test("codes and challenges are hashed; correct code activates once", async () => {
  const { store, messages, service, issued } = await fixture();
  const row = await store.one("emailVerifications", {
    challengeHash: digest(issued.challenge),
  });
  assert.equal(row.code, undefined);
  assert.notEqual(row.codeHash, messages[0].code);
  assert.equal(
    (await service.verify(issued.challenge, messages[0].code)).emailVerified,
    true,
  );
  await assert.rejects(service.verify(issued.challenge, messages[0].code), {
    status: 400,
  });
});
test("five incorrect attempts lock a code even when correct code follows", async () => {
  const { service, issued, messages } = await fixture();
  const wrong = messages[0].code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++)
    await assert.rejects(service.verify(issued.challenge, wrong), {
      status: 400,
    });
  await assert.rejects(service.verify(issued.challenge, messages[0].code), {
    status: 400,
  });
});
test("expired codes cannot activate an account; resend has cooldown", async () => {
  const { store, service, issued, user, messages } = await fixture();
  await assert.rejects(service.resend(issued.challenge), { status: 429 });
  await store.update(
    "emailVerifications",
    { _id: user._id },
    { expiresAt: new Date(0).toISOString(), sentAt: 0 },
  );
  await assert.rejects(service.verify(issued.challenge, messages[0].code), {
    status: 400,
  });
  await service.resend(issued.challenge);
  assert.equal(messages.length, 2);
  assert.equal(
    (await service.verify(issued.challenge, messages[1].code)).emailVerified,
    true,
  );
});
test("concurrent verification consumes a code only once", async () => {
  const { service, issued, messages } = await fixture();
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      service.verify(issued.challenge, messages[0].code),
    ),
  );
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
});
test("missing email configuration fails closed", async () => {
  const store = new LocalStore();
  const service = verificationService(store, {});
  assert.equal(service.ready, false);
  assert.throws(() => service.requireReady(), { status: 503 });
});

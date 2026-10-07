import { randomInt, createHmac, timingSafeEqual } from "node:crypto";
import { token, digest } from "./security.js";
const fail = (status, message) => Object.assign(new Error(message), { status });
export function verificationService(store, config) {
  const ready =
    !!config.sendEmail &&
    typeof config.emailSecret === "string" &&
    config.emailSecret.length >= 32;
  const hash = (challenge, code) =>
    createHmac("sha256", config.emailSecret)
      .update(`${challenge}:${code}`)
      .digest("hex");
  function requireReady() {
    if (!ready)
      throw fail(
        503,
        "Email verification is not connected yet. Please try again after the email service is configured.",
      );
  }
  async function issue(user, existingToken) {
    requireReady();
    const old = await store.one("emailVerifications", { _id: user._id });
    if (old && Date.now() - old.sentAt < 60000)
      throw fail(429, "Please wait one minute before requesting another code.");
    if (
      existingToken &&
      (!old || old.challengeHash !== digest(existingToken) || old.used)
    )
      throw fail(
        400,
        "This verification session has ended. Sign in to request a new code.",
      );
    const challenge = existingToken || token(),
      code = String(randomInt(0, 1000000)).padStart(6, "0");
    const row = {
      _id: user._id,
      challengeHash: digest(challenge),
      codeHash: hash(challenge, code),
      attempts: 0,
      used: false,
      sentAt: Date.now(),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    };
    if (old) {
      if (
        !(await store.update(
          "emailVerifications",
          {
            _id: user._id,
            sentAt: old.sentAt,
            challengeHash: old.challengeHash,
          },
          row,
        ))
      )
        throw fail(429, "A code request is already in progress.");
    } else {
      try {
        await store.insert("emailVerifications", row);
      } catch (e) {
        if (e.code === 11000)
          throw fail(429, "A code request is already in progress.");
        throw e;
      }
    }
    try {
      await config.sendEmail({ email: user.email, code });
    } catch {
      throw fail(
        503,
        "The email could not be sent. Wait one minute, then sign in to try again.",
      );
    }
    return {
      verificationRequired: true,
      challenge,
      email: user.email,
      expiresAt: row.expiresAt,
      resendAfter: 60,
    };
  }
  async function verify(challenge, code) {
    requireReady();
    const row = await store.one("emailVerifications", {
      challengeHash: digest(challenge),
    });
    if (
      !row ||
      row.used ||
      row.attempts >= 5 ||
      new Date(row.expiresAt) <= new Date()
    )
      throw fail(
        400,
        "This code expired or has been used. Request a new code.",
      );
    // Reserve an attempt atomically so simultaneous requests cannot bypass the limit.
    const claimed = await store.update(
      "emailVerifications",
      {
        _id: row._id,
        challengeHash: row.challengeHash,
        codeHash: row.codeHash,
        attempts: row.attempts,
        used: false,
      },
      { attempts: row.attempts + 1 },
    );
    if (!claimed)
      throw fail(409, "Another verification is in progress. Try again.");
    if (
      !timingSafeEqual(
        Buffer.from(row.codeHash, "hex"),
        Buffer.from(hash(challenge, code), "hex"),
      )
    )
      throw fail(
        400,
        "That code is incorrect. Check your email and try again.",
      );
    const consumed = await store.update(
      "emailVerifications",
      {
        _id: row._id,
        challengeHash: row.challengeHash,
        codeHash: row.codeHash,
        used: false,
      },
      { used: true },
    );
    if (!consumed) throw fail(400, "This code has already been used.");
    return store.update(
      "users",
      { _id: row._id },
      { emailVerified: true, verifiedAt: new Date().toISOString() },
    );
  }
  async function resend(challenge) {
    const row = await store.one("emailVerifications", {
      challengeHash: digest(challenge),
    });
    if (!row || row.used)
      throw fail(400, "Sign in to start email verification again.");
    const user = await store.one("users", { _id: row._id });
    if (!user || user.emailVerified) throw fail(400, "Sign in to continue.");
    return issue(user, challenge);
  }
  return { ready, requireReady, issue, verify, resend };
}

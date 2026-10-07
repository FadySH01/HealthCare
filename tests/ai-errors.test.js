import { test } from "node:test";
import assert from "node:assert/strict";
import { aiFailureMessage } from "../server/ai-errors.js";

test("AI failures distinguish exhausted credit from temporary limits", () => {
  assert.match(aiFailureMessage({ status: 429, code: "credit_balance_exhausted" }), /no available credit/);
  assert.match(aiFailureMessage({ status: 429, code: "rate_limit_exceeded" }), /temporarily busy/);
  assert.doesNotMatch(aiFailureMessage({ status: 429, code: "rate_limit_exceeded" }), /no available credit/);
  assert.match(aiFailureMessage({ status: 503 }), /unavailable/);
});

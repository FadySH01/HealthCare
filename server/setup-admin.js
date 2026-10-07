import { createInterface } from "node:readline/promises";
import { randomUUID } from "node:crypto";
import { createStore } from "./store.js";
import { databaseUri } from "./local-secrets.js";

if (process.env.DEMO_MODE === "true") {
  console.error("First administrator setup is only for the live database.");
  process.exit(1);
}

const mongoUri = databaseUri();
if (!mongoUri) {
  console.error("Live Atlas is not configured for this Windows account.");
  process.exit(1);
}

const input = createInterface({ input: process.stdin, output: process.stdout });
let store;
let promotedAccount = false;
try {
  store = await createStore({ mongoUri, dbName: process.env.MONGODB_DB || "aerix", demo: false });
  if (await store.count("users", { role: "admin" })) {
    console.error("An administrator already exists. This one-time setup will not change another account.");
    process.exitCode = 1;
  } else {
    const address = (await input.question("Email of your existing, verified AERIX account: ")).trim().toLowerCase();
    const user = await store.one("users", { email: address, role: "patient", emailVerified: true });
    if (!user) {
      console.error("No verified patient account matches that email. Sign up and verify it first.");
      process.exitCode = 1;
    } else {
      console.log(`This will make ${user.name} the first AERIX administrator.`);
      const confirmation = await input.question("Type PROMOTE to continue: ");
      if (confirmation !== "PROMOTE") {
        console.log("No account was changed.");
      } else {
        const promoted = await store.update("users", { _id: user._id, role: "patient", emailVerified: true }, { role: "admin", updatedAt: new Date().toISOString() });
        if (!promoted) throw new Error("The account changed during setup. Nothing was promoted.");
        promotedAccount = true;
        await store.insert("audit", { _id: randomUUID(), actorId: user._id, action: "admin.bootstrap", resource: user._id, createdAt: new Date().toISOString() });
        console.log("Administrator ready. Sign out and sign in again to open the AERIX workspace.");
      }
    }
  }
} catch {
  console.error(promotedAccount ? "The account was promoted but the audit write could not be confirmed. Check the admin workspace before retrying." : "Administrator setup could not finish. Check Atlas access from this terminal; no credentials were printed.");
  process.exitCode = 1;
} finally {
  input.close();
  if (store) await store.close();
}

import { createStore } from "./store.js";
import { databaseUri } from "./local-secrets.js";
import { configureAtlasDns } from "./atlas-dns.js";
let store;
try {
  configureAtlasDns();
  const uri = databaseUri();
  if (!uri) {
    console.error("No database credential is saved. Run npm run setup:database first.");
    process.exitCode = 1;
    process.exit();
  }
  const parsed = new URL(uri);
  if (parsed.hostname !== "cluster0.1uc195x.mongodb.net") {
    console.error("The saved connection points to another cluster. Re-run npm run setup:database.");
    process.exitCode = 1;
    process.exit();
  }
  if (!parsed.username || !parsed.password) {
    console.error("The saved connection is missing a database username or password. Re-run setup.");
    process.exitCode = 1;
    process.exit();
  }
  const databaseName = process.env.MONGODB_DEMO_DB || "aerix_demo";
  if (databaseName === (process.env.MONGODB_DB || "aerix")) {
    throw new Error("The preview database must be separate from the live database.");
  }
  store = await createStore({
    demo: true,
    mongoUri: uri,
    dbName: databaseName,
  });
  await store.ping();
  console.log(`Atlas preview database access succeeded (${databaseName}). No sample data was inserted.`);
} catch (error) {
  // Never print the driver's full error: it may contain connection details.
  const name = String(error?.name || "");
  const code = String(error?.code || error?.cause?.code || "");
  const details = [String(error?.message || ""), String(error?.cause?.message || "")];
  if (error?.reason?.servers) {
    for (const server of error.reason.servers.values()) {
      details.push(String(server?.error?.message || ""));
    }
  }
  const reason = details.join(" ");
  let advice = "Connection failed for an unknown reason. Check the saved database user, password, and Atlas cluster status.";
  if (/Cannot unlock the local database credential/i.test(reason))
    advice = "This Windows account could not decrypt the saved credential. Run setup and the connection check from the same VS Code terminal account.";
  else if (code === "18" || /Authentication failed|bad auth|authenticat/i.test(reason))
    advice = "Atlas rejected the database username or password. The Atlas website login is separate from a database-user password.";
  else if (/ENOTFOUND|EAI_AGAIN|querySrv|DNS|ETIMEOUT|ETIMEDOUT/i.test(reason + code))
    advice = "The cluster address could not be reached or resolved. Check internet access, DNS and Atlas cluster status.";
  else if (/ECONNREFUSED|TLS|certificate/i.test(reason + code))
    advice = "The connection was refused or TLS failed. Check your network and Atlas cluster status.";
  else if (code === "13" || /not authorized|unauthorized/i.test(reason))
    advice = "The database user can reach Atlas but lacks permission for the AERIX preview database. Grant readWrite access to aerix_demo in Atlas Database Access.";
  else if (name === "MongoServerSelectionError")
    advice = "Atlas could not be reached. Check the cluster status and Atlas Network Access.";
  console.error(
    `Atlas connection not confirmed (${name || "Error"}${code ? `, ${code}` : ""}). ${advice} No credentials were printed.`,
  );
  if (error?.reason?.servers instanceof Map) {
    const serverStates = [...error.reason.servers.entries()].map(([address, server]) => {
      const failure = server?.error;
      const cause = failure?.cause;
      const failureCode = failure?.code || cause?.code;
      const failureName = failure?.name || "none";
      const safeAddress = /^[a-z0-9.-]+\.mongodb\.net:\d+$/i.test(address)
        ? address
        : "Atlas node";
      return `${safeAddress}: ${server?.type || "Unknown"}; ${failureName}${failureCode ? ` (${failureCode})` : ""}`;
    });
    if (serverStates.length) console.error(`Atlas nodes: ${serverStates.join(" | ")}`);
  }
  process.exitCode = 1;
} finally {
  if (store) await store.close();
}

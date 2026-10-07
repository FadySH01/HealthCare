import { createStore } from "./store.js";
import { demoData } from "./data.js";
if (process.env.DEMO_MODE !== "true" || !process.env.MONGODB_URI)
  throw new Error(
    "Seeding requires DEMO_MODE=true and a dedicated demo MongoDB database.",
  );
const store = await createStore({
  demo: true,
  mongoUri: process.env.MONGODB_URI,
  dbName: process.env.MONGODB_DB || "aerix_demo",
});
for (const [collection, rows] of Object.entries(demoData()))
  for (const row of rows)
    if (!(await store.one(collection, { _id: row._id })))
      await store.insert(collection, row);
await store.close();
console.log(
  "Fictional demo providers and demo users seeded. Existing records preserved.",
);

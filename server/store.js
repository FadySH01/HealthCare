import { MongoClient } from "mongodb";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { demoData } from "./data.js";
const match = (row, query) =>
  Object.entries(query).every(([k, v]) => row[k] === v);
export class LocalStore {
  constructor(file) {
    this.file = file;
    this.data =
      file && fs.existsSync(file)
        ? JSON.parse(fs.readFileSync(file, "utf8"))
        : demoData();
    const sample = demoData();
    if (!Array.isArray(this.data.doctors) || this.data.doctors.length === 0) this.data.doctors = sample.doctors;
    if (!Array.isArray(this.data.availability)) this.data.availability = [];
    for (const facility of this.data.facilities || []) {
      const refreshed = sample.facilities.find((row) => row._id === facility._id);
      if (facility.sample && refreshed) facility.services = refreshed.services;
    }
    this.save();
  }
  save() {
    if (this.file) {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(`${this.file}.tmp`, JSON.stringify(this.data));
      fs.renameSync(`${this.file}.tmp`, this.file);
    }
  }
  async all(c, q = {}) {
    return structuredClone((this.data[c] || []).filter((r) => match(r, q)));
  }
  async one(c, q) {
    return (await this.all(c, q))[0] || null;
  }
  async count(c, q = {}) {
    return (await this.all(c, q)).length;
  }
  async insert(c, row) {
    const list = (this.data[c] ||= []);
    if (
      list.some((x) => x._id === row._id) ||
      (c === "users" && list.some((x) => x.email === row.email)) ||
      (c === "appointments" &&
        row.active &&
        list.some(
          (x) =>
            x.active &&
            x.facilityId === row.facilityId &&
            x.date === row.date &&
            x.time === row.time,
        )) ||
      (c === "availability" && list.some((x) => x.doctorId === row.doctorId && x.date === row.date && x.time === row.time))
    ) {
      const e = new Error("Conflict");
      e.code = 11000;
      throw e;
    }
    list.push(structuredClone(row));
    this.save();
    return row;
  }
  async update(c, q, patch) {
    const row = (this.data[c] || []).find((r) => match(r, q));
    if (!row) return null;
    Object.assign(row, structuredClone(patch));
    this.save();
    return structuredClone(row);
  }
  async remove(c, q) {
    this.data[c] = (this.data[c] || []).filter((r) => !match(r, q));
    this.save();
  }
  async close() {}
  async ping() { return true; }
  async activatePartner(applicationId, details, adminId) {
    const application = (this.data.applications || []).find((a) => a._id === applicationId && a.status === "reviewing");
    const user = application && (this.data.users || []).find((u) => u._id === application.userId && u.role === "patient" && u.emailVerified);
    if (!user) return null;
    const facility = partnerFacility(application, details);
    (this.data.facilities ||= []).push(facility);
    user.role = application.kind === "hospital" ? "clinic" : "pharmacy";
    user.facilityId = facility._id;
    Object.assign(application, { status: "approved", facilityId: facility._id, reviewedBy: adminId, reviewedAt: facility.updatedAt, verificationNote: details.verificationNote });
    this.save();
    return facility;
  }
}
function partnerFacility(application, details) {
  return {
    _id: randomUUID(), name: application.name, kind: application.kind,
    city: application.city, country: application.country, locationId: "lagos",
    timeZone: "Africa/Lagos", lat: details.lat, lng: details.lng,
    services: application.kind === "hospital" ? details.services : ["Pharmacy collection", "Pharmacist consultation"],
    accepting: false, hours: details.hours, description: details.description,
    address: details.address, phone: details.phone, sample: false,
    registration: application.registration,
    updatedAt: new Date().toISOString(), color: application.kind === "hospital" ? "violet" : "green",
    image: application.kind === "hospital" ? "care" : "pharmacy",
  };
}
export async function createStore(config) {
  if (!config.mongoUri) {
    if (!config.demo)
      throw new Error("MONGODB_URI is required outside demo mode.");
    return new LocalStore(config.dataFile || path.resolve(".data/demo.json"));
  }
  const client = new MongoClient(config.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });
  try {
    await client.connect();
    const db = client.db(config.dbName || "aerix");
    await Promise.all([
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
      db
        .collection("sessions")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db
        .collection("appointments")
        .createIndex(
          { facilityId: 1, date: 1, time: 1 },
          { unique: true, partialFilterExpression: { active: true } },
        ),
      db.collection("appointments").createIndex({ userId: 1 }),
      db.collection("orders").createIndex({ userId: 1 }),
      db.collection("facilities").createIndex({ country: 1, city: 1, kind: 1 }),
      db.collection("products").createIndex({ pharmacyId: 1 }),
      db.collection("doctors").createIndex({ facilityId: 1, active: 1 }),
      db.collection("availability").createIndex({ doctorId: 1, date: 1, time: 1 }, { unique: true }),
    ]);
    return {
    async ping() {
      await db.command({ ping: 1 });
      return true;
    },
    async count(c, q = {}) {
      return db.collection(c).countDocuments(q);
    },
    async all(c, q = {}) {
      return db.collection(c).find(q).limit(500).toArray();
    },
    async one(c, q) {
      return db.collection(c).findOne(q);
    },
    async insert(c, row) {
      await db.collection(c).insertOne(row);
      return row;
    },
    async update(c, q, p) {
      return db
        .collection(c)
        .findOneAndUpdate(q, { $set: p }, { returnDocument: "after" });
    },
    async remove(c, q) {
      await db.collection(c).deleteMany(q);
    },
    async close() {
      await client.close();
    },
    async activatePartner(applicationId, details, adminId) {
      const session = client.startSession();
      try {
        let facility = null;
        await session.withTransaction(async () => {
          const application = await db.collection("applications").findOne({ _id: applicationId, status: "reviewing" }, { session });
          const user = application && await db.collection("users").findOne({ _id: application.userId, role: "patient", emailVerified: true }, { session });
          if (!user) return;
          facility = partnerFacility(application, details);
          await db.collection("facilities").insertOne(facility, { session });
          const promoted = await db.collection("users").updateOne({ _id: user._id, role: "patient" }, { $set: { role: application.kind === "hospital" ? "clinic" : "pharmacy", facilityId: facility._id } }, { session });
          const approved = await db.collection("applications").updateOne({ _id: applicationId, status: "reviewing" }, { $set: { status: "approved", facilityId: facility._id, reviewedBy: adminId, reviewedAt: facility.updatedAt, verificationNote: details.verificationNote } }, { session });
          if (promoted.modifiedCount !== 1 || approved.modifiedCount !== 1) throw new Error("Partner activation changed during review");
        });
        return facility;
      } finally {
        await session.endSession();
      }
    },
    };
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}

import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../server/app.js";
import { LocalStore } from "../server/store.js";
import { token, digest } from "../server/security.js";

test("live booking needs a clinic-published clinician time and staff confirmation", async () => {
  const store = new LocalStore();
  const facilityId = "live-ojo-test";
  await store.insert("facilities", { _id: facilityId, name: "Pilot Test Hospital", kind: "hospital", country: "Nigeria", city: "Ojo", locationId: "lagos", timeZone: "Africa/Lagos", services: ["General care"], accepting: false, sample: false });
  await store.insert("users", { _id: "live-clinic-test", name: "Clinic Staff", email: "clinic-live-test@example.com", role: "clinic", facilityId, emailVerified: true });
  await store.insert("users", { _id: "live-patient-test", name: "Patient", email: "patient-live-test@example.com", role: "patient", emailVerified: true });
  const app = createApp(store, { demo: false, test: true, mongoUri: "test-only" });
  async function auth(userId) {
    const raw = token();
    const csrf = token();
    await store.insert("sessions", { _id: digest(raw), userId, csrf, expiresAt: new Date(Date.now() + 3600000) });
    return { Cookie: `aerix_session=${raw}`, "X-CSRF-Token": csrf, "X-Requested-With": "AERIX", Origin: "http://localhost:5173" };
  }
  const clinic = await auth("live-clinic-test");
  const patient = await auth("live-patient-test");
  const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const doctor = await request(app).post("/api/doctors").set(clinic).send({ name: "Dr Pilot Test", specialty: "General practice", registration: "TEST-ONLY", consentConfirmed: true });
  assert.equal(doctor.status, 201);
  const base = { facilityId, doctorId: doctor.body._id, date, time: "11:00", service: "General care" };
  assert.equal((await request(app).post("/api/appointments").set(patient).send(base)).status, 409);
  assert.equal((await request(app).patch(`/api/facilities/${facilityId}`).set(clinic).send({ accepting: true })).status, 409);
  const offered = await request(app).post("/api/availability").set(clinic).send({ doctorId: doctor.body._id, date, time: "11:00" });
  assert.equal(offered.status, 201);
  assert.equal((await request(app).patch(`/api/facilities/${facilityId}`).set(clinic).send({ accepting: true })).status, 200);
  const slots = await request(app).get(`/api/facilities/${facilityId}/slots?date=${date}&doctorId=${doctor.body._id}`).set(clinic);
  assert.equal(slots.status, 200);
  assert.deepEqual(slots.body.slots, ["11:00"]);
  assert.equal((await request(app).post("/api/appointments").set(patient).send({ ...base, time: "12:00" })).status, 409);
  const booked = await request(app).post("/api/appointments").set(patient).send(base);
  assert.equal(booked.status, 201);
  assert.equal(booked.body.status, "requested");
  assert.equal(booked.body.doctorName, "Dr Pilot Test");
  assert.equal((await request(app).delete(`/api/availability/${offered.body._id}`).set(clinic).send({})).status, 409);
  const confirmed = await request(app).patch(`/api/appointments/${booked.body._id}`).set(clinic).send({ status: "confirmed" });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.status, "confirmed");
});

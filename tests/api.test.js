import { test, before } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../server/app.js";
import { LocalStore } from "../server/store.js";
import { hashPassword, verifyPassword } from "../server/security.js";
let app, store;
const mailbox = [];
const applicationNotices = [];
const signupNotices = [];
const emergencyNotices = [];
before(async () => {
  store = new LocalStore();
  app = createApp(store, {
    demo: true,
    test: true,
    emailSecret: "test-only-secret-at-least-32-characters",
    sendEmail: async (message) => {
      mailbox.push(message);
    },
    notifyApplication: async (application) => {
      applicationNotices.push(application);
      return true;
    },
    notifySignup: async (user) => {
      signupNotices.push(user);
      return true;
    },
    notifyEmergency: async (alert) => {
      emergencyNotices.push(alert);
      return true;
    },
    dummyHash: await hashPassword("not-a-real-password-123"),
  });
});
const headers = {
  "X-Requested-With": "AERIX",
  Origin: "http://localhost:5173",
};
test("browser page refreshes receive the app shell", async () => {
  const response = await request(app).get("/account");
  assert.equal(response.status, 200);
  assert.match(response.text, /<div id="root"><\/div>/);
});
async function session(role = "patient") {
  const agent = request.agent(app);
  const response = await agent
    .post("/api/auth/demo")
    .set(headers)
    .send({ role });
  assert.equal(response.status, 200);
  return {
    agent,
    csrf: response.body.csrf,
    headers: { ...headers, "X-CSRF-Token": response.body.csrf },
  };
}
const future = new Date(Date.now() + 7 * 86400000);
while (future.getUTCDay() === 0) future.setUTCDate(future.getUTCDate() + 1);
const date = future.toISOString().slice(0, 10);

test("health endpoint checks storage without exposing credentials", async () => {
  const healthy = await request(app).get("/api/health");
  assert.equal(healthy.status, 200);
  assert.equal(healthy.body.ok, true);
  assert.equal(healthy.body.ai, undefined);
  const originalPing = store.ping;
  store.ping = async () => { throw new Error("private database detail"); };
  try {
    const failed = await request(app).get("/api/health");
    assert.equal(failed.status, 503);
    assert.equal(failed.body.ok, false);
    assert.doesNotMatch(JSON.stringify(failed.body), /private database detail/);
  } finally {
    store.ping = originalPing;
  }
});

test("public feedback is validated, rate limited, and readable only by admins", async () => {
  const payload = { category: "idea", message: "Make the hospital finder easier to use." };
  const sent = await request(app).post("/api/feedback").set(headers).send(payload);
  assert.equal(sent.status, 201);
  assert.equal(sent.body.ok, true);
  assert.equal((await request(app).post("/api/feedback").set(headers).send({ ...payload, privateNotes: "no" })).status, 400);
  const patient = await session("patient");
  const admin = await session("admin");
  assert.equal((await patient.agent.get("/api/admin")).status, 403);
  const inbox = await admin.agent.get("/api/admin");
  assert.equal(inbox.body.feedback[0].message, payload.message);
  assert.equal(inbox.body.feedback[0].userId, undefined);
});

test("admin registration directory is admin-only and never exposes credentials", async () => {
  await store.insert("users", {
    _id: "directory-test-user", name: "Directory Test", email: "directory-test@example.com",
    role: "patient", emailVerified: true, createdAt: new Date().toISOString(), passwordHash: "must-not-leak",
  });
  const patient = await session("patient");
  const admin = await session("admin");
  assert.equal((await patient.agent.get("/api/admin")).status, 403);
  const response = await admin.agent.get("/api/admin");
  assert.equal(response.status, 200);
  const account = response.body.users.find((user) => user._id === "directory-test-user");
  assert.equal(account.email, "directory-test@example.com");
  assert.equal(account.emailVerified, true);
  assert.equal(account.passwordHash, undefined);
  assert.equal(JSON.stringify(response.body.users).includes("must-not-leak"), false);
  assert.equal(response.body.users.some((user) => user._id === "demo-admin"), false);
});

test("a guest can email an emergency alert without signing in; consent is required and alerts are not stored", async () => {
  const before = emergencyNotices.length;
  const payload = {
    situation: "Injury", person: "Someone with me", note: "Near the gate",
    latitude: 6.52, longitude: 3.38, photoBase64: "aGVsbG8=", consent: true,
  };
  const response = await request(app).post("/api/emergency-alert").set(headers).send(payload);
  assert.equal(response.status, 202);
  assert.deepEqual(emergencyNotices.at(-1), {
    situation: "Injury", person: "Someone with me", note: "Near the gate",
    latitude: 6.52, longitude: 3.38, photoBase64: "aGVsbG8=", consent: true,
  });
  assert.equal((await request(app).post("/api/emergency-alert").set(headers).send({ ...payload, consent: false })).status, 400);
  assert.equal((await request(app).post("/api/emergency-alert").set(headers).send({ ...payload, latitude: 6.52, longitude: null })).status, 400);
  assert.equal(emergencyNotices.length, before + 1);
});

test("signup explains a MongoDB outage instead of returning a generic server error", async () => {
  const originalInsert = store.insert;
  store.insert = async (collection, row) => {
    if (collection === "users") {
      const error = new Error("private Atlas connection details");
      error.name = "MongoServerSelectionError";
      throw error;
    }
    return originalInsert.call(store, collection, row);
  };
  try {
    const response = await request(app)
      .post("/api/auth/register")
      .set(headers)
      .send({ name: "Database Test", email: "db-outage@example.com", password: "safe-testing-passphrase", consent: true });
    assert.equal(response.status, 503);
    assert.match(response.body.error, /database request/i);
    assert.match(response.body.error, /Atlas connection/i);
    assert.doesNotMatch(response.body.error, /private Atlas connection details/);
  } finally {
    store.insert = originalInsert;
  }
});

test("only an admin can activate a reviewed and independently checked Lagos provider", async () => {
  const applicantId = "partner-test-patient";
  const applicationId = "partner-test-application";
  await store.insert("users", { _id: applicantId, name: "Partner Contact", email: "partner-test@example.com", role: "patient", emailVerified: true, passwordHash: "test" });
  await store.insert("applications", { _id: applicationId, userId: applicantId, name: "Verified Test Hospital", kind: "hospital", city: "Epe", region: "Lagos State", country: "Nigeria", registration: "TEST-REFERENCE", email: "partner-test@example.com", status: "pending" });
  const details = { address: "10 Example Street, Lagos", phone: "+234 800 000 0000", hours: "Mon-Fri 09:00-17:00", description: "A test clinic for the provider onboarding workflow.", lat: 6.52, lng: 3.38, services: ["General care"], verificationNote: "Official registry checked and facility manager called for this test.", licenceChecked: true, contactConfirmed: true };
  const patient = await session("patient");
  const admin = await session("admin");
  assert.equal((await patient.agent.post(`/api/applications/${applicationId}/activate`).set(patient.headers).send(details)).status, 403);
  assert.equal((await admin.agent.post(`/api/applications/${applicationId}/activate`).set(admin.headers).send(details)).status, 409);
  assert.equal((await admin.agent.patch(`/api/applications/${applicationId}`).set(admin.headers).send({ status: "reviewing" })).status, 200);
  assert.equal((await admin.agent.post(`/api/applications/${applicationId}/activate`).set(admin.headers).send({ ...details, contactConfirmed: false })).status, 400);
  const activated = await admin.agent.post(`/api/applications/${applicationId}/activate`).set(admin.headers).send(details);
  assert.equal(activated.status, 201);
  assert.equal(activated.body.accepting, false);
  assert.equal(activated.body.sample, false);
  assert.equal(activated.body.city, "Epe");
  assert.equal(activated.body.verificationNote, undefined);
  assert.equal((await store.one("users", { _id: applicantId })).role, "clinic");
  assert.equal((await store.one("applications", { _id: applicationId })).status, "approved");
  assert.equal((await admin.agent.post(`/api/applications/${applicationId}/activate`).set(admin.headers).send(details)).status, 409);
});

test("pharmacy staff can list only non-prescription products for their facility", async () => {
  const patient = await session("patient");
  const pharmacy = await session("pharmacy");
  const listing = { name: "Basic bandage pack", category: "First aid", description: "A sealed pack of dressings.", price: 1200, stock: 4, icon: "bandage" };
  assert.equal((await patient.agent.post("/api/products").set(patient.headers).send(listing)).status, 403);
  assert.equal((await pharmacy.agent.post("/api/products").set(pharmacy.headers).send({ ...listing, prescription: true })).status, 400);
  const created = await pharmacy.agent.post("/api/products").set(pharmacy.headers).send(listing);
  assert.equal(created.status, 201);
  assert.equal(created.body.prescription, false);
  assert.equal(created.body.pharmacyId, "lagos-pharmacy");
});

test("clinic controls the clinician roster and patients cannot invent a doctor", async () => {
  const clinic = await session("clinic");
  const patient = await session("patient");
  const listing = { name: "Dr Example", specialty: "General practice", registration: "TEST-DOCTOR-1", consentConfirmed: true };
  assert.equal((await patient.agent.post("/api/doctors").set(patient.headers).send(listing)).status, 403);
  assert.equal((await clinic.agent.post("/api/doctors").set(clinic.headers).send({ ...listing, consentConfirmed: false })).status, 400);
  const created = await clinic.agent.post("/api/doctors").set(clinic.headers).send(listing);
  assert.equal(created.status, 201);
  const roster = await patient.agent.get("/api/doctors?facilityId=lagos-care");
  assert.equal(roster.status, 200);
  assert.equal(roster.body.some((d) => d._id === created.body._id), true);
  assert.equal(roster.body.find((d) => d._id === created.body._id).registration, undefined);
  const hidden = await clinic.agent.patch(`/api/doctors/${created.body._id}`).set(clinic.headers).send({ active: false });
  assert.equal(hidden.status, 200);
  assert.equal((await patient.agent.get("/api/doctors?facilityId=lagos-care")).body.some((d) => d._id === created.body._id), false);
  const invalid = await patient.agent.post("/api/appointments").set(patient.headers).send({ facilityId: "lagos-care", date, time: "16:00", service: "General care", doctorId: created.body._id });
  assert.equal(invalid.status, 400);
});

test("only clinic staff publish and withdraw clinician times", async () => {
  const clinic = await session("clinic");
  const patient = await session("patient");
  const doctor = await clinic.agent.post("/api/doctors").set(clinic.headers).send({ name: "Dr Slot Test", specialty: "General practice", registration: "TEST-SLOT-1", consentConfirmed: true });
  assert.equal(doctor.status, 201);
  const offered = { doctorId: doctor.body._id, date, time: "15:00" };
  assert.equal((await patient.agent.post("/api/availability").set(patient.headers).send(offered)).status, 403);
  const published = await clinic.agent.post("/api/availability").set(clinic.headers).send(offered);
  assert.equal(published.status, 201);
  assert.equal((await clinic.agent.post("/api/availability").set(clinic.headers).send(offered)).status, 409);
  assert.equal((await clinic.agent.get("/api/staff/availability")).body.some((slot) => slot._id === published.body._id), true);
  assert.equal((await patient.agent.delete(`/api/availability/${published.body._id}`).set(patient.headers).send({})).status, 403);
  assert.equal((await clinic.agent.delete(`/api/availability/${published.body._id}`).set(clinic.headers).send({})).status, 200);
});
test("care catalogue and private records require authentication", async () => {
  assert.equal((await request(app).get("/api/facilities")).status, 401);
  assert.equal((await request(app).get("/api/products")).status, 401);
  assert.equal((await request(app).get(`/api/facilities/lagos-care/slots?date=${date}`)).status, 401);
  const patient = await session();
  assert.equal((await patient.agent.get("/api/facilities")).body.filter((f) => f.sample).length, 24);
  assert.equal((await request(app).get("/api/appointments")).status, 401);
  assert.equal((await request(app).get("/api/orders")).status, 401);
});
test("origin checks, JSON enforcement and session CSRF block forged requests", async () => {
  const { agent } = await session();
  assert.equal((await agent.post("/api/orders").send({})).status, 403);
  assert.equal(
    (
      await agent
        .post("/api/orders")
        .set({ ...headers, Origin: "https://evil.example" })
        .send({})
    ).status,
    403,
  );
  assert.equal(
    (await agent.post("/api/orders").set(headers).send({})).status,
    403,
  );
});
test("session cookies are HTTP-only and strict; credentials are not returned", async () => {
  const r = await request(app)
    .post("/api/auth/demo")
    .set(headers)
    .send({ role: "patient" });
  assert.match(r.headers["set-cookie"][0], /HttpOnly/);
  assert.match(r.headers["set-cookie"][0], /SameSite=Strict/);
  assert.equal(r.body.user.passwordHash, undefined);
  assert.equal(
    (await store.all("sessions")).some((s) =>
      r.headers["set-cookie"][0].includes(s._id),
    ),
    false,
  );
});
test("registration rejects mass-assigned staff roles and object injection", async () => {
  const body = {
    name: "Test",
    email: "person@example.com",
    password: "a-long-safe-passphrase",
    consent: true,
  };
  assert.equal(
    (
      await request(app)
        .post("/api/auth/register")
        .set(headers)
        .send({ ...body, role: "admin" })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/auth/login")
        .set(headers)
        .send({ email: { $ne: null }, password: "abc" })
    ).status,
    400,
  );
});
test("password hashing and successful registration/login/logout", async () => {
  const agent = request.agent(app);
  const body = {
    name: "Test Patient",
    email: "test@example.com",
    password: "unique-passphrase-for-testing",
    consent: true,
  };
  const signupsBeforeVerification = signupNotices.length;
  let r = await agent.post("/api/auth/register").set(headers).send(body);
  assert.equal(r.status, 202);
  assert.equal(signupNotices.length, signupsBeforeVerification);
  assert.equal((await agent.get("/api/auth/me")).body.user, null);
  r = await agent
    .post("/api/auth/verify-email")
    .set(headers)
    .send({ challenge: r.body.challenge, code: mailbox.at(-1).code });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, "patient");
  await new Promise((resolve) => setTimeout(resolve, 0));
  const signupNotice = signupNotices.at(-1);
  assert.equal(typeof signupNotice.verifiedAt, "string");
  assert.equal(signupNotice.email, undefined);
  assert.equal(signupNotice.name, undefined);
  assert.equal(signupNotice.password, undefined);
  assert.equal(signupNotice.code, undefined);
  const u = await store.one("users", { email: body.email });
  assert.notEqual(u.passwordHash, body.password);
  assert.equal(await verifyPassword(body.password, u.passwordHash), true);
  const csrf = r.body.csrf;
  r = await agent
    .post("/api/auth/logout")
    .set({ ...headers, "X-CSRF-Token": csrf })
    .send({});
  assert.equal(r.status, 200);
  assert.equal((await agent.get("/api/auth/me")).body.user, null);
  assert.equal(
    (
      await agent
        .post("/api/auth/login")
        .set(headers)
        .send({ email: body.email, password: "wrong" })
    ).status,
    401,
  );
  assert.equal(
    (
      await agent
        .post("/api/auth/login")
        .set(headers)
        .send({ email: body.email, password: body.password })
    ).status,
    200,
  );
});
test("booking is unique under concurrent requests; clinic confirms and patient cancels", async () => {
  const p = await session(),
    c = await session("clinic");
  const body = {
    facilityId: "lagos-care",
    date,
    time: "10:00",
    service: "General care",
  };
  const results = await Promise.all([
    p.agent.post("/api/appointments").set(p.headers).send(body),
    p.agent.post("/api/appointments").set(p.headers).send(body),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const row = results.find((r) => r.status === 201).body;
  const available = await p.agent.get(
    `/api/facilities/lagos-care/slots?date=${date}`,
  );
  assert.equal(available.body.slots.includes("10:00"), false);
  assert.equal(
    (
      await c.agent
        .patch(`/api/appointments/${row._id}`)
        .set(c.headers)
        .send({ status: "confirmed" })
    ).status,
    200,
  );
  assert.equal(
    (await p.agent.get("/api/appointments")).body.find((a) => a._id === row._id)
      .status,
    "confirmed",
  );
  assert.equal(
    (
      await p.agent
        .patch(`/api/appointments/${row._id}`)
        .set(p.headers)
        .send({ status: "cancelled" })
    ).status,
    200,
  );
  assert.equal(
    (
      await p.agent.get(`/api/facilities/lagos-care/slots?date=${date}`)
    ).body.slots.includes("10:00"),
    true,
  );
});
test("ownership boundaries deny another patient and unrelated staff", async () => {
  const p = await session(),
    ph = await session("pharmacy");
  const r = await p.agent.post("/api/appointments").set(p.headers).send({
    facilityId: "lagos-care",
    date,
    time: "11:00",
    service: "General care",
  });
  assert.equal(r.status, 201);
  const agent = request.agent(app);
  let reg = await agent.post("/api/auth/register").set(headers).send({
    name: "Other Patient",
    email: "other@example.com",
    password: "another-long-password-unique",
    consent: true,
  });
  reg = await agent
    .post("/api/auth/verify-email")
    .set(headers)
    .send({ challenge: reg.body.challenge, code: mailbox.at(-1).code });
  assert.equal(reg.status, 200);
  assert.equal((await agent.get("/api/appointments")).body.length, 0);
  assert.equal(
    (
      await agent
        .patch(`/api/appointments/${r.body._id}`)
        .set({ ...headers, "X-CSRF-Token": reg.body.csrf })
        .send({ status: "cancelled" })
    ).status,
    403,
  );
  assert.equal(
    (
      await ph.agent
        .patch(`/api/appointments/${r.body._id}`)
        .set(ph.headers)
        .send({ status: "confirmed" })
    ).status,
    403,
  );
  assert.equal((await p.agent.get("/api/admin")).status, 403);
});
test("past dates, invalid dates, invalid services and closed clinic cannot be booked", async () => {
  const p = await session();
  const body = {
    facilityId: "lagos-care",
    date: "2020-01-01",
    time: "09:00",
    service: "General care",
  };
  assert.equal(
    (await p.agent.post("/api/appointments").set(p.headers).send(body)).status,
    400,
  );
  assert.equal(
    (
      await p.agent
        .post("/api/appointments")
        .set(p.headers)
        .send({ ...body, date: "2026-02-31" })
    ).status,
    400,
  );
  assert.equal(
    (
      await p.agent
        .post("/api/appointments")
        .set(p.headers)
        .send({ ...body, date, service: "Invented" })
    ).status,
    400,
  );
  const c = await session("clinic");
  assert.equal(
    (
      await c.agent
        .patch("/api/facilities/accra-care")
        .set(c.headers)
        .send({ accepting: false })
    ).status,
    403,
  );
  await c.agent
    .patch("/api/facilities/lagos-care")
    .set(c.headers)
    .send({ accepting: false });
  assert.equal(
    (
      await p.agent
        .post("/api/appointments")
        .set(p.headers)
        .send({ ...body, date })
    ).status,
    409,
  );
  await c.agent
    .patch("/api/facilities/lagos-care")
    .set(c.headers)
    .send({ accepting: true });
});
test("collection uses authoritative prices and pharmacist status transitions", async () => {
  const p = await session(),
    ph = await session("pharmacy");
  assert.equal(
    (
      await p.agent
        .post("/api/orders")
        .set(p.headers)
        .send({ productId: "lagos-first-aid", quantity: 1, total: 1 })
    ).status,
    400,
  );
  const r = await p.agent
    .post("/api/orders")
    .set(p.headers)
    .send({ productId: "lagos-first-aid", quantity: 2 });
  assert.equal(r.status, 201);
  assert.equal(r.body.total, 17000);
  assert.equal(
    (
      await p.agent
        .patch(`/api/orders/${r.body._id}`)
        .set(p.headers)
        .send({ status: "ready" })
    ).status,
    403,
  );
  assert.equal(
    (
      await ph.agent
        .patch(`/api/orders/${r.body._id}`)
        .set(ph.headers)
        .send({ status: "ready" })
    ).status,
    200,
  );
  assert.equal(
    (
      await ph.agent
        .patch(`/api/orders/${r.body._id}`)
        .set(ph.headers)
        .send({ status: "collected" })
    ).status,
    200,
  );
  assert.equal(
    (
      await ph.agent
        .patch(`/api/orders/${r.body._id}`)
        .set(ph.headers)
        .send({ status: "ready" })
    ).status,
    409,
  );
});
test("prescription products, oversize quantities and foreign stock edits are blocked", async () => {
  const p = await session(),
    ph = await session("pharmacy");
  assert.equal(
    (
      await p.agent
        .post("/api/orders")
        .set(p.headers)
        .send({ productId: "lagos-prescription", quantity: 1 })
    ).status,
    400,
  );
  assert.equal(
    (
      await p.agent
        .post("/api/orders")
        .set(p.headers)
        .send({ productId: "lagos-first-aid", quantity: 999 })
    ).status,
    400,
  );
  assert.equal(
    (
      await ph.agent
        .patch("/api/products/accra-first-aid")
        .set(ph.headers)
        .send({ stock: 9 })
    ).status,
    404,
  );
  assert.equal(
    (
      await ph.agent
        .patch("/api/products/lagos-first-aid")
        .set(ph.headers)
        .send({ stock: 0 })
    ).status,
    200,
  );
  assert.equal(
    (
      await p.agent
        .post("/api/orders")
        .set(p.headers)
        .send({ productId: "lagos-first-aid", quantity: 1 })
    ).status,
    409,
  );
});
test("AI requires authentication and consent; missing key is explicit", async () => {
  const p = await session();
  assert.equal(
    (await request(app).post("/api/chat").set(headers).send({ messages: [] }))
      .status,
    401,
  );
  assert.equal(
    (
      await p.agent
        .post("/api/chat")
        .set(p.headers)
        .send({
          consent: false,
          messages: [{ role: "user", content: "Hello" }],
        })
    ).status,
    400,
  );
  assert.equal(
    (
      await p.agent
        .post("/api/chat")
        .set(p.headers)
        .send({ consent: true, messages: [{ role: "user", content: "Hello" }] })
    ).status,
    503,
  );
});
test("admin reviews provider applications without granting privileges", async () => {
  const p = await session(),
    a = await session("admin");
  const outOfArea = await p.agent.post("/api/applications").set(p.headers).send({
    name: "Out of area Hospital",
    kind: "hospital",
    country: "Nigeria",
    region: "Oyo State",
    city: "Ibadan",
    registration: "DEMO-OUTSIDE",
  });
  assert.equal(outOfArea.status, 400);
  const r = await p.agent.post("/api/applications").set(p.headers).send({
    name: "Example Hospital",
    kind: "hospital",
    country: "Nigeria",
    region: "Lagos State",
    city: "Epe",
    registration: "DEMO-001",
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.emailSent, true);
  assert.equal(applicationNotices.at(-1).name, "Example Hospital");
  assert.equal(applicationNotices.at(-1).email, "patient@demo.aerix.invalid");
  assert.equal(
    (
      await a.agent
        .patch(`/api/applications/${r.body._id}`)
        .set(a.headers)
        .send({ status: "reviewing" })
    ).status,
    200,
  );
  assert.equal((await p.agent.get("/api/auth/me")).body.user.role, "patient");
});
test("provider application stays saved when the email notification service is down", async () => {
  const isolatedStore = new LocalStore();
  const isolatedApp = createApp(isolatedStore, {
    demo: true,
    test: true,
    emailSecret: "test-only-secret-at-least-32-characters",
    dummyHash: await hashPassword("not-a-real-password-123"),
    notifyApplication: async () => { throw new Error("mail service unavailable"); },
  });
  const agent = request.agent(isolatedApp);
  const login = await agent.post("/api/auth/demo").set(headers).send({ role: "patient" });
  const response = await agent.post("/api/applications").set({ ...headers, "X-CSRF-Token": login.body.csrf }).send({
    name: "Saved Test Hospital", kind: "hospital", country: "Nigeria", region: "Lagos State", city: "Ojo", registration: "TEST-REF",
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.emailSent, false);
  assert.equal((await isolatedStore.one("applications", { _id: response.body._id })).name, "Saved Test Hospital");
});
test("production refuses demo mode; demo endpoint and sample records are disabled in live mode", async () => {
  assert.throws(() =>
    createApp(store, {
      production: true,
      demo: true,
      origin: "https://aerix.example",
    }),
  );
  const live = createApp(store, { demo: false, test: true });
  assert.equal(
    (
      await request(live)
        .post("/api/auth/demo")
        .set(headers)
        .send({ role: "admin" })
    ).status,
    404,
  );
  assert.equal((await request(live).get("/api/facilities")).status, 401);
  assert.equal((await request(live).get("/api/products")).status, 401);
});
test("security headers and request body limits are present", async () => {
  const r = await request(app).get("/api/health");
  assert.match(r.headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.match(r.headers["content-security-policy"], /img-src[^;]*blob:/);
  assert.equal(r.headers["permissions-policy"], "geolocation=(self), camera=(), microphone=(self)");
  assert.equal(r.headers["x-content-type-options"], "nosniff");
  assert.equal(r.headers["cache-control"], "no-store");
  assert.equal(
    (
      await request(app)
        .post("/api/auth/login")
        .set(headers)
        .send({ email: "x".repeat(25000) })
    ).status,
    413,
  );
});

import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import OpenAI from "openai";
import {
  token,
  digest,
  hashPassword,
  verifyPassword,
  publicUser,
  assistantInstructions,
} from "./security.js";
import { locations, countries } from "./data.js";
import { verificationService } from "./verification.js";
import { nearbyPlaces } from "./places.js";
import { aiFailureMessage } from "./ai-errors.js";

const id = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9-]+$/);
const text = z.string().trim().min(1).max(120);
const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8, "Use at least 8 characters.").max(128);
const slots = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00"];
const fail = (status, message) => Object.assign(new Error(message), { status });
const dateAt = (zone) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
function validDate(date, zone) {
  const d = new Date(`${date}T12:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(+d) &&
    d.toISOString().slice(0, 10) === date &&
    date > dateAt(zone) &&
    +d < Date.now() + 91 * 86400000
  );
}

export function createApp(store, config = {}) {
  const verification = verificationService(store, config);
  const app = express(),
    production = !!config.production,
    demo = !!config.demo;
  if (production && (demo || !config.origin?.startsWith("https://")))
    throw new Error(
      "Production requires demo disabled and an HTTPS APP_ORIGIN.",
    );
  const origins = new Set(
    production
      ? [config.origin]
      : [
          config.origin,
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "http://localhost:4000",
          "http://127.0.0.1:4000",
        ].filter(Boolean),
  );
  const cookieName = production ? "__Host-aerix" : "aerix_session";
  const cookieOptions = {
    httpOnly: true,
    secure: production,
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  };
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", Number(config.trustProxy));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'"],
          frameSrc: ["https://www.openstreetmap.org"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: production ? [] : null,
        },
      },
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use((_req, res, next) => {
    res.set("Permissions-Policy", "geolocation=(self), camera=(), microphone=(self)");
    next();
  });
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: config.test ? 10000 : 150,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many requests. Please try again shortly." },
    }),
  );
  app.use(
    "/api/emergency-alert",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: config.test ? 1000 : 3,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many alert attempts. Please call local emergency services directly." },
    }),
    express.json({ limit: "700kb" }),
  );
  app.use(express.json({ limit: "20kb" }));
  app.use(cookieParser());
  app.use("/api", (req, _res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (
        req.get("X-Requested-With") !== "AERIX" ||
        !req.is("application/json")
      )
        return next(fail(403, "Request verification failed."));
      if (req.get("Origin") && !origins.has(req.get("Origin")))
        return next(fail(403, "Origin not allowed."));
      if (req.get("Sec-Fetch-Site") === "cross-site")
        return next(fail(403, "Cross-site request blocked."));
    }
    next();
  });
  app.use("/api", async (req, _res, next) => {
    try {
      const raw = req.cookies[cookieName];
      if (typeof raw === "string" && /^[a-f0-9]{64}$/.test(raw)) {
        const session = await store.one("sessions", { _id: digest(raw) });
        if (session && new Date(session.expiresAt) > new Date()) {
          const user = await store.one("users", { _id: session.userId });
          if (
            user &&
            (user._id.startsWith("demo-") ? demo : user.emailVerified === true)
          ) {
            req.user = user;
            req.session = session;
          }
        }
      }
      next();
    } catch (e) {
      next(e);
    }
  });
  const auth = (req, _res, next) =>
    req.user ? next() : next(fail(401, "Please sign in to continue."));
  const roles =
    (...allowed) =>
    (req, _res, next) =>
      req.user && allowed.includes(req.user.role)
        ? next()
        : next(fail(403, "You do not have permission for this action."));
  const csrf = (req, _res, next) =>
    req.session?.csrf === req.get("X-CSRF-Token")
      ? next()
      : next(fail(403, "Session verification failed. Refresh and try again."));
  const mutations = [auth, csrf];
  const audit = async (req, action, resource) =>
    store.insert("audit", {
      _id: randomUUID(),
      actorId: req.user?._id || "anonymous",
      action,
      resource,
      createdAt: new Date().toISOString(),
    });
  async function signIn(req, res, user) {
    if (req.session) await store.remove("sessions", { _id: req.session._id });
    const raw = token(),
      csrfToken = token();
    await store.insert("sessions", {
      _id: digest(raw),
      userId: user._id,
      csrf: csrfToken,
      expiresAt: new Date(Date.now() + cookieOptions.maxAge),
    });
    res
      .cookie(cookieName, raw, cookieOptions)
      .json({ user: publicUser(user), csrf: csrfToken });
  }
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: config.test ? 1000 : 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Please wait 15 minutes." },
  });
  app.get("/api/health", async (_req, res) => {
    try {
      await store.ping();
      res.json({ ok: true, demo, storage: config.mongoUri ? "mongodb" : "local-demo" });
    } catch {
      res.status(503).json({ ok: false, storage: "unavailable" });
    }
  });
  app.get("/api/config", (_req, res) =>
    res.json({
      demo,
      ai: Boolean(config.openaiKey && !demo),
      emailDelivery: verification.ready,
      emergencyEmailDelivery: typeof config.notifyEmergency === "function",
      locations,
      countries,
      slots,
    }),
  );
  app.get("/api/auth/me", (req, res) =>
    res.json({ user: publicUser(req.user), csrf: req.session?.csrf || null }),
  );
  app.post("/api/emergency-alert", async (req, res) => {
    if (typeof config.notifyEmergency !== "function")
      throw fail(503, "AERIX emergency email is not configured. Use the contact options or call local emergency services directly.");
    const input = z.object({
      situation: z.enum(["Sudden illness", "Injury", "Road incident", "Other urgent concern"]),
      person: z.enum(["Myself", "Someone with me", "A family member"]),
      note: z.string().trim().max(240).default(""),
      latitude: z.number().min(-90).max(90).nullable(),
      longitude: z.number().min(-180).max(180).nullable(),
      photoBase64: z.string().max(520_000).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/).default(""),
      consent: z.literal(true),
    }).strict().superRefine((value, ctx) => {
      if ((value.latitude === null) !== (value.longitude === null)) {
        ctx.addIssue({ code: "custom", message: "Share both location coordinates or leave both blank." });
      }
      if (value.photoBase64 && value.photoBase64.length % 4 !== 0) {
        ctx.addIssue({ code: "custom", message: "The photo could not be read. Please choose it again." });
      }
    }).parse(req.body);
    try {
      await config.notifyEmergency(input);
      res.status(202).json({ ok: true });
    } catch {
      throw fail(503, "AERIX could not send the email alert. Use the contact options or call local emergency services directly.");
    }
  });
  app.post("/api/auth/register", authLimit, async (req, res) => {
    const input = z
      .object({ name: text, email, password, consent: z.literal(true) })
      .strict()
      .parse(req.body);
    verification.requireReady();
    const user = {
      _id: randomUUID(),
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: "patient",
      emailVerified: false,
      createdAt: new Date().toISOString(),
    };
    try {
      await store.insert("users", user);
    } catch (e) {
      if (e.code === 11000)
        throw fail(409, "Unable to create this account. Try signing in.");
      throw e;
    }
    res.status(202).json(await verification.issue(user));
  });
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const input = z
      .object({ email, password: z.string().min(1).max(128) })
      .strict()
      .parse(req.body);
    const user = await store.one("users", { email: input.email });
    // Always perform an expensive comparison to reduce account-enumeration timing differences.
    const valid = await verifyPassword(
      input.password,
      user?.passwordHash || config.dummyHash,
    );
    if (!user || !valid || user._id.startsWith("demo-"))
      throw fail(401, "Email or password is incorrect.");
    if (!user.emailVerified)
      return res.status(202).json(await verification.issue(user));
    await signIn(req, res, user);
  });
  const challengeSchema = z.string().regex(/^[a-f0-9]{64}$/);
  app.post("/api/auth/verify-email", authLimit, async (req, res) => {
    const { challenge, code } = z
      .object({ challenge: challengeSchema, code: z.string().regex(/^\d{6}$/) })
      .strict()
      .parse(req.body);
    const user = await verification.verify(challenge, code);
    if (!user) throw fail(400, "Account no longer exists.");
    await signIn(req, res, user);
    if (config.sendEmail) {
      void Promise.resolve().then(() => config.sendEmail({ email: user.email, name: user.name, welcome: true }))
        .catch(() => console.warn("AERIX welcome email could not be delivered."));
    }
    if (config.notifySignup) {
      void Promise.resolve().then(() => config.notifySignup({
        verifiedAt: user.verifiedAt || new Date().toISOString(),
      })).catch(() => console.warn("AERIX signup notification could not be delivered."));
    }
  });
  app.post("/api/auth/resend-code", authLimit, async (req, res) => {
    const { challenge } = z
      .object({ challenge: challengeSchema })
      .strict()
      .parse(req.body);
    res.json(await verification.resend(challenge));
  });
  app.post("/api/auth/demo", authLimit, async (req, res) => {
    if (!demo) throw fail(404, "Not found.");
    const { role } = z
      .object({ role: z.enum(["patient", "clinic", "pharmacy", "admin"]) })
      .strict()
      .parse(req.body);
    const user = await store.one("users", { _id: `demo-${role}` });
    if (!user) throw fail(503, "Demo data is not seeded.");
    await signIn(req, res, user);
  });
  app.post("/api/auth/logout", ...mutations, async (req, res) => {
    await store.remove("sessions", { _id: req.session._id });
    res
      .clearCookie(cookieName, { ...cookieOptions, maxAge: undefined })
      .json({ ok: true });
  });
  // Only public map-provider records are exposed here; account and partner data stay protected.
  app.get("/api/nearby", rateLimit({
    windowMs: 60000,
    limit: config.test ? 1000 : 4,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Please wait before searching the map again." },
  }), async (req, res) => {
    const { kind, lat, lng } = z.object({
      kind: z.enum(["hospital", "pharmacy"]),
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
    }).strict().parse(req.query);
    res.json(await (config.lookupPlaces || nearbyPlaces)({ kind, lat, lng }));
  });
  app.post("/api/feedback", rateLimit({
    windowMs: 15 * 60000,
    limit: config.test ? 1000 : 3,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Please wait before sending more feedback." },
  }), async (req, res) => {
    const input = z.object({
      category: z.enum(["idea", "problem", "accessibility", "other"]),
      message: z.string().trim().min(8).max(1000),
    }).strict().parse(req.body);
    const row = { _id: randomUUID(), ...input, status: "new", createdAt: new Date().toISOString() };
    await store.insert("feedback", row);
    res.status(201).json({ ok: true });
  });
  app.get("/api/facilities", auth, async (_req, res) => {
    const rows = await store.all("facilities");
    res.json(rows.filter((x) => demo || !x.sample));
  });
  app.get("/api/products", auth, async (_req, res) => {
    const rows = await store.all("products");
    const facilities = await store.all("facilities");
    res.json(
      rows.filter((p) =>
        facilities.some((f) => f._id === p.pharmacyId && (demo || !f.sample)),
      ),
    );
  });
  app.get("/api/doctors", auth, async (req, res) => {
    const facilityId = id.parse(req.query.facilityId);
    const facility = await store.one("facilities", { _id: facilityId });
    if (!facility || facility.kind !== "hospital" || (!demo && facility.sample))
      throw fail(404, "Clinic not found.");
    res.json((await store.all("doctors", { facilityId })).filter((doctor) => doctor.active).map(({ _id, name, specialty, facilityId }) => ({ _id, name, specialty, facilityId })));
  });
  app.get("/api/staff/doctors", auth, roles("clinic"), async (req, res) =>
    res.json(await store.all("doctors", { facilityId: req.user.facilityId })),
  );
  app.post("/api/doctors", ...mutations, roles("clinic"), async (req, res) => {
    const input = z.object({
      name: text,
      specialty: text,
      registration: text,
      consentConfirmed: z.literal(true),
    }).strict().parse(req.body);
    const facility = await store.one("facilities", { _id: req.user.facilityId });
    if (!facility || facility.kind !== "hospital" || (!demo && facility.sample))
      throw fail(403, "A partner clinic account is required.");
    if ((await store.all("doctors", { facilityId: facility._id })).length >= 50)
      throw fail(409, "This clinic has reached the clinician listing limit.");
    const { consentConfirmed, ...listing } = input;
    const row = { _id: randomUUID(), ...listing, facilityId: facility._id, active: true, createdAt: new Date().toISOString() };
    await store.insert("doctors", row);
    await audit(req, "doctor.create", row._id);
    res.status(201).json(row);
  });
  app.patch("/api/doctors/:id", ...mutations, roles("clinic"), async (req, res) => {
    const { active } = z.object({ active: z.boolean() }).strict().parse(req.body);
    const doctor = await store.update("doctors", { _id: id.parse(req.params.id), facilityId: req.user.facilityId }, { active, updatedAt: new Date().toISOString() });
    if (!doctor) throw fail(404, "Clinician listing not found.");
    await audit(req, active ? "doctor.show" : "doctor.hide", doctor._id);
    res.json(doctor);
  });
  app.get("/api/staff/availability", auth, roles("clinic"), async (req, res) =>
    res.json(await store.all("availability", { facilityId: req.user.facilityId })),
  );
  app.post("/api/availability", ...mutations, roles("clinic"), async (req, res) => {
    const input = z.object({ doctorId: id, date: z.string(), time: z.enum(slots) }).strict().parse(req.body);
    const facility = await store.one("facilities", { _id: req.user.facilityId });
    const doctor = await store.one("doctors", { _id: input.doctorId, facilityId: req.user.facilityId, active: true });
    if (!facility || !doctor || !validDate(input.date, facility.timeZone))
      throw fail(400, "Choose an active clinician and a date in the next 90 days.");
    if ((await store.all("availability", { facilityId: facility._id })).length >= 500)
      throw fail(409, "This clinic has reached the published-time limit. Remove expired times before adding more.");
    if ((await store.one("availability", input)))
      throw fail(409, "This time is already published for this clinician.");
    const row = { _id: randomUUID(), ...input, facilityId: facility._id, createdAt: new Date().toISOString() };
    try { await store.insert("availability", row); }
    catch (error) { if (error.code === 11000) throw fail(409, "This time is already published for this clinician."); throw error; }
    await audit(req, "availability.publish", row._id);
    res.status(201).json(row);
  });
  app.delete("/api/availability/:id", ...mutations, roles("clinic"), async (req, res) => {
    const row = await store.one("availability", { _id: id.parse(req.params.id), facilityId: req.user.facilityId });
    if (!row) throw fail(404, "Published time not found.");
    if ((await store.all("appointments", { facilityId: row.facilityId, date: row.date, time: row.time, active: true })).length)
      throw fail(409, "An appointment request already uses this time. Resolve it before removing availability.");
    await store.remove("availability", { _id: row._id, facilityId: row.facilityId });
    await audit(req, "availability.remove", row._id);
    res.json({ ok: true });
  });
  app.get("/api/facilities/:id/slots", auth, async (req, res) => {
    const facility = await store.one("facilities", {
      _id: id.parse(req.params.id),
    });
    if (!facility || facility.kind !== "hospital" || (!demo && facility.sample))
      throw fail(404, "Clinic not found.");
    const date = z.string().parse(req.query.date);
    if (!validDate(date, facility.timeZone))
      throw fail(400, "Choose a date from tomorrow through the next 90 days.");
    const busy = await store.all("appointments", {
      facilityId: facility._id,
      date,
      active: true,
    });
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const closed =
      weekday === 0 || (facility._id.endsWith("-family") && weekday === 6);
    let offered = slots;
    if (!demo) {
      const doctorId = id.parse(req.query.doctorId);
      const doctor = await store.one("doctors", { _id: doctorId, facilityId: facility._id, active: true });
      if (!doctor) throw fail(404, "Clinician not listed by this clinic.");
      offered = (await store.all("availability", { facilityId: facility._id, doctorId, date })).map((row) => row.time);
    }
    res.json({
      slots:
        facility.accepting && (demo ? !closed : true)
          ? offered.filter((t) => !busy.some((b) => b.time === t))
          : [],
      timeZone: facility.timeZone,
    });
  });
  app.get("/api/appointments", auth, async (req, res) => {
    const q =
      req.user.role === "clinic"
        ? { facilityId: req.user.facilityId }
        : req.user.role === "patient"
          ? { userId: req.user._id }
          : null;
    if (!q)
      throw fail(403, "Only patients and clinic staff can view appointments.");
    res.json(await store.all("appointments", q));
  });
  app.post(
    "/api/appointments",
    ...mutations,
    roles("patient"),
    async (req, res) => {
      const input = z
        .object({
          facilityId: id,
          date: z.string(),
          time: z.enum(slots),
          service: text,
          doctorId: id.optional(),
          reason: z.string().trim().max(500).optional().default(""),
          shareReason: z.boolean().optional().default(false),
        })
        .strict()
        .parse(req.body);
      const facility = await store.one("facilities", { _id: input.facilityId });
      if (input.reason && !input.shareReason)
        throw fail(400, "Confirm that you agree to share your visit note with this clinic.");
      if (
        !facility ||
        facility.kind !== "hospital" ||
        (!demo && facility.sample)
      )
        throw fail(404, "Clinic not found.");
      if (!facility.accepting)
        throw fail(409, "This clinic is not accepting requests.");
      if (!validDate(input.date, facility.timeZone))
        throw fail(
          400,
          "Choose a date from tomorrow through the next 90 days.",
        );
      const day = new Date(`${input.date}T12:00:00Z`).getUTCDay();
      if (demo && (day === 0 || (facility._id.endsWith("-family") && day === 6)))
        throw fail(400, "The clinic is closed on this day.");
      if (!facility.services.includes(input.service))
        throw fail(400, "Choose an available service.");
      const doctor = input.doctorId ? await store.one("doctors", { _id: input.doctorId, facilityId: facility._id, active: true }) : null;
      if (input.doctorId && !doctor) throw fail(400, "Choose a clinician currently listed by this clinic.");
      if (!demo && !doctor) throw fail(409, "This clinic has not listed a clinician for appointment requests yet.");
      if (!demo && !(await store.one("availability", { facilityId: facility._id, doctorId: doctor._id, date: input.date, time: input.time })))
        throw fail(409, "This clinician has not offered that time. Choose a published time.");
      const row = {
        _id: randomUUID(),
        ...input,
        reasonConsent: input.shareReason,
        userId: req.user._id,
        patientName: req.user.name,
        patientEmail: req.user.email,
        facilityName: facility.name,
        facilityCity: facility.city,
        facilityCountry: facility.country,
        doctorName: doctor?.name || null,
        timeZone: facility.timeZone,
        status: "requested",
        active: true,
        createdAt: new Date().toISOString(),
      };
      try {
        await store.insert("appointments", row);
      } catch (e) {
        if (e.code === 11000)
          throw fail(
            409,
            "That appointment was just requested. Please choose another time.",
          );
        throw e;
      }
      await audit(req, "appointment.request", row._id);
      if (config.notifyAppointment) {
        void Promise.resolve().then(() => config.notifyAppointment(row))
          .catch(() => console.warn("AERIX appointment notification could not be delivered."));
      }
      res.status(201).json(row);
    },
  );
  app.patch("/api/appointments/:id", ...mutations, async (req, res) => {
    const { status } = z
      .object({ status: z.enum(["confirmed", "cancelled", "completed"]) })
      .strict()
      .parse(req.body);
    const row = await store.one("appointments", {
      _id: id.parse(req.params.id),
    });
    if (!row) throw fail(404, "Appointment not found.");
    const owner = req.user.role === "patient" && row.userId === req.user._id;
    const staff =
      req.user.role === "clinic" && row.facilityId === req.user.facilityId;
    if (!staff && !(owner && status === "cancelled"))
      throw fail(403, "You cannot change this appointment.");
    const allowed = {
      requested: ["confirmed", "cancelled"],
      confirmed: ["completed", "cancelled"],
    };
    if (!allowed[row.status]?.includes(status))
      throw fail(409, "This appointment can no longer be changed.");
    const updated = await store.update(
      "appointments",
      { _id: row._id, status: row.status },
      {
        status,
        active: status === "confirmed",
        updatedAt: new Date().toISOString(),
      },
    );
    if (!updated)
      throw fail(409, "The appointment changed. Refresh and try again.");
    await audit(req, `appointment.${status}`, row._id);
    res.json(updated);
  });
  app.get("/api/orders", auth, async (req, res) => {
    const q =
      req.user.role === "pharmacy"
        ? { pharmacyId: req.user.facilityId }
        : req.user.role === "patient"
          ? { userId: req.user._id }
          : null;
    if (!q)
      throw fail(
        403,
        "Only patients and pharmacy staff can view collection requests.",
      );
    res.json(await store.all("orders", q));
  });
  app.post("/api/orders", ...mutations, roles("patient"), async (req, res) => {
    const input = z
      .object({
        productId: id,
        quantity: z.number().int().min(1).max(3),
        fulfillmentMethod: z.enum(["pickup", "delivery"]).default("pickup"),
        deliveryArea: z.string().trim().max(100).optional().default(""),
      })
      .strict()
      .parse(req.body);
    if (input.fulfillmentMethod === "delivery" && input.deliveryArea.length < 2)
      throw fail(400, "Enter your neighbourhood or delivery area.");
    const product = await store.one("products", { _id: input.productId });
    if (!product) throw fail(404, "Product not found.");
    const pharmacy = await store.one("facilities", { _id: product.pharmacyId });
    if (!pharmacy || !pharmacy.accepting || (!demo && pharmacy.sample))
      throw fail(409, "Pharmacy is not accepting requests.");
    if (product.prescription)
      throw fail(
        400,
        "Prescription medicines require an in-person pharmacist review.",
      );
    if (product.stock < input.quantity)
      throw fail(409, "This quantity is not currently listed as available.");
    const row = {
      _id: randomUUID(),
      ...input,
      deliveryArea: input.fulfillmentMethod === "delivery" ? input.deliveryArea : "",
      userId: req.user._id,
      patientName: req.user.name,
      patientEmail: req.user.email,
      productName: product.name,
      pharmacyId: product.pharmacyId,
      pharmacyName: pharmacy.name,
      pharmacyCity: pharmacy.city,
      pharmacyCountry: pharmacy.country,
      total: product.price * input.quantity,
      currency: product.currency,
      status: "requested",
      createdAt: new Date().toISOString(),
    };
    await store.insert("orders", row);
    await audit(req, "collection.request", row._id);
    if (config.notifyOrder) {
      void Promise.resolve().then(() => config.notifyOrder(row))
        .catch(() => console.warn("AERIX pharmacy notification could not be delivered."));
    }
    res.status(201).json(row);
  });
  app.patch("/api/orders/:id", ...mutations, async (req, res) => {
    const { status } = z
      .object({ status: z.enum(["ready", "collected", "cancelled"]) })
      .strict()
      .parse(req.body);
    const row = await store.one("orders", { _id: id.parse(req.params.id) });
    if (!row) throw fail(404, "Request not found.");
    const owner = req.user.role === "patient" && row.userId === req.user._id,
      staff =
        req.user.role === "pharmacy" && row.pharmacyId === req.user.facilityId;
    if (!staff && !(owner && status === "cancelled"))
      throw fail(403, "You cannot change this request.");
    if (
      !{ requested: ["ready", "cancelled"], ready: ["collected", "cancelled"] }[
        row.status
      ]?.includes(status)
    )
      throw fail(409, "This request can no longer be changed.");
    const updated = await store.update(
      "orders",
      { _id: row._id, status: row.status },
      { status, updatedAt: new Date().toISOString() },
    );
    if (!updated)
      throw fail(409, "The request changed. Refresh and try again.");
    await audit(req, `collection.${status}`, row._id);
    res.json(updated);
  });
  app.patch(
    "/api/facilities/:id",
    ...mutations,
    roles("clinic", "pharmacy"),
    async (req, res) => {
      if (req.params.id !== req.user.facilityId)
        throw fail(403, "You can only update your own facility.");
      const input = z
        .object({ accepting: z.boolean() })
        .strict()
        .parse(req.body);
      if (input.accepting && req.user.role === "clinic" && !demo &&
          !(await store.all("doctors", { facilityId: req.user.facilityId, active: true })).length)
        throw fail(409, "Add an active clinician before accepting appointment requests.");
      if (input.accepting && req.user.role === "clinic" && !demo &&
          !(await store.all("availability", { facilityId: req.user.facilityId })).some((slot) => slot.date > dateAt("Africa/Lagos")))
        throw fail(409, "Publish at least one future clinician time before accepting appointment requests.");
      const row = await store.update(
        "facilities",
        { _id: req.user.facilityId },
        { ...input, updatedAt: new Date().toISOString() },
      );
      await audit(req, "facility.availability", req.user.facilityId);
      res.json(row);
    },
  );
  app.patch(
    "/api/products/:id",
    ...mutations,
    roles("pharmacy"),
    async (req, res) => {
      const input = z
        .object({ stock: z.number().int().min(0).max(10000) })
        .strict()
        .parse(req.body);
      const row = await store.update(
        "products",
        { _id: id.parse(req.params.id), pharmacyId: req.user.facilityId },
        input,
      );
      if (!row) throw fail(404, "Product not found.");
      await audit(req, "stock.update", row._id);
      res.json(row);
    },
  );
  app.post("/api/products", ...mutations, roles("pharmacy"), async (req, res) => {
    const input = z.object({
      name: text,
      category: z.enum(["First aid", "Devices"]),
      description: z.string().trim().min(10).max(500),
      price: z.number().int().min(1).max(10000000),
      stock: z.number().int().min(0).max(10000),
      icon: z.enum(["kit", "thermometer", "bandage", "pill"]),
    }).strict().parse(req.body);
    const pharmacy = await store.one("facilities", { _id: req.user.facilityId });
    if (!pharmacy || pharmacy.kind !== "pharmacy" || (!demo && pharmacy.sample))
      throw fail(403, "A verified pharmacy account is required.");
    if ((await store.all("products", { pharmacyId: pharmacy._id })).length >= 100)
      throw fail(409, "This pharmacy has reached the 100-product limit.");
    const row = { _id: randomUUID(), ...input, pharmacyId: pharmacy._id, currency: locations.find((x) => x.id === pharmacy.locationId)?.currency || "NGN", prescription: false, updatedAt: new Date().toISOString() };
    await store.insert("products", row);
    await audit(req, "product.create", row._id);
    res.status(201).json(row);
  });
  app.post(
    "/api/applications",
    ...mutations,
    roles("patient"),
    async (req, res) => {
      const input = z
        .object({
          name: text,
          kind: z.enum(["hospital", "pharmacy"]),
          country: z.enum(countries),
          region: text,
          city: text,
          registration: text,
        })
        .strict()
        .parse(req.body);
      if (input.country !== "Nigeria" || !["lagos", "lagos state"].includes(input.region.trim().toLowerCase()))
        throw fail(400, "Provider applications are currently open for Lagos State, Nigeria.");
      if (
        (await store.all("applications", { userId: req.user._id })).some(
          (a) => a.status === "pending",
        )
      )
        throw fail(409, "You already have a pending application.");
      const row = {
        _id: randomUUID(),
        ...input,
        userId: req.user._id,
        email: req.user.email,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      await store.insert("applications", row);
      let emailSent = false;
      if (typeof config.notifyApplication === "function") {
        try {
          emailSent = (await config.notifyApplication(row)) === true;
        } catch {
          // The application is saved even if the optional email service is down.
        }
      }
      res.status(201).json({ ...row, emailSent });
    },
  );
  app.get("/api/admin", auth, roles("admin"), async (_req, res) => {
    const users = (await store.all("users"))
      .filter((user) => !user._id.startsWith("demo-"))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 100)
      .map(({ _id, name, email, role, emailVerified, createdAt, verifiedAt }) => ({
        _id, name, email, role, emailVerified, createdAt, verifiedAt: verifiedAt || null,
      }));
    res.json({
      applications: await store.all("applications"),
      users,
      audit: (await store.all("audit")).slice(-50).reverse(),
      feedback: (await store.all("feedback")).slice(-50).reverse(),
      counts: {
        users: await store.count("users", { emailVerified: true }),
        pendingUsers: await store.count("users", { emailVerified: false }),
        facilities: (await store.all("facilities")).length,
        appointments: (await store.all("appointments")).length,
        orders: (await store.all("orders")).length,
      },
    });
  });
  app.patch(
    "/api/applications/:id",
    ...mutations,
    roles("admin"),
    async (req, res) => {
      const { status } = z
        .object({ status: z.enum(["reviewing", "declined"]) })
        .strict()
        .parse(req.body);
      const row = await store.update(
        "applications",
        { _id: id.parse(req.params.id), status: "pending" },
        { status },
      );
      if (!row) throw fail(409, "Application not found or already reviewed.");
      await audit(req, `application.${status}`, row._id);
      res.json(row);
    },
  );
  app.post("/api/applications/:id/activate", ...mutations, roles("admin"), async (req, res) => {
    const details = z.object({
      address: text,
      phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,25}$/, "Enter a working provider phone number."),
      hours: text,
      description: z.string().trim().min(20).max(500),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      services: z.array(text).min(1).max(10),
      verificationNote: z.string().trim().min(20).max(500),
      licenceChecked: z.literal(true),
      contactConfirmed: z.literal(true),
    }).strict().parse(req.body);
    const application = await store.one("applications", { _id: id.parse(req.params.id), status: "reviewing" });
    if (!application) throw fail(409, "Application is not awaiting review.");
    const region = String(application.region || application.city).trim().toLowerCase();
    const legacyLagosCity = !application.region && ["lagos", "ojo", "alimosho", "ojokoro", "itire"].includes(region);
    if (application.country !== "Nigeria" || (!legacyLagosCity && !["lagos", "lagos state"].includes(region)))
      throw fail(400, "Partner activation currently supports facilities in Lagos State, Nigeria.");
    const facility = await store.activatePartner(application._id, details, req.user._id);
    if (!facility) throw fail(409, "Application or provider account changed. Refresh and try again.");
    await audit(req, "partner.activate", facility._id);
    res.status(201).json(facility);
  });
  app.post(
    "/api/chat",
    ...mutations,
    rateLimit({
      windowMs: 60000,
      limit: config.test ? 1000 : 8,
      keyGenerator: (req) => req.user._id,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Please wait a minute before sending more messages." },
    }),
    async (req, res) => {
      const input = z
        .object({
          consent: z.literal(true),
          messages: z
            .array(
              z
                .object({
                  role: z.enum(["user", "assistant"]),
                  content: z.string().trim().min(1).max(2000),
                })
                .strict(),
            )
            .min(1)
            .max(12),
        })
        .strict()
        .parse(req.body);
      if (input.messages.at(-1).role !== "user")
        throw fail(400, "Please enter a message.");
      if (!config.openaiKey)
        throw fail(
          503,
          "This conversation service is not enabled. Use the free offline health guide on the AERIX assistant page.",
        );
      const client = new OpenAI({
        apiKey: config.openaiKey,
        timeout: 30000,
        maxRetries: 0,
      });
      try {
        const result = await client.responses.create({
          model: config.openaiModel || "gpt-5-mini",
          instructions: assistantInstructions,
          input: input.messages,
          store: false,
          max_output_tokens: 900,
        });
        if (!result.output_text) throw new Error("No answer");
        res.json({ message: result.output_text });
      } catch (error) {
        throw fail(503, aiFailureMessage(error));
      }
    },
  );
  app.use("/api", (_req, _res, next) => next(fail(404, "Not found.")));
  const dist = path.resolve(process.env.AERIX_DIST_DIR || "dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/{*path}", (_req, res) =>
      res.sendFile("index.html", { root: dist }),
    );
  }
  app.use((err, _req, res, _next) => {
    if (err instanceof z.ZodError)
      return res
        .status(400)
        .json({ error: err.issues[0]?.message || "Invalid input." });
    if (err.type === "entity.too.large")
      return res.status(413).json({ error: "Request is too large." });
    if (err instanceof SyntaxError && "body" in err)
      return res.status(400).json({ error: "Invalid request." });
    if (err.code === 11000)
      return res.status(409).json({ error: "This record already exists." });
    const errorName = String(err?.name || "");
    const errorCode = String(err?.code || "");
    const databaseUnavailable =
      /^Mongo(Server|Network|NetworkTimeout|Timeout)/.test(errorName) ||
      ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED"].includes(errorCode);
    if (databaseUnavailable) {
      console.error(`Database request failed: ${errorName || "Error"}${errorCode ? ` (${errorCode})` : ""}`);
      return res.status(503).json({
        error: "AERIX could not complete the database request. Check the Atlas connection and database-user access, then try again. If you already received a code, use Sign in to continue verification.",
      });
    }
    const status = err.status || 500;
    if (status === 500) console.error("Request failed:", errorName || "Error");
    res.status(status).json({
      error:
        status === 500
          ? "Something went wrong. Please try again."
          : err.message,
    });
  });
  return app;
}

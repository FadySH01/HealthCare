import nodemailer from "nodemailer";
export function createEmailTransport(env = process.env) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.EMAIL_FROM)
    return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 465),
    secure: (env.SMTP_PORT || "465") === "465",
    requireTLS: true,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    connectionTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}
export function createEmailSender(env = process.env) {
  if (env.EMAIL_WEB_URL || env.EMAIL_WEB_TOKEN) {
    if (!validWebConfig(env)) return null;
    return async ({ email, code, welcome, name }) => {
      const response = await webRequest(env, welcome ? { action: "welcome", email, name } : { action: "send", email, code });
      if (!response.ok) throw new Error("Gmail HTTPS delivery was not confirmed");
    };
  }
  const transport = createEmailTransport(env);
  if (!transport) return null;
  return async ({ email, code, welcome, name }) => {
    const safeName = String(name || "").replace(/[<>\r\n]/g, "").slice(0, 80);
    const result = await transport.sendMail({
      from: env.EMAIL_FROM,
      to: email,
      subject: welcome ? "Welcome to AERIX" : "Your AERIX verification code",
      text: welcome ? `Welcome to AERIX${safeName ? `, ${safeName}` : ""}! Your account is ready. Explore nearby care, prepare for a visit, and keep your health questions in one place. Map listings are not verified partners; please call to confirm details. AERIX provides general information and cannot replace medical care.` : `Your AERIX verification code is ${code}. It expires in 10 minutes. Never share this code. If you did not request an account, ignore this email.`,
      html: welcome ? undefined : `<div style="font-family:Arial,sans-serif;max-width:480px;padding:32px;color:#242137"><h2>AERIX</h2><h1>One last step.</h1><p>Enter this code in the AERIX window where you started signing up.</p><p style="font-size:36px;letter-spacing:8px;font-weight:bold;color:#6554c0">${code}</p><p>Expires in 10 minutes. Never share this code.</p><p>If you did not request an account, ignore this email.</p></div>`,
    });
    if (!result.accepted?.length) throw new Error("Email delivery rejected");
  };
}

export function createApplicationNotifier(env = process.env) {
  const destination = String(env.AERIX_ADMIN_EMAIL || "aerixcompany@gmail.com").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) return null;
  const useWeb = Boolean(env.EMAIL_WEB_URL || env.EMAIL_WEB_TOKEN);
  if (useWeb && !validWebConfig(env)) return null;
  const transport = useWeb ? null : createEmailTransport(env);
  if (!useWeb && !transport) return null;
  return async (application) => {
    const clean = (value, max = 120) => String(value || "").replace(/[<>\r\n]/g, " ").trim().slice(0, max);
    const details = {
      name: clean(application.name),
      kind: application.kind === "pharmacy" ? "pharmacy" : "hospital",
      country: clean(application.country, 60),
      region: clean(application.region, 80),
      city: clean(application.city, 80),
      registration: clean(application.registration, 120),
      applicantEmail: clean(application.email, 254),
    };
    if (useWeb) {
      await webRequest(env, { action: "application", application: details });
      return true;
    }
    const text = [
      "A new AERIX provider interest application needs review.",
      "",
      `Facility: ${details.name}`,
      `Type: ${details.kind}`,
      `Location: ${details.city}, ${details.region}, ${details.country}`,
      `Registration reference supplied: ${details.registration || "Not supplied"}`,
      `Applicant account email: ${details.applicantEmail}`,
      "",
      "This is an unverified application. Review it in the AERIX admin workspace before activating any facility.",
    ].join("\n");
    const result = await transport.sendMail({ from: env.EMAIL_FROM, to: destination, subject: "New AERIX provider application", text });
    if (!result.accepted?.length) throw new Error("Email delivery rejected");
    return true;
  };
}

export function createSignupNotifier(env = process.env) {
  const destination = String(env.AERIX_ADMIN_EMAIL || "aerixcompany@gmail.com").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) return null;
  const useWeb = Boolean(env.EMAIL_WEB_URL || env.EMAIL_WEB_TOKEN);
  if (useWeb && !validWebConfig(env)) return null;
  const transport = useWeb ? null : createEmailTransport(env);
  if (!useWeb && !transport) return null;
  return async (user) => {
    const verifiedAt = String(user.verifiedAt || new Date().toISOString()).replace(/[<>\r\n]/g, " ").slice(0, 40);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(verifiedAt)) return false;
    if (useWeb) {
      await webRequest(env, { action: "signup", signup: { verifiedAt } });
      return true;
    }
    const result = await transport.sendMail({
      from: env.EMAIL_FROM,
      to: destination,
      subject: "A new AERIX account was verified",
      text: `A new AERIX account completed email verification at ${verifiedAt}.\n\nNo account details, password, verification code, or health information is included. Sign in to the AERIX admin workspace to review accounts.`,
    });
    if (!result.accepted?.length) throw new Error("Email delivery rejected");
    return true;
  };
}

export function createEmergencyNotifier(env = process.env) {
  const destination = String(env.AERIX_ADMIN_EMAIL || "aerixcompany@gmail.com").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) return null;
  const useWeb = Boolean(env.EMAIL_WEB_URL || env.EMAIL_WEB_TOKEN);
  if (useWeb && !validWebConfig(env)) return null;
  const transport = useWeb ? null : createEmailTransport(env);
  if (!useWeb && !transport) return null;
  return async (alert) => {
    const clean = (value, max = 240) => String(value || "").replace(/[<>\r\n]/g, " ").trim().slice(0, max);
    const details = {
      situation: clean(alert.situation, 80),
      person: clean(alert.person, 50),
      note: clean(alert.note, 240),
      // Keep the shared location approximate (about 100 m) rather than emailing
      // the browser's full-precision coordinates.
      latitude: Number.isFinite(alert.latitude) ? Number(alert.latitude.toFixed(3)) : null,
      longitude: Number.isFinite(alert.longitude) ? Number(alert.longitude.toFixed(3)) : null,
      photoBase64: alert.photoBase64 || "",
    };
    if (useWeb) {
      await webRequest(env, { action: "emergency", emergency: details });
      return true;
    }
    const mapLink = details.latitude === null ? "Location was not shared." :
      `https://www.google.com/maps/search/?api=1&query=${details.latitude},${details.longitude}`;
    const text = [
      "A user asked AERIX to forward this emergency contact alert.",
      "AERIX is not an emergency dispatch service. Contact local emergency services directly; this mailbox may not be monitored immediately.",
      "",
      `Situation: ${details.situation}`,
      `For: ${details.person}`,
      `Approximate location: ${mapLink}`,
      details.note ? `Note: ${details.note}` : "",
      details.photoBase64 ? "A user-selected photo is attached." : "No photo was attached.",
    ].filter(Boolean).join("\n");
    const attachments = details.photoBase64 ? [{
      filename: "emergency-photo.jpg",
      content: Buffer.from(details.photoBase64, "base64"),
      contentType: "image/jpeg",
    }] : [];
    const result = await transport.sendMail({
      from: env.EMAIL_FROM,
      to: destination,
      subject: "AERIX emergency contact alert",
      text,
      attachments,
    });
    if (!result.accepted?.length) throw new Error("Email delivery rejected");
    return true;
  };
}

function createRequestNotifier(env, action, payloadKey, subject, buildDetails, buildText) {
  const destination = String(env.AERIX_ADMIN_EMAIL || "aerixcompany@gmail.com").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) return null;
  const useWeb = Boolean(env.EMAIL_WEB_URL || env.EMAIL_WEB_TOKEN);
  if (useWeb && !validWebConfig(env)) return null;
  const transport = useWeb ? null : createEmailTransport(env);
  if (!useWeb && !transport) return null;
  return async (event) => {
    const details = buildDetails(event);
    if (!details) return false;
    if (useWeb) {
      await webRequest(env, { action, [payloadKey]: details });
      return true;
    }
    const result = await transport.sendMail({
      from: env.EMAIL_FROM,
      to: destination,
      subject,
      text: buildText(details),
    });
    if (!result.accepted?.length) throw new Error("Email delivery rejected");
    return true;
  };
}

export function createAppointmentNotifier(env = process.env) {
  const clean = (value, max = 120) => String(value || "").replace(/[<>\r\n]/g, " ").trim().slice(0, max);
  return createRequestNotifier(
    env,
    "appointment",
    "appointment",
    "New AERIX appointment request",
    (appointment) => {
      const date = clean(appointment.date, 10);
      const time = clean(appointment.time, 5);
      const timeZone = clean(appointment.timeZone, 80);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !timeZone) return null;
      return {
        facilityName: clean(appointment.facilityName),
        facilityLocation: [appointment.facilityCity, appointment.facilityCountry].map((part) => clean(part, 80)).filter(Boolean).join(", "),
        patientName: clean(appointment.patientName),
        patientEmail: clean(appointment.patientEmail, 254),
        date,
        time,
        timeZone,
      };
    },
    (details) => [
      "A new appointment request was submitted through AERIX. It is not confirmed until the hospital accepts it.",
      "",
      `Hospital or clinic: ${details.facilityName}`,
      `Location: ${details.facilityLocation || "Not provided"}`,
      `Patient: ${details.patientName || "Not provided"}`,
      `Patient email: ${details.patientEmail || "Not provided"}`,
      `Requested date: ${details.date}`,
      `Requested time: ${details.time} (${details.timeZone})`,
      "",
      "No health details are included. Review the request in the AERIX workspace.",
    ].join("\n"),
  );
}

export function createOrderNotifier(env = process.env) {
  const clean = (value, max = 120) => String(value || "").replace(/[<>\r\n]/g, " ").trim().slice(0, max);
  return createRequestNotifier(
    env,
    "order",
    "order",
    "New AERIX pharmacy collection request",
    (order) => {
      const quantity = Number(order.quantity);
      const createdAt = clean(order.createdAt, 40);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 3 || !/^\d{4}-\d{2}-\d{2}T/.test(createdAt)) return null;
      return {
        pharmacyName: clean(order.pharmacyName),
        pharmacyLocation: [order.pharmacyCity, order.pharmacyCountry].map((part) => clean(part, 80)).filter(Boolean).join(", "),
        patientName: clean(order.patientName),
        patientEmail: clean(order.patientEmail, 254),
        productName: clean(order.productName),
        fulfillmentMethod: order.fulfillmentMethod === "delivery" ? "delivery" : "pickup",
        deliveryArea: clean(order.deliveryArea, 100),
        quantity,
        createdAt,
      };
    },
    (details) => [
      "A new pharmacy collection request was submitted through AERIX.",
      "",
      `Pharmacy: ${details.pharmacyName}`,
      `Location: ${details.pharmacyLocation || "Not provided"}`,
      `Patient: ${details.patientName || "Not provided"}`,
      `Patient email: ${details.patientEmail || "Not provided"}`,
      `Item: ${details.productName}`,
      `Quantity: ${details.quantity}`,
      `Fulfilment: ${details.fulfillmentMethod === "delivery" ? `Delivery requested (${details.deliveryArea || "area not supplied"}; pharmacy to confirm availability and fee)` : "Self pickup"}`,
      `Requested at: ${details.createdAt}`,
      "",
      "No health details are included. Review the request in the AERIX workspace.",
    ].join("\n"),
  );
}

export function validWebConfig(env) {
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(env.EMAIL_WEB_URL || "") &&
    typeof env.EMAIL_WEB_TOKEN === "string" && env.EMAIL_WEB_TOKEN.length >= 40 &&
    typeof env.EMAIL_CODE_SECRET === "string" && env.EMAIL_CODE_SECRET.length >= 32;
}

export async function webRequest(env, payload) {
  if (!validWebConfig(env)) throw new Error("Gmail HTTPS is not configured");
  const response = await fetch(env.EMAIL_WEB_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token: env.EMAIL_WEB_TOKEN, ...payload }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Gmail HTTPS service could not be reached");
  const result = await response.json();
  if (result?.ok !== true) throw new Error("Gmail HTTPS service rejected the request");
  return result;
}

# Architecture and data model

## Request flow

React page → same-origin `/api` request → security headers and request limits → JSON validation → session lookup → CSRF validation for authenticated mutations → role and record-ownership checks → MongoDB/local store → JSON response → React renders the updated state.

Frontend hiding is not authorization. A direct HTTP request must pass the same server checks.

## Collections

| Collection | Key fields | Access |
|---|---|---|
| users | string `_id`, normalized email, name, passwordHash, role, facilityId | Session owner gets a limited public projection |
| sessions | SHA-256 token digest `_id`, userId, csrf, expiresAt | Server only; expires after eight hours |
| facilities | kind, locationId, city, country, timezone, coordinates, services, accepting, sample | Public catalogue; own staff can update acceptance |
| doctors | facilityId, name, specialty, internal registration reference, active | Own clinic staff manage; patients see active names and specialties only |
| availability | facilityId, doctorId, date, time | Clinic staff publish and withdraw; patients see offered times for an active clinician |
| products | pharmacyId, category, price, currency, stock, prescription | Public catalogue; own pharmacy can change listed stock |
| appointments | userId, facilityId, optional doctorId and doctorName, date, time, service, status, active | Owning patient and assigned clinic |
| orders | userId, pharmacyId, productId, quantity, authoritative total, status | Owning patient and assigned pharmacy |
| applications | userId, facility details, registration reference, status | Admin review; submission does not grant privileges |
| audit | actorId, action, resource ID, timestamp | Admin; no health chat content |

IDs are application-generated UUIDs or explicit fictional sample IDs. Client-supplied objects cannot become MongoDB query operators: Zod accepts only the expected scalar fields, and routes construct filters themselves.

## Lifecycle rules

Appointments: `requested → confirmed → completed`, with cancellation possible from requested or confirmed. Patients can cancel only their own requests. Staff can change only their own clinic's records. A unique partial index on facility/date/time with `active:true` prevents concurrent active bookings for the same slot. Updates match the previous status to prevent stale state transitions.

In live mode, a clinic must list an active clinician and publish future times before accepting appointment requests. A patient selects an active clinician and a time published for that clinician, but the clinic still confirms the request. The unique active-booking index is shared by the whole facility for each date/time, so two clinicians cannot take separate AERIX bookings at the same time yet. Staff maintain the published times manually; there is no hospital scheduling-system integration.

Collections: `requested → ready → collected`, with cancellation from requested or ready. Pricing is calculated from the server catalogue. Prescription products cannot be ordered. Staff must manually check and set aside stock; no automatic reservation allocation or online payment occurs.

Provider interest: `pending → reviewing → approved`, or `pending → declined`. An administrator must independently check registration and contact the facility, then enter verified contact, location, hours and services before activation. Activation creates the facility and upgrades the applicant's verified account in one database transaction; requests remain paused until staff enable them. This workflow does not perform the real-world checks automatically.

## Why these choices

- React and TypeScript: reusable components and checked data shapes for complex screens.
- Express: one language across client and server and an understandable REST boundary for the defense.
- MongoDB Atlas: matches the requested managed document database and supports the relevant indexes.
- Local adapter: an explicit offline demo fallback when no database URI exists, so the presentation can still run without internet. It is not a production database.
- HTTP-only sessions: authentication tokens are not readable by page JavaScript or stored in localStorage. Only the non-secret city preference uses localStorage.
- Same-origin deployment: fewer cross-origin credential and configuration pitfalls.
- No attachments/payments: avoids pretending to provide secure clinical document handling or financial processing before that work exists.
- Local fonts and SVG artwork: core interface assets need no third-party image service during the defense.

## Current technical limitations

The catalogue returns at most 500 records; pagination and indexed geographic queries are needed at scale. Rate limiting is per process and needs a shared store for multiple instances. Email verification has SMTP and Gmail HTTPS sender options, but production delivery still needs an end-to-end check. Password reset, MFA, appointment reminders, video consultation, delivery, full electronic medical record, multilingual UI and a live facility-data feed are not implemented. Pharmacy staff can list non-prescription products, but stock workflows do not allocate units atomically. A booking and its audit event are separate database operations rather than a transaction. Clinical AI safety remains prompt-based and unvalidated. Country filters express the product vision, not verified operational coverage.

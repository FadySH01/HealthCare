# AERIX — Your health, connected.

A React + TypeScript healthcare-access pilot with an Express API, MongoDB Atlas integration and a server-side OpenAI assistant. Built around patient, clinic, pharmacy and administrator journeys.

## Run it on this computer

Node.js 22.13 or newer is required (Node 24 was used to verify this project).

```powershell
cd C:\Users\HomePC\Desktop\AERIX
npm run dev
```

Open the URL printed in the terminal (normally **http://localhost:4000**). If that port is already occupied, AERIX automatically selects the next free port and prints its URL. The development command runs the API and rebuilds the frontend when you save. Refresh your browser after a frontend change. Restart the command after changing server code or environment variables. This build-watch workflow avoids native dependency-scanner restrictions encountered in the managed Windows environment. Keep its terminal open; stop it with Ctrl+C. If dependencies are missing, run `npm ci` first. Do not open `dist/index.html` with Live Server; use the printed `http://localhost:<port>` URL so the API and page routes work.

For the already-built app, run `npm start` and open **http://localhost:4000**. Do not run multiple copies of the backend on port 4000. The `START-AERIX.cmd` launcher runs this already-built version.

Optional: `npm run dev:vite` provides Vite hot reload at localhost:5173 on a normal development terminal. Its dependency scanner was blocked by this managed environment, so the default uses the verified build-watch path instead.

The default `npm run dev` starts a local demonstration that persists to `.data/demo.json`. It does not need MongoDB Atlas, and it does not write to `aerix_app` or any Atlas database. Never enter real patient information into the demonstration. Keep the terminal open while presenting; stop it with Ctrl+C.

## Try all four roles

Open **Sign in** and choose Patient, Clinic, Pharmacy or Admin under **Explore the demo**. These shortcuts exist only while demo mode is enabled. Clinic staff manage **AERIX Lagos Care Centre**. Pharmacy staff manage **Leaf Pharmacy · Lagos**. Sign out at the top of the page before changing roles.

1. Patient: choose Lagos, find AERIX Lagos Care Centre, choose a future weekday and request a visit.
2. Clinic: confirm the request in Workspace.
3. Patient: open Appointments and see the confirmation.
4. Patient: request an everyday first-aid kit in Pharmacy.
5. Pharmacy: mark the collection ready in Workspace.
6. Patient: view the update in Appointments → Pharmacy collections.
7. Admin: inspect activity and provider-interest applications.

All providers and catalogue items are illustrative. No real appointment, medicine, delivery or payment is arranged. Pharmacy requests can record self-pickup or a delivery area for the pharmacy to review; no courier is booked, and no payment is processed. Stock is informational; a request is not an inventory allocation.

## Optional: use a separate Atlas preview database

1. Keep `.env` and `.secrets/` private. On this Windows computer, `npm run setup:database` saves the Atlas connection encrypted for your Windows account; use the `aerix_app` database user, not your Atlas website login.
2. Run `npm run check:database`. A successful check confirms authentication and network access without writing sample data. This connection check succeeded on 16 September 2026.
3. For an optional database-backed demo, run `npm run dev:atlas`. It uses the isolated `aerix_demo` database and requires a working Atlas network connection. The ordinary `npm run dev` remains local-first and never silently switches databases.
4. Keep the real `aerix` database separate from the demonstration. The project demo uses fictional sample providers and accounts; it is not a live care network.

For a hosted Node server, set `MONGODB_URI` in the host's private environment instead. The Windows-encrypted local credential cannot be used by Netlify or another host. Restrict Atlas Network Access to the server's outbound IP when feasible, and never put the URI in frontend variables.

For local verification emails from a dedicated AERIX Gmail account, run `npm run setup:email`, enter the Gmail address and its Google App Password at the hidden prompt, then run `npm run check:email`. This stores credentials encrypted for your Windows account and checks SMTP without sending a message. Restart the app and check `/api/config` for `"emailDelivery":true`. See `docs/ACCOUNT-SETUP.md` for the full setup and the separate hosting requirements.

If X-VPN blocks Gmail SMTP while Atlas needs the VPN, the same Gmail account can send pilot verification codes through Google Apps Script over HTTPS. See `docs/ACCOUNT-SETUP.md` for the deployment steps, `npm run setup:email-web`, and the 100-recipients-per-day consumer limit. No Gmail HTTPS deployment is configured until those steps and an end-to-end test succeed.

The server creates unique account and active-booking indexes, a session-expiry TTL index, and query indexes when Atlas is enabled. Registration, OTP, welcome email, and administrator signup notification require working private email settings; check delivery with an inbox you control before presenting. A status line saying “Email: configured” confirms settings are present, not that every email reached an inbox.

## Connect the AI assistant

Run `npm run setup:ai`, paste your OpenAI API key into the hidden prompt, then run `npm run check:ai`. The local key is encrypted for this Windows account and never placed in the frontend. An OpenAI API project with billing/model access is required; a ChatGPT subscription alone is not an API connection. `OPENAI_MODEL` is configurable (default `gpt-5-mini`). Restart AERIX after a successful check. On a hosted service, set `OPENAI_API_KEY` privately in the host; the Windows-encrypted file does not transfer.

The frontend calls `/api/chat`; only the server contacts OpenAI through the Responses API. Consent and sign-in are required. Conversation history is bounded, replies are limited, and chat requests are rate limited. Messages are not written to the AERIX database. `store:false` is used, but OpenAI's own data policies still apply. The assistant is for general education, not diagnosis or prescriptions. Clinical safety evaluation remains a prerequisite for public healthcare use.

Without a key, the interface clearly says the assistant is not connected and does not fabricate AI answers. The live OpenAI call remains unverified until a key is configured.

Visitors can search nearby hospitals from the welcome page without an account; signed-in users can also search nearby pharmacies. Browser location is requested only after the visitor chooses it. Coordinates are rounded before lookup and are not stored in the AERIX account database. Search results come from the shared OpenStreetMap Overpass service and are community-mapped, incomplete, unverified and not AERIX partners. The map is embedded from OpenStreetMap; Google Maps search and directions open as external links. Email, call, SMS and WhatsApp drafts appear only when the public listing has a usable contact detail. A draft never sends a message or confirms a booking. There is no Google Places key or hospital-photo feed. Public map results do not provide confirmed schedules, emergency capacity or pharmacy stock.

The welcome page also accepts limited, anonymous product feedback without requesting an email or account. Feedback must not include medical information; it is stored in the application database and visible only to administrators. Submission is rate limited.

Hospitals and pharmacies can choose that path while creating an account, submit their facility and state/region, and wait for manual verification in the administrator workspace. Facility intake and activation currently support **Lagos State, Nigeria**; requests stay paused until hospital staff add clinicians and availability and explicitly enable them. Search for hospitals across other African locations is a later rollout, not a live connected network yet. Emergency notices link to Lagos State's 112 line only when Lagos is selected; AERIX does not dispatch ambulances, connect to Uber, or select a medically safe destination.

The Nigeria Health Facility Registry offers a read-only API, but requires an API key; it is not currently connected. OSM's public Overpass service is free for light use but shared and can be unavailable or incomplete, so it needs caching, a switchable provider and a sustainable data source before public scale.

## Project structure

```text
src/
  App.tsx           Application shell, routing and shared context
  care.tsx          Overview, facility search and booking dialog
  journeys.tsx      Patient appointments and pharmacy collection
  assistant.tsx     AI conversation UI and consent
  account.tsx       Sign-in, registration and demo role selection
  workspace.tsx     Clinic, pharmacy and admin tools
  about.tsx         Product vision, partnership form and privacy disclosure
  api.ts            Shared HTTP client and CSRF header
  components.tsx    Reusable UI elements
  styles.css        Responsive visual system
server/
  app.js            Validated API routes and authorization
  security.js       Password hashing, session helpers and AI instructions
  store.js          MongoDB and local demo persistence adapters
  data.js           Clearly fictional sample catalogue
  index.js          Environment configuration and startup
  seed.js           Explicit MongoDB demo seeding
tests/api.test.js   Security and workflow regression tests
docs/              Architecture, security notes and defense guide
public/            Original lightweight SVG illustrations and favicon
```

## Validation

```powershell
npm test
npm run build
npm audit
```

The build runs TypeScript checking before bundling. The API tests use an isolated local adapter and never contact external services. Live MongoDB, OpenAI, HTTPS hosting and independent security review require separate verification.

## Hosting path

Deploy as a **Node web service**, not a static-only site: the same Express process serves `dist/` and `/api`. Build with `npm ci && npm run build`, start with `npm start`. Configure the host's assigned `PORT`, `HOST=0.0.0.0`, MongoDB secrets, and `APP_ORIGIN` equal to your exact HTTPS origin.

Public/live mode requires `NODE_ENV=production` and `DEMO_MODE=false`. Do not publish a demo instance with public administrator shortcuts. Production startup refuses missing MongoDB, insecure origins and demo mode. Set `TRUST_PROXY` only to the exact number of trusted reverse-proxy hops. Rate limiting currently uses process memory: run one instance until a shared limiter is added.

This is a tested local pilot, not a certified medical platform or an independently audited bank-grade system. Read `docs/SECURITY.md` before public deployment.

See `docs/LAUNCH-READINESS.md` for the current state of AI, location-based discovery, bookings, pharmacy stock and the difference between a static Netlify upload and a working full-stack deployment.

## Research references

- [NHS design principles](https://service-manual.nhs.uk/design-system/design-principles): clear tasks and accessible, understandable interfaces.
- [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): salted, expensive password hashing.
- [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): server-managed sessions and protected cookies.
- [MongoDB Atlas connection guide](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/): database users and IP access lists.
- [OpenAI developer quickstart](https://developers.openai.com/api/docs/quickstart): server-side API integration.
- [WHO medical AI guidance](https://www.who.int/news/item/18-01-2024-who-releases-ai-ethics-and-governance-guidance-for-large-multi-modal-models): limitations and risks of health AI.

Original illustrations are included locally. DM Sans, Manrope and Lucide assets are distributed through their respective open-source packages; preserve package license notices when redistributing them.


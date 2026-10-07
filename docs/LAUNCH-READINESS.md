# AERIX launch readiness

The current build is a working **pilot workflow**, not a live hospital or pharmacy network. The UI can create appointment and pharmacy collection requests when a verified user and a real, participating provider exist. A request is not a confirmed booking or reserved stock until that provider responds.

| Capability | Current state | Needed before public use |
| --- | --- | --- |
| Accounts and Atlas | Atlas connectivity has been checked locally; account and session code exists | Configure hosted MongoDB credentials, complete sender setup, and test a real signup and login on HTTPS |
| Hospital discovery | City filtering, device-distance sorting and real OpenStreetMap place discovery work | Onboard and verify each partner hospital, contact details, hours, services and staff account |
| Appointments | Patient request, clinic confirmation and cancellation work in the pilot | Real clinic staff must monitor and confirm requests; test end-to-end with a pilot clinic |
| Pharmacy search | Real OpenStreetMap pharmacy discovery plus listed-stock and distance filters for partners work; patients can request pickup or enter a delivery area | Onboard pharmacies; keep inventory current; connect and test a courier and payment provider before offering real delivery or online payment |
| AI chat | Offline guide works locally; optional server AI and browser voice dictation are available when configured and supported | Configure and test an API key, obtain clinical review, evaluate emergency and medication questions; never present it as a prescriber or live doctor |

Device coordinates are used in the browser only when the visitor presses **Use my location** and grants permission. They are not saved by this feature. Distances are approximate straight-line distances, not travel times. Geolocation requires HTTPS in a deployed site.

## Hosting

Uploading `dist/` alone to Netlify only serves the React interface. This project also needs the Express `/api` service for accounts, Atlas, bookings, inventory and AI. The current supported deployment shape is a Node web service that builds `dist/` and runs `npm start` on the assigned port. Netlify can run Express through Functions, but this repository has not yet been adapted or tested for that runtime. If Netlify is chosen, complete and test that serverless conversion before publishing.

Keep `MONGODB_URI`, SMTP credentials, `EMAIL_CODE_SECRET` and `OPENAI_API_KEY` in the host's private environment, never in browser variables. Use `NODE_ENV=production`, `DEMO_MODE=false`, and an exact HTTPS `APP_ORIGIN`. The Windows-encrypted local secret files do not transfer to hosting.

## Go-live checks

1. Verify one Lagos clinic and one Lagos pharmacy as real partners, including who receives requests and who maintains hours and stock.
2. Finish email verification, then test signup, sign-in, logout and recovery from a second device. Password reset and staff MFA still need implementation before broad use.
3. Test patient request → staff confirmation → patient status for a clinic, and product search → stock confirmation → collection at a pharmacy. Do not represent a submitted request as a booking or stock reservation.
4. Connect and test the AI with clinician-reviewed cases and emergency escalation. Do not use it for diagnosis, prescriptions or urgent-care replacement.
5. Test HTTPS, session cookies, privacy/contact information, backups, account deletion and incident handling with qualified local advice before collecting real patient information.

Begin with a small, supervised Lagos pilot. Expand country by country only after provider data and operating processes have been validated.

The administrator can now activate a reviewed Lagos provider after recording independent licence and contact checks. Activation creates a staff-linked facility with requests **paused**. A pharmacy can add non-prescription product listings in its workspace. Neither action supplies a real provider or verifies a registration automatically. On 24 September 2026, the owner reported that Ojo General Hospital staff agreed to handle requests; this has not yet been independently verified or onboarded in AERIX. Do not enable live booking or advertise real stock until the provider has tested its staff login and completed an end-to-end request.

`GET /api/health` now checks the database connection and returns 503 if it is unavailable. Use this endpoint for hosting health checks. It does not prove email delivery, provider responsiveness or clinical safety.

The included Dockerfile builds the frontend and runs the Express API in one Node service. Configure `MONGODB_URI`, `MONGODB_DB`, `APP_ORIGIN`, `EMAIL_CODE_SECRET` and either the Gmail HTTPS settings or SMTP settings as private host environment variables. The local Windows-encrypted credentials cannot be copied into the container. Set the hosting health-check path to `/api/health`; deploy only after account, email, provider and recovery checks pass on the actual HTTPS URL.

## Named clinician and map listings

Participating clinic staff can add or hide clinicians in their workspace after confirming that each clinician agrees to appear. Staff publish the dates and times they can receive requests for each clinician. Patients can select an active clinician and a published time; the selected name is stored with the request. In live mode the clinic needs an active clinician and future published time before enabling requests. This is a staff-maintained schedule, not a real-time hospital scheduling integration or a confirmed doctor appointment. Professional registration references are kept internal, but AERIX has no automatic regulator verification of individual clinicians.

Community map results remain OpenStreetMap discovery. Each listing can open Google Maps for the visitor to inspect recent information and available photos, but AERIX does not currently use the paid Google Places API, import Google photos or verify that a mapped facility still operates. A Places API key, enabled billing, attribution and policy-compliant display would be needed for photos inside AERIX. Do not scrape Google Maps images or present them as verified provider photographs.

## First live hospital onboarding

The owner identified Ojo General Hospital as a proposed first hospital and said its staff agreed to manage requests. That report has not been independently checked by this repository or turned into an AERIX partner listing. Ojo is now available as a nearby-map search area, but a map result is still discovery only.

1. The owner creates and email-verifies their own AERIX account on the live database. From the same Windows account that holds the Atlas credential, run `npm run setup:admin` once and follow its prompts. It promotes only an existing verified patient account when no administrator exists. Never run the demo seed against the live database.
2. An authorised hospital staff member creates and email-verifies their own AERIX account, then submits the hospital interest form under About AERIX. Do not share passwords or use the owner's account as hospital staff.
3. The administrator independently checks the hospital registration and confirms with a known hospital contact that the applicant is authorised. In the workspace, mark the application for review, enter the verified address, phone, opening hours, services, map coordinates and internal evidence note, then activate it. Requests remain paused.
4. Hospital staff sign in, add clinicians who consented to appear, publish their available dates and times, and enable requests. Test a patient request → staff confirmation → patient status from separate accounts. A published time is staff-maintained and may change; it is not an integration with the hospital's own scheduling system.
# Current experience and remaining launch work

The public home explains the care tools before sign-in. Signed-in users can search community map listings around their selected city, device location, or the Alimosho, Ojokoro and Itire/Ikate pilot areas. Searches cover about 12 km and return a capped nearby sample. These results are not an exhaustive Lagos hospital or pharmacy directory, verified licences, partner facilities, live appointments, or medicine stock.

After a new user verifies their email, the server attempts a welcome email without delaying sign-in. The Gmail HTTPS Apps Script was updated and the existing web-app deployment advanced to version 4 on 22 September 2026. Keep the script property token private. A full end-to-end welcome send remains to be tested from the owner's Windows account; sandboxed checks cannot open that account's encrypted email settings. SMS welcome messages need an SMS provider, consent and a verified phone-number flow; they are not implemented.

Before a public launch, obtain an authoritative facility register or written permission to use one, verify facility identities and pharmacy licences, confirm contacts and update ownership, and onboard hospitals and pharmacies before showing live booking or stock claims. Google Places photos need a configured Places API project, billing and compliant attribution; there are no facility photos in the current finder. AI health information remains unavailable while the OpenAI API project has no credit and must never be presented as a diagnosis.

# AERIX defense guide

## A 30-second opening

“AERIX is a healthcare-access platform designed to make the next step in care easier. It brings facility discovery, appointment requests, pharmacy collection requests and general AI health information into one interface. Africa is the long-term vision; this prototype proves the workflow with clearly labelled sample providers.”

## A focused 6-minute demonstration

1. **Problem and overview — 45 seconds.** Explain the difficulty of finding care and coordinating next steps. Show the home screen and location selector.
2. **Patient journey — 90 seconds.** Sign in with the Patient demo role. Use Lagos and AERIX Lagos Care Centre. Select a future working day and an available time. Submit and open Appointments.
3. **Clinic journey — 60 seconds.** Sign out; sign in as Clinic. Confirm the request. Explain that permission checks exist on the server, not only in the UI. Return to Patient to show confirmation.
4. **Pharmacy journey — 60 seconds.** Request a first-aid kit, switch to Pharmacy, mark ready. Explain that this is a collection request, not payment or a prescription.
5. **AI and boundaries — 45 seconds.** If your key has been configured and tested, ask “How can I prepare for a doctor's visit?” Explain consent, server-side secrets, and why autonomous prescribing is excluded. If the key is unavailable, state this directly and show the integration code; do not imply the assistant is live.
6. **Engineering — 60 seconds.** Show MongoDB collections if connected, the security tests, the role boundaries and mobile layout. End with the next real-world pilot step.

## Questions to prepare for

**Why MongoDB?** The records fit document collections. Atlas manages database infrastructure. Unique indexes protect account emails and active appointment slots; application validation and authorization remain our responsibility.

**What prevents two people taking the same slot?** A unique active-booking index in MongoDB. A conflict returns 409 and asks the second patient to choose again. The demo adapter enforces the same rule for presentation.

**Can a patient become an administrator by editing the request?** No. Public registration only creates patients, strict validation rejects unknown fields, and each privileged route checks the stored role.

**Why not store a login token in localStorage?** An HTTP-only cookie prevents page JavaScript from reading the session token. We additionally check CSRF tokens and request origin. This reduces specific risks; it is not a complete guarantee against every attack.

**Does AI prescribe?** No. Diagnosis and prescribing require qualified professionals. The AI feature provides general education and visit preparation. A clinical safety assessment is needed before public healthcare use.

**Does it already serve all of Africa?** The location design supports a continent-wide vision. The prototype has eight illustrative cities and country filtering; actual service coverage requires verified partners and local validation.

**What works without the internet?** Once installed and running locally, the interface, fonts, artwork and local demo workflows work without an external database. Atlas and AI require internet access.

**What would you build next?** Start with one verified clinic and pharmacy, user interviews, email verification, staff MFA, notifications, clinical review and a measured local pilot. Add complex services only after that core journey works in practice.

## Rehearsal checklist

- Run the project before the defense and keep the terminal open.
- Test one new appointment and one collection yourself.
- Know how to sign out and switch all four roles.
- Use a non-Sunday future date and an available slot.
- Set up Atlas/OpenAI in `.env` privately, restart, and verify if you plan to show them.
- Keep the offline demo available in case internet access fails.
- Never show your `.env`, connection-string password, or API key on a projector.
- Be prepared to explain every major route and component. Adapt and learn the implementation rather than claiming understanding you have not developed.

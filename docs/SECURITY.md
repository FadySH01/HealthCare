# Security implementation and launch requirements

## Implemented and tested locally

- Scrypt with random salt, N=131072, r=8, p=1; asynchronous derivation with bounded input length. Passwords require 8–128 characters at registration.
- Random 256-bit session tokens; only token digests stored in the database. Eight-hour absolute expiry. Logout revokes the server session.
- HttpOnly/SameSite=Strict cookies; Secure and `__Host-` prefix in production.
- Session-bound CSRF tokens for authenticated state changes; a custom request header, JSON content type, allowed-origin checks, and cross-site fetch rejection for mutations. No wildcard CORS.
- Explicit patient/clinic/pharmacy/admin authorization and per-record ownership checks.
- Zod strict schemas reject unknown fields, including privilege and price overrides; database query filters are built server-side.
- Helmet security headers and a self-only production content security policy. React renders chat replies as text, not HTML.
- API, sign-in and AI request limits; 20KB JSON request limit, bounded AI history and output length, external request timeout.
- Session, account and booking database indexes. Protected audit metadata.
- No browser-exposed Atlas or OpenAI secrets. Environment and demo data excluded from version control.
- Fail-closed production startup; sample catalogue and demo sessions hidden/disabled in live mode.

## Verified scope

The automated API, map-normalization and email-verification tests and the production build should be run before every release. Patient booking → clinic confirmation and collection request → pharmacy readiness have been tested against the local adapter. A prior dependency audit reported no known vulnerabilities at that time; this is not a security certification.

Atlas authentication and network connectivity passed a read-only connection check using the dedicated `aerix_app` user. Live API/database writes, real email delivery, OpenAI responses, HTTPS infrastructure and penetration testing remain unverified. Do not describe this as unhackable or bank-certified.

## Required before real patient use

1. Verify actual providers and catalogue information. Define credential checking, staff provisioning and removal procedures.
2. Configure and test the implemented email verification, then add password recovery, MFA for staff/admin, revocation controls and account deletion/export.
3. Define controller/contact details, consent records, retention, data residency, lawful processing and country-specific privacy requirements with qualified advice.
4. Obtain clinical review of AI scope, evaluate unsafe outputs and emergency handling, and restrict rollout accordingly. Prompt instructions alone are not a safety guarantee.
5. Use HTTPS, narrow Atlas IP access, least-privilege credentials, encrypted backups and tested restoration. Restrict runtime database permissions and rotate secrets.
6. Move rate limits to shared infrastructure before scaling; add operational monitoring, redacted logs, alerts, incident response and spending limits.
7. Add audited provider onboarding, notification delivery and inventory allocation if those services become part of the product.
8. Conduct independent security and accessibility review; test real MongoDB concurrency and failure handling.

Demo mode is local-only by default. Do not bind a demonstration with passwordless admin shortcuts to a public interface. Never upload `.env`, `.data` or credentials with a submission or source archive.

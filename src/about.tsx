import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Globe2,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useApp } from "./context";
import { api } from "./api";
import { Empty, Notice, PageTitle } from "./components";
export function NotFound() {
  return (
    <Empty
      title="This page has taken a different path"
      action={
        <Link className="button primary" to="/">
          Back to your health space
        </Link>
      }
    >
      Let’s get you back to somewhere familiar.
    </Empty>
  );
}
export function About({ privacy = false }: { privacy?: boolean }) {
  const { user, toast } = useApp();
  const location = useLocation();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [emailSent, setEmailSent] = useState<boolean | null>(null);
  async function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await api<{ emailSent: boolean }>("/applications", { method: "POST", body: data });
      setDone(true);
      setEmailSent(result.emailSent);
      toast(result.emailSent ? "Application saved and sent to AERIX for review." : "Application saved. Email notification is unavailable, but it remains in the AERIX review workspace.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (privacy)
    return (
      <>
        <PageTitle
          eyebrow="TRUST STARTS WITH CLARITY"
          title="Your privacy. Your peace of mind."
          description="Understand what AERIX does, what it stores, and where its limits are."
        />
        <div className="prose panel">
          <h2>A growing network, with clear boundaries</h2>
          <p>
            AERIX is an early-stage network. Demonstration facilities,
            products and availability are fictional. Do not use this version to
            arrange real care or store real medical information. It is not an
            emergency service.
          </p>
          <h2>Information stored by the application</h2>
          <p>
            Accounts store your name, email, role and a salted password hash.
            Appointment requests store the selected facility, clinician, service, time and
            status. If you type a visit note and agree to share it, that note is stored with
            the appointment and shown to you and the selected clinic team. Collection requests store the product, quantity and status.
            No medical record uploads or payment card information are collected.
          </p>
          <p>
            When email delivery is configured, AERIX sends a request alert to
            aerixcompany@gmail.com containing the clinic and requested date and
            time and the patient's name and email, or the pharmacy, item,
            quantity and fulfilment preference. Alerts do not include visit notes;
            sent email may remain in the AERIX inbox.
          </p>
          <p>
            Patient records are available to that patient and the relevant care
            team. Platform administrators see aggregate counts, provider
            applications and action metadata, rather than an unrestricted
            clinical-record dashboard.
          </p>
          <h2>Health guide messages</h2>
          <p>
            When online AI is enabled, signed-in users can consent to send their
            messages to the configured AI provider for a response. AERIX does not
            save the conversation in its database; the provider's data policies
            apply. Otherwise, the offline guide matches questions to prepared
            general information on your device. Messages remain in the page until
            you leave or clear the chat. Avoid entering names, addresses, identity
            numbers, or other private health details.
          </p>
          <p>
            The guide may be incomplete or wrong. It provides general information and
            cannot diagnose, prescribe, monitor emergencies or replace
            professional advice.
          </p>
          <h2>Account and session protection</h2>
          <p>
            Passwords are hashed using scrypt. Sessions use randomly generated
            tokens in HTTP-only cookies, with secure cookies required in
            production. The server validates requests and checks both roles and
            ownership. Secrets stay on the server. These controls reduce risk
            but do not guarantee security.
          </p>
          <h2>Location</h2>
          <p>
            Your selected city is saved on this device. If you choose “Use my
            location,” the browser asks permission; approximate coordinates are
            sent through AERIX to the public map-data service for nearby results
            and distances. AERIX does not save those coordinates to your account
            or database.
          </p>
          <h2>Before public launch</h2>
          <p>
            A named data controller, contact route, retention schedule, account
            deletion process, local legal review, verified providers, clinical
            safety assessment, backup and recovery procedures, and an
            independent security assessment are still required. Do not collect
            real patient data before those are in place.
          </p>
          <p>
            Policy status: pilot disclosure, September 2026. It is not a claim
            of compliance with every African jurisdiction.
          </p>
        </div>
      </>
    );
  return (
    <>
      <PageTitle
        eyebrow="BUILT WITH A BIGGER PURPOSE"
        title="Care has no borders."
        description="AERIX’s vision is a more connected healthcare experience, across Africa."
      />
      <section className="about-hero">
        <span className="feature-icon green">
          <Globe2 size={30} />
        </span>
        <h2>
          One continent.
          <br />
          Millions of journeys.
          <br />
          <em>A better connection.</em>
        </h2>
        <p>
          Finding the right care should feel simpler. AERIX brings discovery,
          appointment requests, pharmacy collections and health information into
          one thoughtful space.
        </p>
      </section>
      <div className="values-grid">
        {[
          {
            icon: HeartHandshake,
            title: "Community comes first",
            text: "Start with the real decisions people make when looking for care.",
          },
          {
            icon: ShieldCheck,
            title: "Trust is earned",
            text: "Make information, limitations and data choices clear.",
          },
          {
            icon: Sparkles,
            title: "Technology with purpose",
            text: "Use AI to support understanding, with people responsible for clinical decisions.",
          },
        ].map((v) => (
          <section className="panel" key={v.title}>
            <v.icon size={25} />
            <h3>{v.title}</h3>
            <p>{v.text}</p>
          </section>
        ))}
      </div>
      <div className="partner-layout">
        <div>
          <span className="eyebrow">GROW WITH AERIX</span>
          <h2 id="partners">
            A healthier network
            <br />
            starts locally.
          </h2>
          <p>
            Hospitals and pharmacies can apply to join AERIX and manage their own public profile, clinicians, appointment requests or pharmacy listings after verification.
          </p>
          <p>Provider onboarding currently starts in Lagos State, Nigeria. Each facility is checked before it appears as a partner or accepts requests; other African locations can be added as local verification is established.</p>
          <Notice>
            This is an interest form. Submitting does not verify your facility,
            activate services, or guarantee partnership.
          </Notice>
        </div>
        <section className="panel">
          {done ? (
            <Empty title="Thank you for starting a conversation">
              {emailSent
                ? "Your application is saved and AERIX was notified by email. It is awaiting review; this is not a partnership approval."
                : "Your application is saved in the administrator workspace, but an AERIX email notification was not confirmed. It is awaiting review; this is not a partnership approval."}
            </Empty>
          ) : !user ? (
            <Empty
              title="Join the conversation"
              action={
                <Link className="button primary" to="/account" state={{ from: "/about#partners" }}>
                  Sign in to apply <ArrowRight size={16} />
                </Link>
              }
            >
              Create or sign in to an account, then submit the hospital or pharmacy details. AERIX reviews each application before it can become a network partner.
            </Empty>
          ) : user.role !== "patient" ? (
            <Empty title="You already have a team account">
              Manage your current account in the workspace.
            </Empty>
          ) : (
            <form className="form-stack" onSubmit={apply}>
              <h3>Become a care partner</h3>
              <label>
                Facility name
                <input name="name" required maxLength={120} />
              </label>
              <div className="form-two">
                <label>
                  Provider type
                  <select name="kind" defaultValue={(location.state as { kind?: string } | null)?.kind === "pharmacy" ? "pharmacy" : "hospital"}>
                    <option value="hospital">Hospital</option>
                    <option value="pharmacy">Pharmacy</option>
                  </select>
                </label>
                <label>
                  Country
                  <select name="country" defaultValue="Nigeria">
                    <option value="Nigeria">Nigeria</option>
                  </select>
                </label>
              </div>
              <label>
                State / region
                <input name="region" required maxLength={120} placeholder="Lagos State" />
              </label>
              <label>
                City
                <input name="city" required maxLength={120} />
              </label>
              <label>
                Professional registration reference
                <input name="registration" required maxLength={120} />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary full" disabled={busy}>
                {busy ? "Submitting…" : "Submit interest"}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}

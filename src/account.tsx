import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ShieldCheck,
  UserRound,
  Building2,
  Pill,
  Settings2,
  Eye,
  EyeOff,
} from "lucide-react";
import { api, setCsrf } from "./api";
import { useApp } from "./context";
import { Notice, PageTitle } from "./components";
import type { User } from "./types";
export function Account() {
  const { user, setUser, config, toast } = useApp(),
    navigate = useNavigate(),
    location = useLocation();
  const requestedProvider = new URLSearchParams(location.search).get("join");
  const [tab, setTab] = useState(requestedProvider ? "Create account" : "Sign in"),
    [networkKind, setNetworkKind] = useState<"patient" | "hospital" | "pharmacy">(requestedProvider === "hospital" || requestedProvider === "pharmacy" ? requestedProvider : "patient"),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [consent, setConsent] = useState(false),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [challenge, setChallenge] = useState(""),
    [code, setCode] = useState(""),
    [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function authenticate(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{
        user: User;
        csrf: string;
        verificationRequired?: boolean;
        challenge?: string;
        resendAfter?: number;
      }>(path, {
        method: "POST",
        body,
      });
      if (result.verificationRequired && result.challenge) {
        setChallenge(result.challenge);
        setCooldown(result.resendAfter || 60);
        setPassword("");
        setCode("");
        return;
      }
      setUser(result.user);
      setCsrf(result.csrf);
      setPassword("");
      toast(
        `Welcome${result.user.role === "patient" ? `, ${result.user.name.split(" ")[0]}` : " to your workspace"}.`,
      );
      const returnTo = (location.state as { from?: string } | null)?.from;
      const safeReturn = ["/about#partners", "/care", "/pharmacy", "/appointments", "/assistant"].includes(returnTo || "") ? returnTo : null;
      navigate(networkKind !== "patient" && tab !== "Sign in" ? "/about#partners" : safeReturn || (result.user.role === "patient" ? "/" : "/workspace"), {
        state: networkKind !== "patient" && tab !== "Sign in" ? { kind: networkKind } : undefined,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (user)
    return (
      <>
        <PageTitle
          eyebrow="YOUR ACCOUNT"
          title={`Hello, ${user.name.split(" ")[0]}.`}
          description="A connected space for your next steps in care."
        />
        <section className="account-profile panel">
          <span className="profile-avatar">{user.name.charAt(0)}</span>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <span className="pill-label">{user.role} account</span>
          <div className="profile-links">
            <Link
              className="button primary"
              to={user.role === "patient" ? "/appointments" : "/workspace"}
            >
              Open {user.role === "patient" ? "my appointments" : "workspace"}{" "}
              <ArrowRight size={17} />
            </Link>
            <Link className="button outline" to="/privacy">
              Privacy & safety
            </Link>
          </div>
          <p className="muted">
            Sign out using the arrow icon at the top of the page to switch
            accounts.
          </p>
        </section>
      </>
    );
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <span className="eyebrow">YOUR HEALTH, CONNECTED.</span>
        <h1>
          A healthier future
          <br />
          starts with <em>you.</em>
        </h1>
        <p>
          One account. Your appointments, pharmacy requests, and next steps in
          care, together.
        </p>
        <div className="auth-art">
          <div className="auth-ring" />
          <div className="auth-cross">+</div>
          <span className="auth-floating">
            <ShieldCheck size={19} />A space built around you
          </span>
        </div>
        <div className="auth-benefits">
          <span>
            <Check size={16} />
            Plan your next visit
          </span>
          <span>
            <Check size={16} />
            Keep track of care
          </span>
          <span>
            <Check size={16} />
            Ask health questions
          </span>
        </div>
      </section>
      <section className="auth-form panel">
        {challenge ? (
          <>
            <span className="eyebrow">VERIFY YOUR EMAIL · STEP 2 OF 2</span>
            <h2>Check your inbox.</h2>
            <p className="muted">
              Enter the six-digit code sent to <strong>{email}</strong>. It
              expires in 10 minutes.
            </p>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                authenticate("/auth/verify-email", { challenge, code });
              }}
            >
              <label>
                Verification code
                <input
                  className="verification-code"
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  required
                />
              </label>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <button
                className="button primary full"
                disabled={busy || code.length !== 6}
              >
                {busy ? "Checking…" : "Verify & continue"}
                <ArrowRight size={17} />
              </button>
              <button
                type="button"
                className="button outline full"
                disabled={busy || cooldown > 0}
                onClick={() => authenticate("/auth/resend-code", { challenge })}
              >
                {cooldown ? `Resend code in ${cooldown}s` : "Send a new code"}
              </button>
              <button
                type="button"
                className="button outline"
                disabled={busy}
                onClick={() => {
                  setChallenge("");
                  setError("");
                  setTab("Sign in");
                }}
              >
                Back to sign in
              </button>
            </form>
            <p className="muted">
              Check your spam folder too. Your account becomes active only after
              verification.
            </p>
          </>
        ) : (
          <>
            <div className="tab-bar">
              {["Sign in", "Create account"].map((t) => (
                <button
                  key={t}
                  className={t === tab ? "active" : ""}
                  onClick={() => {
                    setTab(t);
                    setError("");
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <h2>
              {tab === "Sign in" ? "Welcome back." : "Make yourself at home."}
            </h2>
            <p className="muted">
              {tab === "Sign in"
                ? "Your next step in care is waiting."
                : networkKind === "patient"
                  ? "Create a personal account to find care and manage your next steps."
                  : "Create a person account first, then submit your healthcare organization for review."}
            </p>
            {config.demo && <Notice>This is the AERIX demo preview and it has separate account storage. To use an account registered on the hosted AERIX site, open that same site and choose Sign in.</Notice>}
            {tab !== "Sign in" && requestedProvider !== "hospital" && requestedProvider !== "pharmacy" && (
              <div className="signup-steps">
                <span className="active">1 · Your details</span>
                <span>2 · Verify email</span>
              </div>
            )}
            {tab !== "Sign in" && requestedProvider !== "hospital" && requestedProvider !== "pharmacy" && (
              <div className="personal-account-note"><UserRound size={19}/><span><strong>Personal account</strong><small>For finding care, planning visits and managing your own requests.</small></span></div>
            )}
            {tab !== "Sign in" && (requestedProvider === "hospital" || requestedProvider === "pharmacy") && (
              <Notice><strong>{requestedProvider === "hospital" ? "Hospital or clinic registration" : "Pharmacy registration"}</strong><br />Create and verify your personal sign-in first. You’ll then submit this facility for administrator review; it will not appear as an AERIX partner until its identity and contact details are checked.</Notice>
            )}
            {!config.emailDelivery && tab === "Create account" && (
              <div className="auth-note">
                <p>{config.demo
                  ? "Email verification is not configured on this computer. New account signup is paused until Gmail is configured."
                  : "Email verification is temporarily unavailable. New accounts can be created when the email service is restored."}</p>
                <button type="button" className="button outline small-button" onClick={() => { setTab("Sign in"); setError(""); }}>Already registered? Sign in</button>
              </div>
            )}
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                authenticate(
                  tab === "Sign in" ? "/auth/login" : "/auth/register",
                  tab === "Sign in"
                    ? { email, password }
                    : { name, email, password, consent },
                );
              }}
            >
              {tab !== "Sign in" && (
                <label>
                  Your name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    maxLength={120}
                    required
                    placeholder="How should we call you?"
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  maxLength={254}
                  required
                  placeholder="you@example.com"
                />
              </label>
              <label>
                Password
                <div className="password-input">
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={
                      tab === "Sign in" ? "current-password" : "new-password"
                    }
                    minLength={tab === "Sign in" ? 1 : 8}
                    maxLength={128}
                    required
                    placeholder={
                      tab === "Sign in"
                        ? "Your password"
                        : "At least 8 characters"
                    }
                  />
                  <button
                    type="button"
                    aria-label={show ? "Hide password" : "Show password"}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              {tab !== "Sign in" && (
                <label className="checkbox-label consent">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    I have read the{" "}
                    <Link to="/privacy">privacy & safety information</Link> and
                    understand this is a pilot.
                  </span>
                </label>
              )}
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <button disabled={busy || (tab !== "Sign in" && !config.emailDelivery)} className="button primary full">
                {busy ? "Please wait…" : tab}
                <ArrowRight size={17} />
              </button>
            </form>
            {requestedProvider !== "hospital" && requestedProvider !== "pharmacy" && (
              <p className="account-provider-link">Registering a hospital or pharmacy? <Link to="/partners/join">Use provider onboarding <ArrowRight size={14}/></Link></p>
            )}
            {config.demo && (
              <div className="demo-login">
                <div className="divider-label">
                  <span />
                  TRY A SAMPLE WORKSPACE
                  <span />
                </div>
                <p>Try each side of the care journey.</p>
                <div className="demo-roles">
                  {[
                    { role: "patient", label: "Patient", icon: UserRound },
                    { role: "clinic", label: "Clinic", icon: Building2 },
                    { role: "pharmacy", label: "Pharmacy", icon: Pill },
                    { role: "admin", label: "Admin", icon: Settings2 },
                  ].map((x) => (
                    <button
                      key={x.role}
                      disabled={busy}
                      onClick={() =>
                        authenticate("/auth/demo", { role: x.role })
                      }
                    >
                      <x.icon size={19} />
                      {x.label}
                    </button>
                  ))}
                </div>
                <small>Prepared accounts · no real patient information</small>
              </div>
            )}
          </>
        )}
        <div className="auth-note">
          <ShieldCheck size={15} />
          Your password is hashed. Your session stays in a protected cookie.
        </div>
      </section>
    </div>
  );
}

export function ProviderJoin() {
  return (
    <>
      <PageTitle eyebrow="JOIN THE AERIX NETWORK" title="Register a care provider." description="Hospitals and pharmacies have a dedicated onboarding path. AERIX reviews each facility before listing it or accepting requests." />
      <div className="provider-join-grid">
        <article className="panel provider-join-card">
          <span className="provider-join-icon"><Building2 /></span>
          <h2>Hospital or clinic</h2>
          <p>Start with a named staff contact, facility details and professional registration reference. After email verification, submit the application for review.</p>
          <Link className="button primary" to="/account?join=hospital">Start hospital registration <ArrowRight size={17}/></Link>
        </article>
        <article className="panel provider-join-card">
          <span className="provider-join-icon"><Pill /></span>
          <h2>Pharmacy</h2>
          <p>Start with a named staff contact and pharmacy registration reference. Products and stock remain unavailable until the pharmacy is reviewed and activated.</p>
          <Link className="button primary" to="/account?join=pharmacy">Start pharmacy registration <ArrowRight size={17}/></Link>
        </article>
      </div>
      <Notice>Registration is currently limited to Lagos State, Nigeria. Applying does not create a partnership or confirm that a facility is licensed. Never submit patient health information in this form.</Notice>
      <p className="provider-join-back"><Link to="/account">I’m looking for personal care access</Link></p>
    </>
  );
}

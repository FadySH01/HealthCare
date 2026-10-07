import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, HeartPulse, MapPin, MessageCircle, Pill, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useApp } from "./context";
import { NearbyPlaces } from "./nearby";
import { api } from "./api";

const tools = [
  { icon: Search, title: "Find care", body: "Explore public hospital listings and check directions.", to: "/care", action: "Explore care" },
  { icon: CalendarDays, title: "Plan a visit", body: "Prepare an appointment enquiry to send to a facility.", to: "/appointments", action: "Plan a visit" },
  { icon: Pill, title: "Find a pharmacy", body: "Look for nearby pharmacy listings and call to confirm stock.", to: "/pharmacy", action: "Explore pharmacies" },
  { icon: Sparkles, title: "Health guide", body: "Get prepared answers to common health questions, even offline.", to: "/assistant", action: "Ask a question" },
];

export function Landing() {
  const { config } = useApp();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  async function sendFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    setFeedbackBusy(true); setFeedbackStatus("");
    try { await api("/feedback", { method: "POST", body: { category: String(values.get("category")), message: String(values.get("message")) } }); form.reset(); setFeedbackStatus("Thanks. Your feedback was sent to the AERIX team."); }
    catch (error) { setFeedbackStatus((error as Error).message || "Feedback could not be sent. Try again later."); }
    finally { setFeedbackBusy(false); }
  }
  return <div className="simple-home">
    <section className="simple-hero">
      <div className="simple-hero-copy"><span className="demo-pill">AERIX · CARE PREVIEW</span><h1>Care starts with one clear next step.</h1><p>Find a place, prepare a visit, or get simple health information—without the clutter.</p><div className="simple-hero-actions"><Link className="button emergency-cta" to="/emergency"><HeartPulse size={18}/> Emergency plan <ArrowRight size={17}/></Link><Link className="button light-button" to="/account">Create an account <ArrowRight size={17}/></Link></div><Link className="provider-entry-link" to="/partners/join">Are you registering a hospital or pharmacy? <ArrowRight size={15}/></Link><div className="simple-safety-line"><ShieldCheck size={17}/> Sample providers are not confirmed partners; AERIX does not dispatch emergency help.</div></div>
      <div className="simple-hero-art" aria-hidden="true"><div className="hero-glow"/><span className="hero-heart"><HeartPulse size={47}/></span><span className="hero-orbit orbit-a"/><span className="hero-orbit orbit-b"/><div className="hero-note"><MapPin size={16}/><span><b>One step at a time</b><small>Your location is only used when you choose.</small></span></div></div>
    </section>
    <section className="simple-tools"><div className="section-heading"><div><span className="eyebrow">YOUR HEALTH, MADE SIMPLE</span><h2>What would you like to do?</h2></div><span className="section-hint">Choose a starting point</span></div><div className="simple-tool-grid">{tools.map(({icon:Icon,title,body,to,action})=><article className="simple-tool-card" key={title}><span className="simple-tool-icon"><Icon size={21}/></span><h3>{title}</h3><p>{body}</p><Link to={to}>{action}<ArrowRight size={15}/></Link></article>)}</div></section>
    <section className="simple-directory"><div className="section-heading"><div><span className="eyebrow">PUBLIC MAP LISTINGS</span><h2>Explore hospitals nearby.</h2><p>These are community map results, not confirmed AERIX partners. Call before travelling.</p></div></div><NearbyPlaces kind="hospital" coords={coords} onCoords={setCoords}/></section>
    <section className="simple-feedback"><div><span className="eyebrow">HELP US IMPROVE</span><h2>Share feedback.</h2><p>Tell us what was confusing or what would make AERIX more useful.</p></div><form className="form-stack" onSubmit={sendFeedback}><label>Type<select name="category"><option value="idea">An idea</option><option value="problem">Something is not working</option><option value="accessibility">Accessibility</option><option value="other">Other</option></select></label><label>Your feedback<textarea name="message" required minLength={8} maxLength={1000} rows={3} placeholder="What should we improve?"/></label><button className="button primary" disabled={feedbackBusy}>{feedbackBusy ? "Sending…" : "Send feedback"}<MessageCircle size={16}/></button>{feedbackStatus && <p className="inline-status" role="status">{feedbackStatus}</p>}</form></section>
    <p className="simple-disclaimer">AERIX is a care-navigation preview. Map details may be incomplete. It does not diagnose or prescribe; shown providers are not confirmed partners, and requests are not confirmed until a provider responds.</p>
  </div>;
}

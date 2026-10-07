import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Camera, Check, Copy, HeartPulse, Mail, MapPin, MessageCircle, Navigation, ShieldCheck } from "lucide-react";
import { PageTitle } from "./components";
import { api } from "./api";
import { useApp } from "./context";

type Point = { latitude: number; longitude: number };

export function Emergency() {
  const { config } = useApp();
  const [point, setPoint] = useState<Point | null>(null);
  const [locationStatus, setLocationStatus] = useState("");
  const [person, setPerson] = useState("Myself");
  const [situation, setSituation] = useState("Sudden illness");
  const [note, setNote] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [receipt, setReceipt] = useState("");
  const [emailConsent, setEmailConsent] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [alertReceipt, setAlertReceipt] = useState("");
  const [alertError, setAlertError] = useState("");
  const [copied, setCopied] = useState(false);
  const [photoError, setPhotoError] = useState("");

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  const locationText = useMemo(() => point
    ? `${point.latitude.toFixed(3)}, ${point.longitude.toFixed(3)}`
    : "Location not added", [point]);
  const message = useMemo(() => [
    `Hello, I need help with ${situation.toLowerCase()}.`,
    `This is for: ${person.toLowerCase()}.`,
    point ? `Approximate location: https://www.google.com/maps/search/?api=1&query=${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}` : "Location: not shared",
    note.trim() ? `Note: ${note.trim()}` : "",
    "Please contact me as soon as you can.",
  ].filter(Boolean).join("\n"), [person, situation, point, note]);

  function getLocation() {
    setLocationStatus("");
    if (!navigator.geolocation) { setLocationStatus("Location is not supported by this browser."); return; }
    setLocationStatus("Waiting for your browser’s location permission…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setPoint({ latitude: coords.latitude, longitude: coords.longitude }); setLocationStatus("Location added on this device. It has not been sent to AERIX."); },
      () => setLocationStatus("Location wasn’t available. You can continue without it or check your browser permission."),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  }

  function selectPhoto(file?: File) {
    setPhotoError("");
    setAlertReceipt("");
    setAlertError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) { setPhotoError("Choose an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setPhotoError("Choose an image smaller than 5 MB."); return; }
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    setPhotoName(file.name);
    setPhotoFile(file);
  }

  async function photoForEmail(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This photo could not be prepared on your device.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.7));
    if (!blob || blob.size > 380 * 1024) throw new Error("This photo is too large to email safely. Choose a smaller image.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  }

  async function sendEmergencyAlert() {
    if (!emailConsent || !config.emergencyEmailDelivery) return;
    setSendingAlert(true);
    setAlertReceipt("");
    setAlertError("");
    try {
      const photoBase64 = photoFile ? await photoForEmail(photoFile) : "";
      await api<{ ok: boolean }>("/emergency-alert", {
        method: "POST",
        body: {
          situation,
          person,
          note: note.trim(),
          latitude: point?.latitude ?? null,
          longitude: point?.longitude ?? null,
          photoBase64,
          consent: true,
        },
      });
      setAlertReceipt("AERIX accepted the email alert. It may not be read immediately, and no ambulance has been dispatched.");
    } catch (error) {
      setAlertError((error as Error).message || "The email alert could not be sent. Use the contact options below or call local emergency services.");
    } finally {
      setSendingAlert(false);
    }
  }

  async function copyMessage() {
    try { await navigator.clipboard.writeText(message); setCopied(true); window.setTimeout(() => setCopied(false), 2500); }
    catch { setCopied(false); setLocationStatus("Clipboard access was blocked. Select and copy the message below."); }
  }

  function prepareMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReceipt(`Message prepared at ${new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}. Choose a contact option below and press Send in your messaging app.`);
  }

  const cleanPhone = phone.replace(/[^+\d]/g, "");
  const smsHref = cleanPhone ? `sms:${cleanPhone}?body=${encodeURIComponent(message)}` : undefined;
  const whatsappPhone = cleanPhone.replace(/^\+/, "").replace(/^0/, "234");
  const whatsappHref = cleanPhone ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}` : undefined;
  const emailHref = contactEmail.trim() ? `mailto:${encodeURIComponent(contactEmail.trim())}?subject=${encodeURIComponent("Please contact me")}&body=${encodeURIComponent(message)}` : undefined;

  return <div className="emergency-page">
    <PageTitle eyebrow="A CLEAR NEXT STEP, WHEN IT MATTERS" title="Reach someone you trust." description="Prepare a short message with an optional location, then choose text, WhatsApp or email. Review it and press Send in your app." />
    <div className="emergency-grid">
      <form className="emergency-form" onSubmit={prepareMessage}>
        <section className="emergency-step"><div className="step-heading"><span>1</span><div><h2>Where should help look?</h2><p>Your browser asks before sharing location.</p></div></div>
          <div className="location-capture"><span className="location-marker"><MapPin size={21}/></span><div className="location-readout"><strong>{point ? "Approximate location added" : "Location not shared"}</strong><span>{locationText}</span></div><button type="button" className="button outline" onClick={getLocation}><Navigation size={16}/>{point ? "Update" : "Use my location"}</button></div>
          {locationStatus && <p className="inline-status" role="status">{locationStatus}</p>}
        </section>
        <section className="emergency-step"><div className="step-heading"><span>2</span><div><h2>What is happening?</h2><p>Keep this short. Don’t include names or private records.</p></div></div>
          <div className="emergency-fields"><label>Who needs help?<select value={person} onChange={e => setPerson(e.target.value)}><option>Myself</option><option>Someone with me</option><option>A family member</option></select></label><label>Situation<select value={situation} onChange={e => setSituation(e.target.value)}><option>Sudden illness</option><option>Injury</option><option>Road incident</option><option>Other urgent concern</option></select></label></div>
          <label className="emergency-note">Short note <span>Optional</span><textarea value={note} onChange={e => setNote(e.target.value)} maxLength={240} rows={3} placeholder="For example: needs help at the front gate." /></label>
        </section>
        <section className="emergency-step"><div className="step-heading"><span>3</span><div><h2>Add a photo</h2><p>Optional. It stays on this device unless you choose to email the alert; AERIX does not analyse it.</p></div></div>
          <label className="photo-picker"><Camera size={19}/><span>{photoName || "Choose a photo on this device"}</span><input type="file" accept="image/*" capture="environment" onChange={e => selectPhoto(e.currentTarget.files?.[0])}/></label>
          {photoError && <p className="form-error" role="alert">{photoError}</p>}
          {photoUrl && <div className="local-photo-preview"><img src={photoUrl} alt="Photo preview on this device"/><div><strong>Preview on this device</strong><span>{photoName}</span><button type="button" className="text-button" onClick={() => { URL.revokeObjectURL(photoUrl); setPhotoUrl(""); setPhotoName(""); setPhotoFile(null); }}>Remove photo</button></div></div>}
        </section>
        <section className="emergency-step"><div className="step-heading"><span>4</span><div><h2>Prepare a message</h2><p>Enter a trusted contact’s number to open a text with this message ready.</p></div></div>
          <label className="emergency-note">Trusted contact number <span>Optional</span><input value={phone} onChange={e => setPhone(e.target.value)} maxLength={25} inputMode="tel" placeholder="Enter the number to text" /></label>
          <button className="button primary emergency-submit" type="submit"><HeartPulse size={18}/>Prepare message</button>
          {receipt && <div className="demo-receipt" role="status"><Check size={19}/><div><strong>Message ready</strong><span>{receipt}</span></div></div>}
          <div className="emergency-email-card">
            <div><h3>Email an alert to AERIX</h3><p>This forwards the details below and your optional photo to aerixcompany@gmail.com. It does not dispatch an ambulance or guarantee a response.</p></div>
            <label className="checkbox-label"><input type="checkbox" checked={emailConsent} onChange={event => setEmailConsent(event.target.checked)} /><span>I agree to email my approximate location, situation, note and selected photo to AERIX. I understand the email may be retained in its inbox.</span></label>
            {!config.emergencyEmailDelivery && <p className="inline-status">AERIX email alerts are not configured on this server. You can still prepare a message for a trusted contact below.</p>}
            {alertError && <p className="form-error" role="alert">{alertError}</p>}
            {alertReceipt && <p className="demo-receipt" role="status"><Check size={19}/><span>{alertReceipt}</span></p>}
            <button type="button" className="button primary" disabled={!emailConsent || sendingAlert || !config.emergencyEmailDelivery} onClick={sendEmergencyAlert}><Mail size={17}/>{sendingAlert ? "Sending alert…" : "Send email alert to AERIX"}</button>
          </div>
          <div className="message-preview"><strong>Message preview</strong><pre>{message}</pre>
            <label className="emergency-note">Trusted contact email <span>Optional</span><input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} maxLength={254} placeholder="name@example.com" /></label>
            <div className="message-actions"><button type="button" className="button outline" onClick={copyMessage}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Copied" : "Copy message"}</button>{smsHref && <a className="button outline" href={smsHref}><MessageCircle size={16}/>Text contact</a>}{whatsappHref && <a className="button outline" href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={16}/>WhatsApp</a>}{emailHref && <a className="button outline" href={emailHref}><Mail size={16}/>Email contact</a>}</div>
            <small>These options open your messaging app with the recipient and message filled in. You choose whether to send. SMS and email drafts do not attach the photo.</small></div>
        </section>
      </form>
      <aside className="emergency-aside">
        <section className="urgent-card"><AlertTriangle size={22}/><h3>If this is happening now</h3><p>Call your local emergency number or go to the nearest emergency department. In Lagos, call <a href="tel:112">112</a> or <a href="tel:767">767</a>. Do not wait for a message reply or an AERIX response.</p><strong>AERIX does not monitor this page.</strong></section>
        <section className="emergency-trust"><ShieldCheck size={22}/><h3>What stays private</h3><ul><li>Your location is requested only when you tap the location button.</li><li>Nothing from this form is saved to your AERIX account or database.</li><li>The photo stays on this device unless you choose to email the alert; sent email and its attachment may remain in AERIX’s inbox.</li><li>SMS and WhatsApp open on your device; you choose whether to send.</li></ul></section>
        {point && <a className="button outline full" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`}>Open this area in Maps <Navigation size={16}/></a>}
      </aside>
    </div>
  </div>;
}

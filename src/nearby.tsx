import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarDays, Copy, Mail, MapPin, Phone, Search, LocateFixed } from "lucide-react";
import { api } from "./api";
import { useApp } from "./context";
import { Modal } from "./components";

type MapPlace = { id: string; name: string; kind: string; lat: number; lng: number; distanceKm: number; address: string | null; phone: string | null; email: string | null; mapUrl: string };
// Approximate LGA centre points are search anchors, not user/device locations.
const lagosAreas = [
  { id: "agege", name: "Agege", lat: 6.625, lng: 3.321 },
  { id: "ajeromi", name: "Ajeromi-Ifelodun", lat: 6.455, lng: 3.337 },
  { id: "alimosho", name: "Alimosho", lat: 6.61, lng: 3.30 },
  { id: "amuwo", name: "Amuwo-Odofin", lat: 6.45, lng: 3.28 },
  { id: "apapa", name: "Apapa", lat: 6.448, lng: 3.359 },
  { id: "badagry", name: "Badagry", lat: 6.431, lng: 2.889 },
  { id: "epe", name: "Epe", lat: 6.584, lng: 3.983 },
  { id: "etiosa", name: "Eti-Osa", lat: 6.432, lng: 3.444 },
  { id: "ibeju", name: "Ibeju-Lekki", lat: 6.467, lng: 4.015 },
  { id: "ifako", name: "Ifako-Ijaiye", lat: 6.672, lng: 3.285 },
  { id: "ikeja", name: "Ikeja", lat: 6.601, lng: 3.351 },
  { id: "ikorodu", name: "Ikorodu", lat: 6.619, lng: 3.508 },
  { id: "kosofe", name: "Kosofe", lat: 6.601, lng: 3.396 },
  { id: "lagos-island", name: "Lagos Island", lat: 6.454, lng: 3.394 },
  { id: "lagos-mainland", name: "Lagos Mainland", lat: 6.502, lng: 3.376 },
  { id: "mushin", name: "Mushin", lat: 6.53, lng: 3.35 },
  { id: "ojo", name: "Ojo", lat: 6.4643, lng: 3.1902 },
  { id: "oshodi-isolo", name: "Oshodi-Isolo", lat: 6.55, lng: 3.30 },
  { id: "shomolu", name: "Shomolu", lat: 6.54, lng: 3.39 },
  { id: "surulere", name: "Surulere", lat: 6.50, lng: 3.36 },
];
const alimoshoAnchor = lagosAreas.find((item) => item.id === "alimosho")!;
const withinLagosSearchBounds = (point: { lat: number; lng: number }) => point.lat >= 6.25 && point.lat <= 6.85 && point.lng >= 2.65 && point.lng <= 4.55;
const whatsappNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("0") ? `234${digits.slice(1)}` : digits;
};

export function NearbyPlaces({ kind, coords, onCoords, autoSearch = false }: { kind: "hospital" | "pharmacy"; coords: { lat: number; lng: number } | null; onCoords?: (coords: { lat: number; lng: number }) => void; autoSearch?: boolean }) {
  const { config, location } = useApp();
  const city = config.locations.find((item) => item.id === location);
  const [area, setArea] = useState(() => kind === "hospital" ? (coords ? "selected" : "alimosho") : location === "country:Nigeria" ? "alimosho" : "selected");
  const chosenArea = lagosAreas.find((item) => item.id === area);
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);
  const center = chosenArea || coords || deviceCoords || (kind === "hospital" ? alimoshoAnchor : city ? { lat: city.lat, lng: city.lng } : null);
  const mapCenter = center ? { lat: Math.round(center.lat * 1000) / 1000, lng: Math.round(center.lng * 1000) / 1000 } : null;
  const mapSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${kind === "hospital" ? "hospital" : "pharmacy"} ${chosenArea?.name || (mapCenter ? `${mapCenter.lat},${mapCenter.lng}` : city?.city || "Lagos")}${kind === "hospital" ? ", Lagos, Nigeria" : city?.country === "Nigeria" || !city ? ", Lagos, Nigeria" : `, ${city.country}`}`)}`;
  const directionsOrigin = area === "selected" ? (coords || deviceCoords) : null;
  const roundedOrigin = directionsOrigin ? { lat: Math.round(directionsOrigin.lat * 1000) / 1000, lng: Math.round(directionsOrigin.lng * 1000) / 1000 } : null;
  const [places, setPlaces] = useState<MapPlace[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [enquiry, setEnquiry] = useState<MapPlace | null>(null);
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [medicineName, setMedicineName] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [locating, setLocating] = useState(false);
  useEffect(() => { if (kind === "hospital" && coords) setArea("selected"); }, [kind, coords?.lat, coords?.lng]);
  function useMyLocation() {
    if (!navigator.geolocation) { setError("Location is not available in this browser. Choose a search area instead."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      const next = { lat: position.coords.latitude, lng: position.coords.longitude };
      if (kind === "hospital" && !withinLagosSearchBounds(next)) {
        setError("AERIX hospital search currently covers Lagos State only. Choose one of the Lagos local government areas instead.");
        setLocating(false);
        return;
      }
      setArea("selected");
      setDeviceCoords(next);
      onCoords?.(next);
      setError(""); setLocating(false); void search(next);
    }, () => { setError("We could not access your location. Allow location access or choose an area."); setLocating(false); }, { timeout: 12000, maximumAge: 60000 });
  }
  const enquiryText = enquiry ? kind === "hospital"
    ? `Hello ${enquiry.name}, I would like to ask whether you accept appointment enquiries${preferredDate ? ` for ${preferredDate}` : ""}${preferredTime ? ` around ${preferredTime}` : ""}. Please let me know your availability and how I can arrange a visit. Thank you.`
    : `Hello ${enquiry.name}, I would like to confirm that your pharmacy is open and ask whether I can speak with a licensed pharmacist${medicineName.trim() ? ` about availability of ${medicineName.trim()}` : " about medicine availability"}. Please let me know your address and opening hours before I travel. Thank you.` : "";
  async function copyEnquiry() {
    try { await navigator.clipboard.writeText(enquiryText); setCopyStatus("Message copied. Send it using the facility's verified contact details."); }
    catch { setCopyStatus("Could not copy automatically. Select the message above and copy it manually."); }
  }
  useEffect(() => { setPlaces(null); setError(""); if (autoSearch && center) void search(); }, [kind, center?.lat, center?.lng, autoSearch]);
  async function search(searchCenter = center) {
    if (!searchCenter) return;
    if (kind === "hospital" && !withinLagosSearchBounds(searchCenter)) {
      setError("AERIX hospital search currently covers Lagos State only. Choose one of the Lagos local government areas instead.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ kind, lat: String(searchCenter.lat), lng: String(searchCenter.lng) });
      const result = await api<{ source: string; places: MapPlace[] }>(`/nearby?${params}`);
      setPlaces(result.places);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="nearby-map-section">
    <div className="nearby-map-heading">
      <div><span className="eyebrow">{kind === "hospital" ? "LAGOS STATE ONLY" : "EXPLORE YOUR AREA"}</span><h2>{kind === "hospital" ? "Hospitals near you" : "Pharmacies on the map"}</h2><p>Explore map listings near {chosenArea ? chosenArea.name + ", Lagos" : kind === "hospital" ? "your approximate device location in Lagos" : coords ? "your approximate device location" : city ? `${city.city}, ${city.country}` : "a city you choose above"}.</p></div>
      <button className="button outline" onClick={() => void search()} disabled={!center || busy}><Search size={16}/>{busy ? "Searching…" : "Find nearby places"}</button>
    </div>
    <div className="nearby-area-picker"><label htmlFor={`nearby-area-${kind}`}>Search area</label><select id={`nearby-area-${kind}`} value={area} onChange={(event) => setArea(event.target.value)}><option value="selected">{kind === "hospital" ? "My device location in Lagos" : coords ? "My device location" : city ? `${city.city}, ${city.country}` : "Selected city"}</option>{lagosAreas.map((item) => <option value={item.id} key={item.id}>{item.name}, Lagos</option>)}</select><button className="button outline small-button" type="button" onClick={useMyLocation} disabled={locating}>{locating ? "Finding you…" : <><LocateFixed size={15}/> Use my location</>}</button><span>Location is used for this search only; it isn’t saved to your AERIX account.</span></div>
    {kind === "hospital" && <div className="nearby-emergency-line"><strong>Emergency in Lagos?</strong> Call Lagos State emergency lines <a href="tel:112">112</a> or <a href="tel:767">767</a>. <a href="https://lagosstate.gov.ng/" target="_blank" rel="noopener noreferrer">Official source <ArrowUpRight size={13}/></a>. AERIX cannot dispatch an ambulance.</div>}
    <p className="nearby-map-note">Map data © OpenStreetMap contributors. Hospital searches are restricted to the Lagos State boundary and show community map listings, which may be incomplete or outdated and are not AERIX partners. Facility-specific phone or email details, licences and availability are unverified; call before travelling. A location search sends rounded coordinates to map services. Google Maps receives your rounded starting point only if you open directions. AERIX does not save your location to your account. {kind === "pharmacy" ? <a href="https://pcn.gov.ng/" target="_blank" rel="noopener noreferrer">Check a pharmacy with the Pharmacy Council of Nigeria ↗</a> : <a href="https://www.hfr.fmohconnect.gov.ng/" target="_blank" rel="noopener noreferrer">Check the national facility registry ↗</a>}</p>
    {!center && <p className="muted">Choose a city above or use your location to search.</p>}
    {error && <p role="alert" className="form-error">{error} <a href={kind === "hospital" ? "https://hfr.fmohconnect.gov.ng/facilityfinder" : "https://pcn.gov.ng/"} target="_blank" rel="noopener noreferrer">Try the official directory ↗</a> · <a href={mapSearchUrl} target="_blank" rel="noopener noreferrer">Search Google Maps ↗</a></p>}
    {error && <div className="modal-actions"><a className="button outline" href={mapSearchUrl} target="_blank" rel="noopener noreferrer">Open nearby {kind === "hospital" ? "hospitals" : "pharmacies"} in Google Maps <ArrowUpRight size={14}/></a></div>}
    {mapCenter && <div className="nearby-live-map"><iframe title={`OpenStreetMap around ${chosenArea?.name || (coords ? "your selected area" : city?.city || "the selected city")}`} loading="lazy" referrerPolicy="no-referrer" src={`https://www.openstreetmap.org/export/embed.html?bbox=${(mapCenter.lng - 0.11).toFixed(4)}%2C${(mapCenter.lat - 0.09).toFixed(4)}%2C${(mapCenter.lng + 0.11).toFixed(4)}%2C${(mapCenter.lat + 0.09).toFixed(4)}&layer=mapnik&marker=${mapCenter.lat}%2C${mapCenter.lng}`}/><a href={`https://www.openstreetmap.org/?mlat=${mapCenter.lat}&mlon=${mapCenter.lng}#map=13/${mapCenter.lat}/${mapCenter.lng}`} target="_blank" rel="noopener noreferrer">Open larger map <ArrowUpRight size={14}/></a></div>}
    {places && (places.length ? <><p className="nearby-results-count">Showing {places.length} nearby public map listings. Distances are straight-line estimates; this is not a complete hospital register.</p><div className="nearby-map-grid">{places.map((place) => <article className="nearby-map-card" key={place.id}>
      <div className="nearby-map-icon"><MapPin size={19}/></div><div className="nearby-map-body"><span>{place.distanceKm.toFixed(1)} km straight-line distance</span><h3>{place.name}</h3><p>{place.address || "Address not listed; check the map pin"}</p><div className="nearby-map-actions">
        <a href={place.mapUrl} target="_blank" rel="noopener noreferrer">View map <ArrowUpRight size={14}/></a>
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, Lagos, Nigeria ${place.lat},${place.lng}`)}`} target="_blank" rel="noopener noreferrer">Photos & details on Google Maps <ArrowUpRight size={14}/></a>
        <a href={`https://www.google.com/maps/dir/?api=1${roundedOrigin ? `&origin=${roundedOrigin.lat},${roundedOrigin.lng}` : ""}&destination=${encodeURIComponent(`${place.name}, Lagos, Nigeria ${place.lat},${place.lng}`)}`} target="_blank" rel="noopener noreferrer">Directions <ArrowUpRight size={14}/></a>
        {place.phone && <a href={`tel:${place.phone.replace(/[^\d+]/g, "")}`}><Phone size={14}/> Call</a>}
        {place.phone && <a href={`https://wa.me/${whatsappNumber(place.phone)}?text=${encodeURIComponent(`Hello ${place.name}, please confirm your opening hours and how to contact your team. Thank you.`)}`} target="_blank" rel="noopener noreferrer">WhatsApp <ArrowUpRight size={14}/></a>}
        <button type="button" onClick={() => { setEnquiry(place); setPreferredDate(""); setPreferredTime(""); setMedicineName(""); setCopyStatus(""); }}>{kind === "hospital" ? <CalendarDays size={14}/> : <Phone size={14}/>} {kind === "hospital" ? "Prepare enquiry" : "Ask pharmacy"}</button>
      </div></div>
    </article>)}</div></> : <><p className="muted">The community map has no hospital match within about 12 km. Its listings may be incomplete; try Google Maps or check the official facility register.</p><div className="modal-actions"><a className="button outline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`hospitals in ${chosenArea?.name || (mapCenter ? `${mapCenter.lat},${mapCenter.lng}` : "Lagos")}, Lagos, Nigeria`)}`} target="_blank" rel="noopener noreferrer">Search hospitals on Google Maps <ArrowUpRight size={14}/></a><a className="button outline" href="https://www.hfr.fmohconnect.gov.ng/" target="_blank" rel="noopener noreferrer">Official facility register <ArrowUpRight size={14}/></a></div></>)}
    {enquiry && <Modal title={`Enquire with ${enquiry.name}`} onClose={() => setEnquiry(null)}>
      <p className="modal-description">This facility is a public map listing, not an AERIX partner. The phone or email, if shown, comes from public map data and must be checked before use. AERIX cannot contact the facility{kind === "hospital" ? " or confirm an appointment; prepare an enquiry and send it yourself" : " or confirm that the pharmacy is open or has stock; prepare a question and send it yourself"}.</p>
      {kind === "hospital" && <div className="enquiry-fields"><label>Preferred date (optional)<input type="date" min={new Date().toISOString().slice(0, 10)} value={preferredDate} onChange={(event) => setPreferredDate(event.target.value)}/></label><label>Preferred time (optional)<input type="time" value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)}/></label></div>}
      {kind === "pharmacy" && <label className="enquiry-message-label">Medicine or item to ask about (optional)<input value={medicineName} maxLength={80} onChange={(event) => setMedicineName(event.target.value)} placeholder="Name of the item"/><small>A pharmacist must confirm whether it is appropriate and in stock. Avoid including personal medical details.</small></label>}
      <label className="enquiry-message-label">Your enquiry<textarea value={enquiryText} readOnly rows={4}/></label>
      {copyStatus && <p role="status" className="muted">{copyStatus}</p>}
      <div className="modal-actions"><button className="button outline" onClick={copyEnquiry}><Copy size={16}/> Copy message</button>{enquiry.email && <a className="button outline" href={`mailto:${enquiry.email}?subject=${encodeURIComponent(`${kind === "hospital" ? "Appointment" : "Pharmacy"} enquiry for ${enquiry.name}`)}&body=${encodeURIComponent(enquiryText)}`}><Mail size={16}/> Email facility</a>}{enquiry.phone && <a className="button outline" href={`https://wa.me/${whatsappNumber(enquiry.phone)}?text=${encodeURIComponent(enquiryText)}`} target="_blank" rel="noopener noreferrer"><Phone size={16}/> WhatsApp</a>}{enquiry.phone && <a className="button primary" href={`sms:${enquiry.phone.replace(/[^\d+]/g, "")}?body=${encodeURIComponent(enquiryText)}`}><Phone size={16}/> Open SMS draft</a>}</div>
      <p className="nearby-map-note">Check the facility's identity and contact details before sending. Email, WhatsApp, and SMS open on your device and you choose whether to send. {kind === "hospital" ? "This is an appointment enquiry, not a booking; wait for the hospital to confirm directly." : "This is a question, not an order; wait for the pharmacy to confirm directly."}</p>
    </Modal>}
  </section>;
}

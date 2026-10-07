import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  CalendarDays,
  Pill,
  Sparkles,
  HeartPulse,
  MapPin,
  LocateFixed,
  Clock,
  Check,
  ShieldCheck,
  Building2,
  Globe2,
} from "lucide-react";
import { useApp } from "./context";
import { api, prettyDate } from "./api";
import {
  Empty,
  FacilityCard,
  Modal,
  PageTitle,
  TextLink,
} from "./components";
import type { Appointment, Doctor, Facility } from "./types";
import { NearbyPlaces } from "./nearby";
export function matchesLocation(f: Facility, location: string) {
  return location === "all" || location.startsWith("country:")
    ? location === "all" || f.country === location.slice(8)
    : f.locationId === location;
}
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const lat = radians(b.lat - a.lat);
  const lng = radians(b.lng - a.lng);
  const arc = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(lng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}
export function Booking({
  facility,
  onClose,
}: {
  facility: Facility;
  onClose: () => void;
}) {
  const { user, requireLogin, toast, config } = useApp();
  const navigate = useNavigate();
  const [date, setDate] = useState(""),
    [time, setTime] = useState(""),
    [service, setService] = useState(facility.services[0]),
    [slots, setSlots] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [doctors, setDoctors] = useState<Doctor[]>([]),
    [doctorId, setDoctorId] = useState(""),
    [visitMode, setVisitMode] = useState<"in-person" | "online-demo">("in-person"),
    [specialty, setSpecialty] = useState("Any specialty"),
    [reason, setReason] = useState(""),
    [shareReason, setShareReason] = useState(false);
  const specialties = [...new Set(doctors.map((doctor) => doctor.specialty))].sort();
  const filteredDoctors = doctors.filter((doctor) => specialty === "Any specialty" || doctor.specialty === specialty);
  useEffect(() => {
    let current = true;
    api<Doctor[]>(`/doctors?facilityId=${encodeURIComponent(facility._id)}`)
      .then((rows) => { if (current) setDoctors(rows); })
      .catch(() => { if (current) setDoctors([]); });
    return () => { current = false; };
  }, [facility._id]);
  useEffect(() => {
    setTime("");
    setSlots([]);
    if (!date || (!config.demo && !doctorId)) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<{ slots: string[] }>(`/facilities/${facility._id}/slots?date=${date}${doctorId ? `&doctorId=${encodeURIComponent(doctorId)}` : ""}`, {
      signal: controller.signal,
    })
      .then((r) => setSlots(r.slots))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [date, facility._id, doctorId, config.demo]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (visitMode === "online-demo") {
      onClose();
      navigate("/online-visit-demo", { state: { specialty: specialty === "Any specialty" ? "General care" : specialty } });
      return;
    }
    if (!user) {
      onClose();
      requireLogin();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/appointments", {
        method: "POST",
        body: { facilityId: facility._id, date, time, service, ...(doctorId ? { doctorId } : {}), reason: reason.trim(), shareReason },
      });
      toast(
        "Appointment request sent. Track the hospital’s response in Appointments.",
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    <Modal title="Your next step in care" onClose={onClose}>
      <div className="booking-provider">
        <span className="feature-icon violet">
          <Building2 />
        </span>
        <div>
          <h3>{facility.name}</h3>
          <p>
            {facility.city}, {facility.country}
          </p>
        </div>
      </div>
      <p className="modal-description">{facility.description}</p>
      {facility.phone && <p><a className="button outline" href={`tel:${facility.phone.replace(/[^\d+]/g, "")}`}>Call {facility.name}</a></p>}
      <div className="detail-lines">
        <span>
          <Clock size={16} />
          {facility.hours}
        </span>
        <span>
          <MapPin size={16} />
          {facility.timeZone} · all times local to the hospital
        </span>
      </div>
      {!facility.accepting ? (
        <Empty title="Requests are currently paused">
          Please choose another hospital.
        </Empty>
      ) : (
        <form onSubmit={submit} className="form-stack">
          <label>
            Appointment type
            <select value={visitMode} onChange={(e) => setVisitMode(e.target.value as "in-person" | "online-demo")}>
              <option value="in-person">In person at {facility.name}</option>
              <option value="online-demo">Online AERIX guide session (demo)</option>
            </select>
          </label>
          {visitMode === "online-demo" ? <>
            <p className="modal-description">Start a voice-enabled conversation with the AERIX AI health guide. This does not contact a doctor, reserve a hospital appointment, diagnose a condition, or prescribe medicine.</p>
            <button className="button primary full" type="submit"><Sparkles size={17}/> Continue to online guide demo <ArrowRight size={17}/></button>
          </> : <>
          <label>
            Type of clinician
            <select value={specialty} onChange={(e) => { setSpecialty(e.target.value); setDoctorId(""); }}>
              <option>Any specialty</option>
              {specialties.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          {config.demo && <small className="muted">Clinicians in this preview are fictional demo profiles; requests do not arrange real care.</small>}
          <label>
            Clinician you would like to meet
            <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required={!config.demo}>
              <option value="">{config.demo ? "Any available clinician (demo)" : "Choose a listed clinician"}</option>
              {filteredDoctors.map((doctor) => <option value={doctor._id} key={doctor._id}>{doctor.name} · {doctor.specialty}</option>)}
            </select>
          </label>
          {!config.demo && !doctors.length && <p className="form-error" role="status">This hospital has not published a clinician roster. Call the hospital directly; online requests will open when staff add one.</p>}
          <label>
            What would you like help with? (optional)
            <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} maxLength={500} rows={3} placeholder="A short note for the clinic team" />
            <small>This note is stored with your appointment request and visible to you and the clinic team. Do not include passwords, identity numbers, or emergency information. Appointment email alerts do not include this note.</small>
          </label>
          {reason.trim() && <label className="checkbox-label"><input type="checkbox" checked={shareReason} onChange={(e) => setShareReason(e.target.checked)} /> I agree to share this note with the clinic team.</label>}
          <label>
            Care service
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
            >
              {facility.services.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Preferred date
            <input
              type="date"
              required
              min={tomorrow.toLocaleDateString("en-CA")}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onInput={(e) => setDate(e.currentTarget.value)}
            />
          </label>
          <div className="date-shortcuts" aria-label="Quick date selection">
            {Array.from({ length: 5 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() + i + 1);
              const value = d.toLocaleDateString("en-CA");
              return (
                <button
                  type="button"
                  key={value}
                  className={date === value ? "selected" : ""}
                  onClick={() => setDate(value)}
                >
                  {d.toLocaleDateString("en", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </button>
              );
            })}
          </div>
          {date && (
            <fieldset className="slots">
              <legend>Choose a time</legend>
              {loading ? (
                <p>Checking available times…</p>
              ) : slots.length ? (
                slots.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={time === t ? "selected" : ""}
                    onClick={() => setTime(t)}
                  >
                    {t}
                  </button>
                ))
              ) : (
                <p>No times available. Please try another date.</p>
              )}
            </fieldset>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button primary full"
            disabled={busy || (!config.demo && !doctorId) || (!!reason.trim() && !shareReason) || (!!user && (!time || user.role !== "patient"))}
          >
            {busy
              ? "Sending request…"
              : !user
                ? "Sign in to request appointment"
                : "Request appointment"}
            <ArrowRight size={17} />
          </button>
          {user && user.role !== "patient" && (
            <small>Use a patient account to request care.</small>
          )}
          <small className="muted">
            A request becomes an appointment only when the hospital confirms.
          </small>
          {user && config.emailDelivery && <small className="muted">AERIX emails its team a request alert with the clinic and requested date and time. It does not include your name or health details.</small>}
          </>}
        </form>
      )}
    </Modal>
  );
}
export function Home() {
  const { user, facilities, location, config } = useApp();
  const [booking, setBooking] = useState<Facility | null>(null),
    [appointments, setAppointments] = useState<Appointment[]>([]);
  useEffect(() => {
    if (user?.role === "patient")
      api<Appointment[]>("/appointments")
        .then(setAppointments)
        .catch(() => {});
    else setAppointments([]);
  }, [user]);
  const nearby = facilities
    .filter((f) => f.kind === "hospital" && matchesLocation(f, location))
    .slice(0, 2);
  const upcoming = appointments
    .filter((a) => ["requested", "confirmed"].includes(a.status))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  return (
    <>
      <PageTitle
        eyebrow="A HEALTHIER DAY STARTS HERE"
        title={
          user
            ? `Good to see you, ${user.name.split(" ")[0]}.`
            : "A little closer to better care."
        }
        description="Find your care. Make your next move. Feel more connected."
        action={
          <span className="date-label">
            <CalendarDays size={16} />
            {new Intl.DateTimeFormat("en", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(new Date())}
          </span>
        }
      />
      <section className="signed-emergency-callout">
        <span className="emergency-callout-icon"><HeartPulse size={21}/></span>
        <div><strong>Need to prepare an emergency message?</strong><span>Choose a trusted contact and review a message before sending. AERIX does not dispatch emergency services.</span></div>
        <Link className="button emergency-cta" to="/emergency">Prepare a message <ArrowUpRight size={16}/></Link>
      </section>
      <div className="home-columns">
        <div className="home-primary">
          <section className="hero">
            <div className="hero-copy">
              <span className="hero-label">
                <span /> CONNECTING CARE, ACROSS AFRICA
              </span>
              <h2>
                Your health.
                <br />
                Your people.
                <br />
                <span>All connected.</span>
              </h2>
              <p>
                A simpler way to find healthcare,
                <br className="desktop-only" /> plan a visit, and take care of
                you.
              </p>
              <Link to="/care" className="button dark">
                Find your care <ArrowUpRight size={18} />
              </Link>
              <div className="hero-foot">
                <ShieldCheck size={14} />
                Thoughtfully built around you.
              </div>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <div className="orbital orbit-one" />
              <div className="orbital orbit-two" />
              <div className="health-orb">
                <div className="cross-shape" />
              </div>
              <span className="float-label label-one">
                <span>
                  <HeartPulse size={18} />
                </span>
                A little peace of mind
              </span>
              <span className="float-label label-two">
                <span>
                  <Check size={16} />
                </span>
                Your next step, simplified
              </span>
              <span className="decor-dot dot-one" />
              <span className="decor-dot dot-two" />
              <span className="sparkle-decor">✧</span>
            </div>
          </section>
          <section className="quick-section">
            <div className="section-heading">
              <h2>What brings you here?</h2>
              <span>A good place to start</span>
            </div>
            <div className="quick-grid">
              {[
                {
                  to: "/care",
                  icon: Search,
                  title: "Find care",
                  sub: "Search hospitals nearby",
                  color: "violet",
                },
                {
                  to: "/appointments",
                  icon: CalendarDays,
                  title: "Plan a visit",
                  sub: "Your appointments, together",
                  color: "peach",
                },
                {
                  to: "/pharmacy",
                  icon: Pill,
                  title: "Pharmacy",
                  sub: "Find your care essentials",
                  color: "green",
                },
                {
                  to: "/assistant",
                  icon: Sparkles,
                  title: "Ask AERIX",
                  sub: "A space for health questions",
                  color: "blue",
                },
              ].map((x) => (
                <Link className="quick-card" key={x.to} to={x.to}>
                  <span className={`feature-icon ${x.color}`}>
                    <x.icon size={21} />
                  </span>
                  <ArrowUpRight className="quick-arrow" size={17} />
                  <h3>{x.title}</h3>
                  <p>{x.sub}</p>
                </Link>
              ))}
            </div>
          </section>
          <section className="nearby-section">
            <div className="section-heading">
              <div>
                <h2>Explore care around you</h2>
                <p>A starting point for your next visit.</p>
              </div>
              <TextLink to="/care">View all</TextLink>
            </div>
            {nearby.length ? (
              <div className="facility-grid home-facilities">
                {nearby.map((f) => (
                  <FacilityCard key={f._id} facility={f} onBook={setBooking} />
                ))}
              </div>
            ) : (
              <Empty title="Your community could be next">
                There are no AERIX hospitals listed for this location yet. Explore public map listings or <Link to="/about#partners">invite a hospital to join.</Link>
              </Empty>
            )}
          </section>
          <div className="vision-strip">
            <span className="feature-icon green">
              <Globe2 size={22} />
            </span>
            <div>
              <h3>Africa is the vision. Community is the beginning.</h3>
              <p>Help shape a more connected future for healthcare.</p>
            </div>
            <Link to="/about" aria-label="Learn about our vision">
              <ArrowUpRight />
            </Link>
          </div>
        </div>
        <aside className="home-secondary">
          <section className="assistant-promo">
            <div className="section-heading">
              <span className="ai-mark">
                <Sparkles size={22} />
              </span>
              <span className="pill-label">YOUR CARE COMPANION</span>
            </div>
            <h2>
              A question on
              <br />
              your mind?
            </h2>
            <p>
              Make space for your health questions. Let’s take the next step
              together.
            </p>
            <Link to="/assistant" className="button light full">
              Talk to AERIX <ArrowUpRight size={17} />
            </Link>
            <small><span className="connection-dot connected" /> Free offline health guide · general information only</small>
          </section>
          <section className="next-visit panel">
            <div className="section-heading">
              <h2>Your next visit</h2>
              <CalendarDays size={18} />
            </div>
            {upcoming ? (
              <>
                <div className="appointment-date">
                  <strong>
                    {new Date(`${upcoming.date}T12:00:00`).getDate()}
                  </strong>
                  <span>
                    {new Date(`${upcoming.date}T12:00:00`).toLocaleString(
                      "en",
                      { month: "short" },
                    )}
                  </span>
                </div>
                <h3>{upcoming.facilityName}</h3>
                <p>
                  {prettyDate(upcoming.date)} · {upcoming.time}
                </p>
                <span className="pill-label">{upcoming.status}</span>
                <TextLink to="/appointments">View appointment</TextLink>
              </>
            ) : (
              <>
                <div className="calendar-illustration">
                  <CalendarDays size={30} />
                  <span>+</span>
                </div>
                <h3>
                  A little planning.
                  <br />A little peace of mind.
                </h3>
                <p>
                  Your next appointment will
                  <br />
                  feel right at home here.
                </p>
                <Link to="/care" className="button outline full">
                  Find an appointment <ArrowRight size={16} />
                </Link>
              </>
            )}
          </section>
          <section className="wellness-card">
            <div className="wellness-top">
              <span className="eyebrow">SMALL STEPS, EVERY DAY</span>
              <HeartPulse size={21} />
            </div>
            <h3>
              Make time
              <br />
              for yourself.
            </h3>
            <p>
              Write down your questions before a visit, so you leave with the
              answers you need.
            </p>
            <a
              href="https://www.who.int/health-topics/primary-health-care"
              target="_blank"
              rel="noreferrer"
            >
              Explore primary care <ArrowUpRight size={16} />
            </a>
          </section>
        </aside>
      </div>
      {booking && (
        <Booking facility={booking} onClose={() => setBooking(null)} />
      )}
    </>
  );
}
export function FindCare() {
  const { facilities, location, toast, config } = useApp();
  const [query, setQuery] = useState(""),
    [service, setService] = useState("All services"),
    [accepting, setAccepting] = useState(false),
    [booking, setBooking] = useState<Facility | null>(null),
    [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null),
    [locating, setLocating] = useState(false);
  function distance(f: Facility) {
    return coords ? distanceKm(coords, f) : 0;
  }
  const results = useMemo(
    () =>
      facilities
        .filter(
          (f) =>
            f.kind === "hospital" &&
            (coords !== null || matchesLocation(f, location)) &&
            (!accepting || f.accepting) &&
            (service === "All services" || f.services.includes(service)) &&
            `${f.name} ${f.city} ${f.services.join(" ")}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) => (coords ? distance(a) - distance(b) : 0)),
    [facilities, location, accepting, service, query, coords],
  );
  function locate() {
    if (!navigator.geolocation) {
      toast("Location is unavailable. Choose your city at the top.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
        toast(
          "Results sorted by approximate distance to your device.",
        );
      },
      () => {
        setLocating(false);
        toast("Could not access location. You can still choose a city above.");
      },
      { timeout: 10000 },
    );
  }
  return (
    <>
      <PageTitle
        eyebrow="FIND YOUR PEOPLE"
        title="Good care starts with a connection."
        description="Browse AERIX-listed partners and explore nearby public hospital map results across Lagos State."
      />
      <div className="search-toolbar">
        <label className="search-field">
          <Search size={19} />
          <input
            aria-label="Search hospitals"
            placeholder="Search a hospital, city, or service…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button className="button outline" onClick={locate} disabled={locating}>
          <LocateFixed size={17} />
          {locating ? "Finding you…" : coords ? "Update location" : "Use my location"}
        </button>
        {coords && <button className="button outline" onClick={() => setCoords(null)}>Clear location</button>}
      </div>
      <div className="filters">
        <div className="filter-chips">
          {[
            "All services",
            "General care",
            "Paediatrics",
            "Women’s health",
            "Health screening",
          ].map((s) => (
            <button
              key={s}
              className={service === s ? "selected" : ""}
              onClick={() => setService(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={accepting}
            onChange={(e) => setAccepting(e.target.checked)}
          />
          Accepting requests
        </label>
      </div>
      <div className="results-heading">
        <span>
          <strong>{results.length}</strong>{" "}
          {results.length === 1 ? "provider" : "providers"} {coords ? "sorted near you" : "in your selected area"}
        </span>
        <span>
          {coords
            ? "Nearest first · approximate distances"
            : "Provider directory"}
        </span>
      </div>
      {results.length ? (
        <div className="facility-grid directory">
          {results.map((f) => (
            <FacilityCard
              key={f._id}
              facility={f}
              onBook={setBooking}
              distance={coords ? distance(f) : undefined}
            />
          ))}
        </div>
      ) : (
        <Empty title="No verified AERIX hospital partners here yet">
          This does not mean there are no hospitals nearby. Search the public map listings below, then contact a hospital directly to confirm its services and availability.
          <button
            className="button outline"
            onClick={() => {
              setQuery("");
              setService("All services");
              setAccepting(false);
            }}
          >
            Clear filters
          </button>
        </Empty>
      )}
      <NearbyPlaces kind="hospital" coords={coords} autoSearch />
      {booking && (
        <Booking facility={booking} onClose={() => setBooking(null)} />
      )}
    </>
  );
}

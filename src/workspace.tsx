import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  PackageCheck,
  Users,
  Building2,
  RefreshCw,
  Check,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "./context";
import { api, prettyDate } from "./api";
import { Empty, Loading, Notice, PageTitle, Status } from "./components";
import type { Appointment, Order, Application, Doctor, AvailableTime } from "./types";
type Admin = {
  applications: Application[];
  users: { _id: string; name: string; email: string; role: string; emailVerified: boolean; createdAt: string; verifiedAt: string | null }[];
  feedback: { _id: string; category: string; message: string; createdAt: string }[];
  audit: {
    _id: string;
    action: string;
    actorId: string;
    resource: string;
    createdAt: string;
  }[];
  counts: {
    users: number;
    pendingUsers: number;
    facilities: number;
    appointments: number;
    orders: number;
  };
};
export function Workspace() {
  const { user, facilities, products, refresh, toast, config } = useApp();
  const [appointments, setAppointments] = useState<Appointment[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [doctors, setDoctors] = useState<Doctor[]>([]),
    [availableTimes, setAvailableTimes] = useState<AvailableTime[]>([]),
    [admin, setAdmin] = useState<Admin | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [activationId, setActivationId] = useState("");
  const facility = facilities.find((f) => f._id === user?.facilityId);
  async function load() {
    if (!user || user.role === "patient") {
      setLoading(false);
      return;
    }
    try {
      if (user.role === "clinic") {
        const [appointments, doctors, availableTimes] = await Promise.all([api<Appointment[]>("/appointments"), api<Doctor[]>("/staff/doctors"), api<AvailableTime[]>("/staff/availability")]);
        setAppointments(appointments);
        setDoctors(doctors);
        setAvailableTimes(availableTimes);
      }
      if (user.role === "pharmacy") setOrders(await api("/orders"));
      if (user.role === "admin") setAdmin(await api("/admin"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    if (!user || user.role === "patient") return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 45000);
    return () => window.clearInterval(timer);
  }, [user]);
  async function update(path: string, body: unknown) {
    setBusy(path);
    try {
      await api(path, { method: "PATCH", body });
      await Promise.all([load(), refresh()]);
      toast("Your changes are saved.");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function activate(event: React.FormEvent<HTMLFormElement>, application: Application) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const path = `/applications/${application._id}/activate`;
    setBusy(path);
    try {
      await api(path, { method: "POST", body: {
        address: String(form.get("address") || ""),
        phone: String(form.get("phone") || ""),
        hours: String(form.get("hours") || ""),
        description: String(form.get("description") || ""),
        lat: Number(form.get("lat")), lng: Number(form.get("lng")),
        services: application.kind === "hospital" ? String(form.get("services") || "").split(",").map((x) => x.trim()).filter(Boolean) : ["Pharmacy collection"],
        verificationNote: String(form.get("verificationNote") || ""),
        licenceChecked: form.get("licenceChecked") === "on",
        contactConfirmed: form.get("contactConfirmed") === "on",
      } });
      setActivationId("");
      await Promise.all([load(), refresh()]);
      toast("Partner account created. Requests stay paused until staff enable them.");
    } catch (e) {
      toast((e as Error).message);
    } finally { setBusy(""); }
  }
  async function addProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy("new-product");
    try {
      await api("/products", { method: "POST", body: {
        name: String(form.get("name") || ""), category: String(form.get("category") || ""),
        description: String(form.get("description") || ""), price: Number(form.get("price")),
        stock: Number(form.get("stock")), icon: String(form.get("icon") || "kit"),
      } });
      formElement.reset();
      await refresh();
      toast("Product listed. Keep the quantity current and confirm each collection before a patient travels.");
    } catch (e) { toast((e as Error).message); }
    finally { setBusy(""); }
  }
  async function addDoctor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy("new-doctor");
    try {
      await api("/doctors", { method: "POST", body: {
        name: String(form.get("name") || ""), specialty: String(form.get("specialty") || ""),
        registration: String(form.get("registration") || ""), consentConfirmed: form.get("consentConfirmed") === "on",
      } });
      formElement.reset();
      await load();
      toast("Clinician added. Keep the roster current; remove anyone no longer available.");
    } catch (e) { toast((e as Error).message); }
    finally { setBusy(""); }
  }
  async function addAvailableTime(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("new-availability");
    try {
      await api("/availability", { method: "POST", body: { doctorId: String(form.get("doctorId")), date: String(form.get("date")), time: String(form.get("time")) } });
      await load();
      toast("Clinician time published. Patients may request it while requests are enabled.");
    } catch (e) { toast((e as Error).message); }
    finally { setBusy(""); }
  }
  async function removeAvailableTime(slotId: string) {
    setBusy(slotId);
    try {
      await api(`/availability/${slotId}`, { method: "DELETE" });
      await load();
      toast("Published time removed.");
    } catch (e) { toast((e as Error).message); }
    finally { setBusy(""); }
  }
  if (!user || user.role === "patient")
    return (
      <Empty
        title="A workspace for care teams"
        action={
          <Link className="button primary" to="/account">
            Sign in
          </Link>
        }
      >
        Sign in with a hospital, pharmacy, or administrator account.
      </Empty>
    );
  return (
    <>
      <PageTitle
        eyebrow="BEHIND EVERY CONNECTION, A CARE TEAM"
        title={
          user.role === "admin"
            ? "AERIX control centre."
            : user.role === "clinic"
              ? "A good day to make care easier."
              : "Care essentials, ready to connect."
        }
        description={
          facility?.name ||
          "Review partner applications and follow platform activity."
        }
        action={
          <button className="button outline" disabled={!!busy} onClick={load}>
            <RefreshCw size={16} />
            Refresh
          </button>
        }
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <Loading />
      ) : user.role === "admin" && admin ? (
        <>
          <p className="muted">
            {admin.counts.pendingUsers} accounts awaiting email verification.
            Sample accounts are excluded from verified users.
          </p>
          <div className="summary-grid four">
            {[
              {
                label: "Verified users",
                value: admin.counts.users,
                icon: Users,
              },
              {
                label: "Facilities",
                value: admin.counts.facilities,
                icon: Building2,
              },
              {
                label: "Appointments",
                value: admin.counts.appointments,
                icon: CalendarDays,
              },
              {
                label: "Collection requests",
                value: admin.counts.orders,
                icon: PackageCheck,
              },
            ].map((x) => (
              <div className="summary-card" key={x.label}>
                <x.icon />
                <strong>{x.value}</strong>
                <span>{x.label}</span>
              </div>
            ))}
          </div>
          <section className="panel workspace-section">
            <h2>Recent account registrations</h2>
            <p className="muted">Account details are visible to administrators only. Unverified accounts cannot use AERIX services.</p>
            {admin.users.length ? (
              <div className="admin-user-list">
                {admin.users.map((account) => (
                  <article className="admin-user-row" key={account._id}>
                    <span className="profile-avatar">{account.name.charAt(0).toUpperCase()}</span>
                    <div><strong>{account.name}</strong><small>{account.email}</small></div>
                    <Status value={account.emailVerified ? "verified" : "pending verification"} />
                    <time dateTime={account.createdAt}>{new Date(account.createdAt).toLocaleString()}</time>
                  </article>
                ))}
              </div>
            ) : <Empty title="No personal registrations yet">New accounts appear after a visitor signs up. Sample demo accounts are excluded.</Empty>}
          </section>
          <section className="panel workspace-section">
            <h2>Provider applications</h2>
            <Notice>
              Review official registration and call the facility before activation. An approved partner starts with requests paused; staff must sign in and enable them after checking their details.
            </Notice>
            {admin.applications.length ? (
              admin.applications.map((a) => (
                <article key={a._id} className="admin-application">
                  <div>
                    <Status value={a.status} />
                    <h3>{a.name}</h3>
                    <p>
                      {a.kind} · {a.city}, {a.region ? `${a.region}, ` : ""}{a.country}
                    </p>
                    <small>
                      {a.email} · Registration: {a.registration}
                    </small>
                  </div>
                  {a.status === "pending" && (
                    <div className="actions">
                      <button
                        className="button primary small-button"
                        disabled={!!busy}
                        onClick={() =>
                          update(`/applications/${a._id}`, {
                            status: "reviewing",
                          })
                        }
                      >
                        Mark for review
                      </button>
                      <button
                        className="button outline small-button"
                        disabled={!!busy}
                        onClick={() =>
                          update(`/applications/${a._id}`, {
                            status: "declined",
                          })
                        }
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {a.status === "reviewing" && <div className="actions"><button className="button outline small-button" disabled={!!busy} onClick={() => setActivationId(activationId === a._id ? "" : a._id)}>{activationId === a._id ? "Close verification" : "Verify and activate"}</button></div>}
                  {activationId === a._id && a.status === "reviewing" && <form className="form-stack" onSubmit={(event) => activate(event, a)}>
                    <p className="muted">Facilities in Lagos State can be activated. Check the <a href="https://hfr.fmohconnect.gov.ng/" target="_blank" rel="noopener noreferrer">national facility registry</a> and <a href="https://hefamaa.lagosstate.gov.ng/" target="_blank" rel="noopener noreferrer">HEFAMAA</a> for hospitals, or <a href="https://pcn.gov.ng/" target="_blank" rel="noopener noreferrer">PCN</a> for pharmacies. Call the facility independently; registration alone does not prove this applicant represents it.</p>
                    <label>Verified address<input name="address" required maxLength={120}/></label>
                    <label>Working facility phone<input name="phone" type="tel" required pattern="[+0-9 ()-]{7,25}"/></label>
                    <label>Confirmed opening hours<input name="hours" required maxLength={120} placeholder="Mon–Fri · 09:00–17:00"/></label>
                    <label>Public description<textarea name="description" required minLength={20} maxLength={500} rows={3}/></label>
                    <div className="form-two"><label>Map latitude<input name="lat" type="number" step="any" min="-90" max="90" required/></label><label>Map longitude<input name="lng" type="number" step="any" min="-180" max="180" required/></label></div>
                    {a.kind === "hospital" && <label>Confirmed services, separated by commas<input name="services" required placeholder="General care, Family medicine"/></label>}
                    <label>Internal verification note<textarea name="verificationNote" required minLength={20} maxLength={500} rows={3} placeholder="Which register was checked, who answered the facility phone, and when"/></label>
                    <label className="checkbox-label"><input name="licenceChecked" type="checkbox" required/> I checked the appropriate official registration.</label>
                    <label className="checkbox-label"><input name="contactConfirmed" type="checkbox" required/> I contacted the facility independently and confirmed this applicant may represent it.</label>
                    <button className="button primary" disabled={!!busy}>Activate partner with requests paused</button>
                  </form>}
                </article>
              ))
            ) : (
              <Empty title="No applications yet">
                Provider applications submitted from About AERIX will appear
                here.
              </Empty>
            )}
          </section>
          <section className="panel workspace-section">
            <h2>Product feedback</h2>
            <p className="muted">Suggestions submitted from the public AERIX welcome page. No account or medical information is requested.</p>
            {admin.feedback.length ? admin.feedback.map((item) => <article className="admin-application" key={item._id}><div><Status value={item.category}/><p className="admin-feedback-message">{item.message}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div></article>) : <Empty title="No feedback yet">New suggestions will appear here.</Empty>}
          </section>
          <section className="panel workspace-section">
            <h2>Recent audit activity</h2>
            <p className="muted">
              Action metadata only. No chat messages or clinical notes.
            </p>
            <div className="audit-list">
              {admin.audit.length ? (
                admin.audit.map((a) => (
                  <div key={a._id}>
                    <ShieldCheck size={16} />
                    <strong>{a.action.replaceAll(".", " / ")}</strong>
                    <span>{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                ))
              ) : (
                <p className="muted">
                  Activity will appear as requests are made and updated.
                </p>
              )}
            </div>
          </section>
        </>
      ) : (
        <>
          {facility && (
            <section className="availability-panel">
              <div>
                <span className="eyebrow">YOUR FACILITY</span>
                <h2>
                  {facility.accepting
                    ? "You’re accepting new requests."
                    : "New requests are paused."}
                </h2>
                <p>
                  Last updated {new Date(facility.updatedAt).toLocaleString()}.
                  This does not indicate emergency capacity.
                </p>
              </div>
              <button
                className={`button ${facility.accepting ? "outline" : "primary"}`}
                disabled={!!busy}
                onClick={() =>
                  update(`/facilities/${facility._id}`, {
                    accepting: !facility.accepting,
                  })
                }
              >
                {facility.accepting ? "Pause requests" : "Accept requests"}
              </button>
            </section>
          )}
          {user.role === "clinic" && <section className="panel workspace-section">
            <h2>Clinicians patients can request</h2>
            <Notice>Only list clinicians who work with your facility and have agreed to appear here. A named request is not a confirmed shift or appointment; your team must confirm it.</Notice>
            <form className="form-stack" onSubmit={addDoctor}>
              <div className="form-two"><label>Clinician name<input name="name" required maxLength={120}/></label><label>Specialty<input name="specialty" required maxLength={120} placeholder="General practice"/></label></div>
              <label>Professional registration reference (kept internal)<input name="registration" required maxLength={120}/></label>
              <label className="checkbox-label"><input name="consentConfirmed" type="checkbox" required/> I confirm this clinician agreed to be listed and is part of our care team.</label>
              <button className="button primary" disabled={!!busy}>Add clinician</button>
            </form>
            {doctors.map((doctor) => <div className="stock-row" key={doctor._id}><div><strong>{doctor.name}</strong><small>{doctor.specialty} · {doctor.active ? "Visible to patients" : "Hidden"}</small></div><button className="button outline small-button" disabled={!!busy} onClick={() => update(`/doctors/${doctor._id}`, { active: !doctor.active })}>{doctor.active ? "Hide" : "Show"}</button></div>)}
            <h3>Publish a time the clinician can receive requests</h3>
            <p className="muted">These times are staff-reported. Confirm every request before the patient travels.</p>
            <form className="form-stack" onSubmit={addAvailableTime}>
              <label>Clinician<select name="doctorId" required><option value="">Choose clinician</option>{doctors.filter((doctor) => doctor.active).map((doctor) => <option value={doctor._id} key={doctor._id}>{doctor.name} · {doctor.specialty}</option>)}</select></label>
              <div className="form-two"><label>Date<input name="date" type="date" min={new Date(Date.now() + 86400000).toLocaleDateString("en-CA")} required/></label><label>Time<select name="time">{config.slots.map((time) => <option key={time}>{time}</option>)}</select></label></div>
              <button className="button primary" disabled={!!busy || !doctors.some((doctor) => doctor.active)}>Publish time</button>
            </form>
            {availableTimes.filter((slot) => slot.date >= new Date().toLocaleDateString("en-CA")).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map((slot) => <div className="stock-row" key={slot._id}><div><strong>{prettyDate(slot.date)} · {slot.time}</strong><small>{doctors.find((doctor) => doctor._id === slot.doctorId)?.name || "Clinician unavailable"}</small></div><button className="button outline small-button" disabled={!!busy} onClick={() => removeAvailableTime(slot._id)}>Remove</button></div>)}
          </section>}
          <div className="section-heading">
            <h2>
              {user.role === "clinic"
                ? "Appointment requests"
                : "Collection requests"}
            </h2>
            <span>
              {user.role === "clinic" ? appointments.length : orders.length}{" "}
              total
            </span>
          </div>
          {user.role === "clinic" ? (
            appointments.length ? (
              <div className="record-list">
                {appointments.map((a) => (
                  <article className="record-card" key={a._id}>
                    <span className="feature-icon violet">
                      <CalendarDays />
                    </span>
                    <div className="record-main">
                      <Status value={a.status} />
                      <h3>{a.patientName}</h3>
                      <p>
                        {a.service}{a.doctorName ? ` · ${a.doctorName}` : ""} · {prettyDate(a.date)} · {a.time}
                      </p>
                      {a.reason && <p className="muted"><strong>Patient note:</strong> {a.reason}</p>}
                      <small className="muted">{a.timeZone}</small>
                    </div>
                    <div className="actions">
                      {a.status === "requested" && (
                        <button
                          className="button primary small-button"
                          disabled={!!busy}
                          onClick={() =>
                            update(`/appointments/${a._id}`, {
                              status: "confirmed",
                            })
                          }
                        >
                          <Check size={15} />
                          Confirm
                        </button>
                      )}
                      {a.status === "confirmed" && (
                        <button
                          className="button primary small-button"
                          disabled={!!busy}
                          onClick={() =>
                            update(`/appointments/${a._id}`, {
                              status: "completed",
                            })
                          }
                        >
                          Mark completed
                        </button>
                      )}
                      {["requested", "confirmed"].includes(a.status) && (
                        <button
                          className="button outline small-button"
                          disabled={!!busy}
                          onClick={() =>
                            update(`/appointments/${a._id}`, {
                              status: "cancelled",
                            })
                          }
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty title="Your next patient connection starts here">
                Requests for your hospital will appear here. In demo mode, book
                with AERIX Lagos Care Centre using the patient account.
              </Empty>
            )
          ) : (
            <>
              {orders.length ? (
                <div className="record-list">
                  {orders.map((o) => (
                    <article className="record-card" key={o._id}>
                      <span className="feature-icon green">
                        <PackageCheck />
                      </span>
                      <div className="record-main">
                        <Status value={o.status} />
                        <h3>
                          {o.productName} × {o.quantity}
                        </h3>
                        <p>{o.patientName}</p>
                        <span className="muted">{o.fulfillmentMethod === "delivery" ? `Delivery requested${o.deliveryArea ? ` · ${o.deliveryArea}` : ""}; confirm delivery and fee with patient.` : "Self pickup."}</span>
                      </div>
                      <div className="actions">
                        {o.status === "requested" && (
                          <button
                            className="button primary small-button"
                            disabled={!!busy}
                            onClick={() =>
                              update(`/orders/${o._id}`, { status: "ready" })
                            }
                          >
                            Mark ready
                          </button>
                        )}
                        {o.status === "ready" && (
                          <button
                            className="button primary small-button"
                            disabled={!!busy}
                            onClick={() =>
                              update(`/orders/${o._id}`, {
                                status: "collected",
                              })
                            }
                          >
                            Mark collected
                          </button>
                        )}
                        {["requested", "ready"].includes(o.status) && (
                          <button
                            className="button outline small-button"
                            disabled={!!busy}
                            onClick={() =>
                              update(`/orders/${o._id}`, {
                                status: "cancelled",
                              })
                            }
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty title="No collection requests yet">
                  Requests for Leaf Pharmacy in Lagos will appear here.
                </Empty>
              )}
              <section className="panel workspace-section">
                <h2>Listed stock</h2>
                <Notice>
                  Listed quantities are informational. Check and set aside
                  physical stock before marking a collection ready; the platform
                  does not automatically allocate inventory.
                </Notice>
                {!facility?.sample && <form className="form-stack" onSubmit={addProduct}>
                  <h3>Add a non-prescription product</h3>
                  <div className="form-two"><label>Product name<input name="name" required maxLength={120}/></label><label>Category<select name="category"><option>First aid</option><option>Devices</option></select></label></div>
                  <label>Plain description<textarea name="description" required minLength={10} maxLength={500} rows={2}/></label>
                  <div className="form-two"><label>Price in naira<input name="price" type="number" min="1" max="10000000" step="1" required/></label><label>Quantity currently listed<input name="stock" type="number" min="0" max="10000" step="1" required/></label></div>
                  <label>Product picture style<select name="icon"><option value="kit">First aid kit</option><option value="bandage">Dressings</option><option value="thermometer">Device</option><option value="pill">General item</option></select></label>
                  <button className="button primary" disabled={!!busy}>Add product listing</button>
                </form>}
                {products
                  .filter(
                    (p) => p.pharmacyId === user.facilityId && !p.prescription,
                  )
                  .map((p) => (
                    <form
                      className="stock-row"
                      key={`${p._id}-${p.stock}`}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        update(`/products/${p._id}`, {
                          stock: Number(f.get("stock")),
                        });
                      }}
                    >
                      <div>
                        <strong>{p.name}</strong>
                        <small>Current listing: {p.stock}</small>
                      </div>
                      <input
                        aria-label={`Stock for ${p.name}`}
                        type="number"
                        name="stock"
                        defaultValue={p.stock}
                        min="0"
                        max="10000"
                        required
                      />
                      <button
                        className="button outline small-button"
                        disabled={!!busy}
                      >
                        Save stock
                      </button>
                    </form>
                  ))}
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}

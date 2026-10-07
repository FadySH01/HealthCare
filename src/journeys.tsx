import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  PackageCheck,
  Search,
  ShieldCheck,
  Plus,
  Minus,
  ShoppingBag,
  Pill,
  Thermometer,
  BriefcaseMedical,
  Bandage,
  LocateFixed,
  MapPin,
} from "lucide-react";
import { useApp } from "./context";
import { api, money, prettyDate } from "./api";
import { Empty, FacilityCard, Loading, Modal, Notice, PageTitle, Status } from "./components";
import { Booking, distanceKm, matchesLocation } from "./care";
import type { Appointment, Facility, Order, Product } from "./types";
import { NearbyPlaces } from "./nearby";
export function Appointments() {
  const { user, toast, facilities, location } = useApp();
  const [appointments, setAppointments] = useState<Appointment[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [tab, setTab] = useState("Appointments"),
    [busy, setBusy] = useState(""),
    [confirm, setConfirm] = useState<{ kind: string; id: string } | null>(null),
    [booking, setBooking] = useState<Facility | null>(null);
  const partnerClinics = facilities.filter((f) => f.kind === "hospital" && matchesLocation(f, location));
  async function load() {
    if (!user || user.role !== "patient") {
      setLoading(false);
      return;
    }
    try {
      const [a, o] = await Promise.all([
        api<Appointment[]>("/appointments"),
        api<Order[]>("/orders"),
      ]);
      setAppointments(a);
      setOrders(o);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    if (user?.role !== "patient") return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 45000);
    return () => window.clearInterval(timer);
  }, [user]);
  async function cancel() {
    if (!confirm) return;
    setBusy(confirm.id);
    try {
      await api(`/${confirm.kind}/${confirm.id}`, {
        method: "PATCH",
        body: { status: "cancelled" },
      });
      toast("Your request has been cancelled.");
      setConfirm(null);
      await load();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="A LITTLE MORE ORGANISED"
        title="Your care, all in one place."
        description="Keep track of appointment and pharmacy collection requests."
        action={
          user?.role === "patient" && (
            <button className="button primary" onClick={() => { setTab("Appointments"); window.setTimeout(() => document.getElementById("appointment-finder")?.scrollIntoView({ behavior: "smooth" }), 0); }}>
              <Plus size={17} />
              Find a hospital
            </button>
          )
        }
      />
      {!user ? (
        <Empty
          title="Your health space is waiting"
          action={
            <Link to="/account" className="button primary">
              Sign in to continue <ArrowRight size={17} />
            </Link>
          }
        >
          Sign in to see your appointments and collection requests.
        </Empty>
      ) : user.role !== "patient" ? (
        <Empty
          title="You’re using a staff account"
          action={
            <Link to="/workspace" className="button primary">
              Open workspace
            </Link>
          }
        >
          Manage incoming requests in your provider workspace.
        </Empty>
      ) : (
        <>
          <div className="summary-grid">
            <div className="summary-card">
              <CalendarDays />
              <strong>
                {
                  appointments.filter((a) =>
                    ["requested", "confirmed"].includes(a.status),
                  ).length
                }
              </strong>
              <span>Upcoming requests</span>
            </div>
            <div className="summary-card">
              <PackageCheck />
              <strong>
                {
                  orders.filter((o) =>
                    ["requested", "ready"].includes(o.status),
                  ).length
                }
              </strong>
              <span>Pharmacy collections</span>
            </div>
            <div className="summary-card">
              <ShieldCheck />
              <strong>
                {appointments.filter((a) => a.status === "completed").length}
              </strong>
              <span>Completed visits</span>
            </div>
          </div>
          <div className="tab-bar">
            {["Appointments", "Pharmacy collections"].map((t) => (
              <button
                key={t}
                className={t === tab ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
              <button onClick={load}>Try again</button>
            </div>
          )}
          {loading ? (
            <Loading />
          ) : tab === "Appointments" ? (
            appointments.length ? (
              <div className="record-list">
                {[...appointments]
                  .sort((a, b) =>
                    (b.date + b.time).localeCompare(a.date + a.time),
                  )
                  .map((a) => (
                    <article key={a._id} className="record-card">
                      <div className="record-date">
                        <strong>
                          {new Date(`${a.date}T12:00:00`).getDate()}
                        </strong>
                        <span>
                          {new Date(`${a.date}T12:00:00`).toLocaleString("en", {
                            month: "short",
                          })}
                        </span>
                      </div>
                      <div className="record-main">
                        <Status value={a.status} />
                        <h3>{a.facilityName}</h3>
                        <p>{a.service}{a.doctorName ? ` · Requested clinician: ${a.doctorName}` : ""}</p>
                        {a.reason && <p className="muted">Your note: {a.reason}</p>}
                        <div className="record-meta">
                          <span>
                            <CalendarDays size={14} />
                            {prettyDate(a.date)}
                          </span>
                          <span>
                            <Clock size={14} />
                            {a.time} · {a.timeZone}
                          </span>
                        </div>
                      </div>
                      {["requested", "confirmed"].includes(a.status) && (
                        <button
                          className="button outline small-button"
                          onClick={() =>
                            setConfirm({ kind: "appointments", id: a._id })
                          }
                        >
                          Cancel request
                        </button>
                      )}
                    </article>
                  ))}
              </div>
            ) : (
              <div className="care-start-panel"><h2>No appointment requests yet</h2><p>Online requests open with hospitals after they join and publish availability. Explore mapped hospitals below and contact them directly; AERIX cannot confirm a schedule.</p></div>
            )
          ) : orders.length ? (
            <div className="record-list">
              {orders.map((o) => (
                <article className="record-card" key={o._id}>
                  <span className="feature-icon green">
                    <ShoppingBag />
                  </span>
                  <div className="record-main">
                    <Status value={o.status} />
                    <h3>{o.productName}</h3>
                    <p>
                      {o.pharmacyName} · Quantity {o.quantity} · {o.fulfillmentMethod === "delivery" ? `Delivery requested${o.deliveryArea ? ` to ${o.deliveryArea}` : ""}` : "Self pickup"}
                    </p>
                    <span className="muted">
                      {money(o.total, o.currency)} · {o.fulfillmentMethod === "delivery" ? "Confirm payment, delivery and fee with the pharmacy" : "Pay at collection after confirmation"}
                    </span>
                  </div>
                  {["requested", "ready"].includes(o.status) && (
                    <button
                      className="button outline small-button"
                      onClick={() => setConfirm({ kind: "orders", id: o._id })}
                    >
                      Cancel request
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="No collection requests yet"
              action={
                <Link to="/pharmacy" className="button primary">
                  Explore pharmacy
                </Link>
              }
            >
              Your pharmacy requests and their status will appear here.
            </Empty>
          )}
          {tab === "Appointments" && <div id="appointment-finder" className="care-start-panel">
            <h2>Talk with the AERIX voice guide</h2>
            <p>Start a short, interactive online visit preview. The demo greets you by name, listens to one turn at a time, and answers aloud here in Appointments. It is an AI guide, not a live doctor, and cannot diagnose or prescribe.</p>
            <Link className="button primary" to="/online-visit-demo"><Clock size={16}/> Start online voice session <ArrowRight size={16}/></Link>
            <h2>Request a visit with an AERIX hospital</h2>
            <p>Choose a participating hospital and a clinician it has listed. Your request is sent to its staff and becomes an appointment only after the hospital confirms.</p>
            {partnerClinics.length ? <div className="facility-grid directory">{partnerClinics.map((facility) => <FacilityCard key={facility._id} facility={facility} onBook={setBooking}/>)}</div> : <Notice>No hospitals have joined the AERIX network in this area yet. Search mapped hospitals below, or invite a hospital to apply to join.</Notice>}
            <NearbyPlaces kind="hospital" coords={null} autoSearch />
          </div>}
        </>
      )}
      {confirm && (
        <Modal title="Cancel this request?" onClose={() => setConfirm(null)}>
          <p className="modal-description">
            The provider will see that you have cancelled. You can make a new
            request whenever you are ready.
          </p>
          <div className="modal-actions">
            <button className="button outline" onClick={() => setConfirm(null)}>
              Keep request
            </button>
            <button
              className="button danger"
              disabled={!!busy}
              onClick={cancel}
            >
              {busy ? "Cancelling…" : "Cancel request"}
            </button>
          </div>
        </Modal>
      )}
      {booking && <Booking facility={booking} onClose={() => setBooking(null)}/>}
    </>
  );
}
const icons: { [key: string]: typeof Pill } = {
  kit: BriefcaseMedical,
  thermometer: Thermometer,
  bandage: Bandage,
  pill: Pill,
};
export function Pharmacy() {
  const { products, facilities, location, user, requireLogin, toast, config } =
    useApp();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All essentials"),
    [selected, setSelected] = useState<Product | null>(null),
    [quantity, setQuantity] = useState(1),
    [fulfillmentMethod, setFulfillmentMethod] = useState<"pickup" | "delivery">("pickup"),
    [deliveryArea, setDeliveryArea] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null),
    [locating, setLocating] = useState(false),
    [inStock, setInStock] = useState(true);
  const availableIds = facilities
    .filter((f) => f.kind === "pharmacy" && (coords !== null || matchesLocation(f, location)))
    .map((f) => f._id);
  const results = products.filter(
    (p) =>
      availableIds.includes(p.pharmacyId) &&
      (!inStock || p.stock > 0) &&
      `${p.name} ${p.category}`.toLowerCase().includes(query.trim().toLowerCase()) &&
      (category === "All essentials" || p.category === category),
  ).sort((a, b) => {
    if (!coords) return 0;
    const first = facilities.find((f) => f._id === a.pharmacyId);
    const second = facilities.find((f) => f._id === b.pharmacyId);
    return (first ? distanceKm(coords, first) : Infinity) - (second ? distanceKm(coords, second) : Infinity);
  });
  function locate() {
    if (!navigator.geolocation) {
      toast("Location is unavailable. Choose your city at the top.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
        toast("Listings are sorted by approximate distance. Confirm stock with the pharmacy before travelling.");
      },
      () => { setLocating(false); toast("Could not access location. You can still choose a city above."); },
      { timeout: 10000, maximumAge: 60000 },
    );
  }
  async function order() {
    if (!selected) return;
    if (!user) {
      requireLogin();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/orders", {
        method: "POST",
        body: { productId: selected._id, quantity, fulfillmentMethod, deliveryArea: fulfillmentMethod === "delivery" ? deliveryArea.trim() : "" },
      });
      setSelected(null);
      toast(fulfillmentMethod === "delivery" ? "Delivery requested. The pharmacy will confirm the service and fee." : "Collection requested. The pharmacy will confirm availability.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="EVERYDAY CARE, SIMPLIFIED"
        title="A little care, close to home."
        description="Explore pharmacy essentials and request collection from a participating pharmacy."
        action={
          <Link className="button outline" to="/appointments">
            <ShoppingBag size={17} />
            My collections
          </Link>
        }
      />
      <section className="pharmacy-banner">
        <div>
          <span className="eyebrow">YOUR CARE CUPBOARD</span>
          <h2>
            Small essentials.
            <br />A little more peace of mind.
          </h2>
          <p>Browse. Request. Collect after confirmation.</p>
        </div>
        <div className="medicine-illustration" aria-hidden="true">
          <div className="medicine-box">
            <span>AERIX</span>
            <BriefcaseMedical size={46} />
            <small>care essentials</small>
          </div>
          <div className="medicine-bottle">
            <div />
            <span>+</span>
          </div>
          <span className="medicine-star">✧</span>
        </div>
      </section>
      <div className="search-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search pharmacy essentials"
            placeholder="Search pharmacy essentials…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button className="button outline" onClick={locate} disabled={locating}><LocateFixed size={17}/>{locating ? "Finding you…" : coords ? "Update location" : "Use my location"}</button>
        {coords && <button className="button outline" onClick={() => setCoords(null)}>Clear location</button>}
      </div>
      <div className="filters">
        <div className="filter-chips">
          {["All essentials", "First aid", "Devices", "Prescription"].map(
            (c) => (
              <button
                key={c}
                className={category === c ? "selected" : ""}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ),
          )}
        </div>
        <label className="checkbox-label"><input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)}/> Listed in stock</label>
        <span className="muted">{results.length} {results.length === 1 ? "listing" : "listings"}{coords ? " · nearest first" : ""}</span>
      </div>
      {!results.length && <div className="pharmacy-discovery-first"><h2>Find a pharmacy near you</h2><p>There are no participating pharmacies listing products here yet. Search nearby map listings and call to confirm opening hours, licence and medicine availability.</p><NearbyPlaces kind="pharmacy" coords={coords} autoSearch /></div>}
      {results.length ? (
        <div className="product-grid">
          {results.map((p) => {
            const Icon = icons[p.icon] || Pill;
            const pharmacy = facilities.find((f) => f._id === p.pharmacyId);
            return (
              <article key={p._id} className="product-card">
                <div className={`product-art ${p.icon}`}>
                  {pharmacy?.sample && <span className="sample-label">Sample product</span>}
                  <div className="product-package">
                    <span className="package-brand">
                      aerix<span>+</span>
                    </span>
                    <Icon strokeWidth={1.25} size={52} />
                    <small>{p.category.toUpperCase()}</small>
                  </div>
                </div>
                <div className="product-body">
                  <span className="eyebrow">{p.category}</span>
                  <h3>{p.name}</h3>
                  <p>{pharmacy?.name}</p>
                  {coords && pharmacy && <p className="pharmacy-distance"><MapPin size={14}/>{distanceKm(coords, pharmacy).toFixed(1)} km away · approximate</p>}
                  <span className="stock-text">
                    {p.prescription
                      ? "Licensed pharmacist review required"
                      : p.stock > 0
                        ? `${p.stock} listed · confirmation required`
                        : "Currently unavailable"}
                  </span>
                  <div className="product-bottom">
                    <strong>
                      {p.prescription
                        ? "Enquiry only"
                        : money(p.price, p.currency)}
                    </strong>
                    <button
                      className="round-arrow"
                      aria-label={`View ${p.name}`}
                      onClick={() => {
                        setSelected(p);
                        setQuantity(1);
                        setFulfillmentMethod("pickup");
                        setDeliveryArea("");
                        setError("");
                      }}
                    >
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty title="No AERIX products listed yet">
          Product requests require a participating pharmacy. You can use the finder above to contact a mapped pharmacy directly; AERIX cannot check its stock or arrange collection.
        </Empty>
      )}
      {results.length > 0 && <NearbyPlaces kind="pharmacy" coords={coords} />}
      {selected && (
        <Modal title={selected.name} onClose={() => { setSelected(null); setDeliveryArea(""); setFulfillmentMethod("pickup"); }}>
          <p className="modal-description">{selected.description}</p>
          {selected.prescription ? (
            <Notice>
              Bring your prescription to a licensed pharmacist. This
              demonstration does not accept prescription uploads or dispense
              medicines.
            </Notice>
          ) : (
            <>
              <Notice>
                {config.demo ? "This is a sample request; no product will be supplied. " : "This request goes to a participating pharmacy. "}
                Payment and any delivery fee must be confirmed with the pharmacy before fulfilment.
              </Notice>
              <div className="form-stack"><label>How would you like to receive it?
                <select value={fulfillmentMethod} onChange={(event) => setFulfillmentMethod(event.target.value as "pickup" | "delivery")}>
                  <option value="pickup">I’ll pick it up myself</option>
                  <option value="delivery">Request delivery</option>
                </select>
              </label>
              {fulfillmentMethod === "delivery" && <label>Neighbourhood or delivery area
                <input value={deliveryArea} onChange={(event) => setDeliveryArea(event.target.value)} maxLength={100} placeholder="e.g. Yaba, Lagos" required />
                <small>The pharmacy must confirm delivery availability and cost. Do not enter a full home address here.</small>
              </label>}</div>
              <div className="quantity-row">
                <span>Quantity</span>
                <div>
                  <button
                    aria-label="Decrease quantity"
                    className="icon-button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus size={17} />
                  </button>
                  <strong>{quantity}</strong>
                  <button
                    aria-label="Increase quantity"
                    className="icon-button"
                    onClick={() => setQuantity(Math.min(3, quantity + 1))}
                  >
                    <Plus size={17} />
                  </button>
                </div>
              </div>
              <div className="price-row">
                <span>Estimated total</span>
                <strong>
                  {money(selected.price * quantity, selected.currency)}
                </strong>
              </div>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <button
                className="button primary full"
                disabled={
                  busy ||
                  selected.stock < quantity ||
                  (fulfillmentMethod === "delivery" && deliveryArea.trim().length < 2) ||
                  (!!user && user.role !== "patient")
                }
                onClick={order}
              >
                {busy
                  ? "Sending…"
                  : user
                    ? fulfillmentMethod === "delivery" ? "Request delivery" : "Request collection"
                    : "Sign in to continue"}
                <ArrowRight size={17} />
              </button>
              {user && user.role !== "patient" && (
                <small>Use a patient account to request a collection.</small>
              )}
              <small className="muted">
                Wait for the pharmacy’s confirmation before travelling.
              </small>
              {user && config.emailDelivery && <small className="muted">AERIX emails its team a request alert with the pharmacy, item and quantity. It does not include your name or health details.</small>}
            </>
          )}
        </Modal>
      )}
    </>
  );
}

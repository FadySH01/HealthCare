import { useCallback, useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  Navigate,
} from "react-router-dom";
import {
  LayoutGrid,
  Search,
  CalendarDays,
  Pill,
  Sparkles,
  ShieldCheck,
  HeartHandshake,
  ArrowUpRight,
  MapPin,
  ChevronDown,
  Menu,
  X,
  LogOut,
  UserRound,
  SlidersHorizontal,
  Siren,
} from "lucide-react";
import { api, setCsrf } from "./api";
import { Context } from "./context";
import { Brand, Loading } from "./components";
import type { Config, Facility, Product, User } from "./types";
import {
  Home,
  FindCare,
  Appointments,
  Pharmacy,
  Assistant,
  Emergency,
  Account,
  About,
  NotFound,
} from "./pages";
import { Workspace } from "./workspace";
import { OnlineVisitDemo } from "./online-visit";
import { Landing } from "./landing";
import { ProviderJoin } from "./account";
const nav = [
  ["/", "Overview", LayoutGrid],
  ["/emergency", "Emergency plan", Siren],
  ["/care", "Find care", Search],
  ["/appointments", "Appointments", CalendarDays],
  ["/pharmacy", "Pharmacy", Pill],
  ["/assistant", "Health guide", Sparkles],
] as const;
const adminNav = [
  ["/workspace", "Control centre", SlidersHorizontal],
  ["/partners/join", "Provider registration", HeartHandshake],
  ["/privacy", "Security & privacy", ShieldCheck],
] as const;
export default function App() {
  const [config, setConfig] = useState<Config | null>(null),
    [user, setUser] = useState<User | null>(null),
    [facilities, setFacilities] = useState<Facility[]>([]),
    [products, setProducts] = useState<Product[]>([]),
    [location, setLocationState] = useState(
      () => localStorage.getItem("aerix-location") || "lagos",
    );
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [menu, setMenu] = useState(false);
  const pathname = useLocation().pathname,
    navigate = useNavigate();
  const refresh = useCallback(async () => {
    const [c, a] = await Promise.all([
      api<Config>("/config"),
      api<{ user: User | null; csrf: string | null }>("/auth/me"),
    ]);
    setConfig(c);
    setUser(a.user);
    setCsrf(a.csrf);
  }, []);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [refresh]);
  useEffect(() => {
    if (!user) {
      setFacilities([]);
      setProducts([]);
      return;
    }
    let active = true;
    Promise.all([api<Facility[]>("/facilities"), api<Product[]>("/products")])
      .then(([f, p]) => {
        if (active) { setFacilities(f); setProducts(p); }
      })
      .catch((e) => { if (active) setMessage(e.message); });
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [pathname]);
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(""), 5000);
      return () => clearTimeout(t);
    }
  }, [message]);
  const setLocation = (v: string) => {
    setLocationState(v);
    localStorage.setItem("aerix-location", v);
  };
  if (error)
    return (
      <div className="boot-error">
        <Brand />
        <h1>We couldn’t reach AERIX.</h1>
        <p>{error}</p>
        <button
          className="button primary"
          onClick={() => {
            setError("");
            refresh().catch((e) => setError(e.message));
          }}
        >
          Try again
        </button>
      </div>
    );
  if (!config)
    return (
      <div className="boot-error">
        <Brand />
        <Loading />
      </div>
    );
  const selected = config.locations.find((l) => l.id === location),
    pageName =
      nav.find((n) => n[0] === pathname)?.[1] ||
      (pathname === "/workspace" ? "Provider workspace" : "Your AERIX");
  return (
    <Context.Provider
      value={{
        config,
        user,
        facilities,
        products,
        location,
        setLocation,
        refresh,
        setUser,
        toast: setMessage,
        requireLogin: () => navigate("/account"),
      }}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className={`app-shell ${user?.role === "admin" ? "admin-shell" : ""}`}>
        {menu && (
          <button
            className="sidebar-scrim"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          />
        )}
        <aside className={`sidebar ${menu ? "is-open" : ""}`}>
          <div className="sidebar-brand">
            <Brand />
            <button
              className="icon-button mobile-only"
              aria-label="Close navigation"
              onClick={() => setMenu(false)}
            >
              <X />
            </button>
          </div>
          <div className="brand-caption">A little closer to better care.</div>
          <div className="nav-caption">{user?.role === "admin" ? "AERIX ADMIN" : "YOUR HEALTH SPACE"}</div>
          <nav aria-label="Main navigation">
            {(user?.role === "admin" ? adminNav : user ? nav : nav.filter(([to]) => to === "/" || to === "/emergency" || to === "/assistant")).map(([to, label, Icon]) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
              >
                <Icon size={19} />
                <span>{label}</span>
              </NavLink>
            ))}
            {!user && <NavLink to="/account" className="nav-item"><UserRound size={19} /><span>Sign in / join</span></NavLink>}
          </nav>
          <div className="nav-divider" />
          <nav aria-label="Account navigation">
            {user && user.role !== "patient" && user.role !== "admin" && (
              <NavLink to="/workspace" className="nav-item">
                <SlidersHorizontal size={19} />
                Workspace
              </NavLink>
            )}
            <NavLink to="/about" className="nav-item">
              <HeartHandshake size={19} />
              About AERIX
            </NavLink>
            <NavLink to="/privacy" className="nav-item">
              <ShieldCheck size={19} />
              Privacy & safety
            </NavLink>
          </nav>
          <div className="sidebar-bottom">
            <Link to="/account" className="sidebar-user">
              <span className="avatar">
                {user ? user.name.charAt(0) : <UserRound size={18} />}
              </span>
              <span>
                <strong>{user?.name || "Your health starts here"}</strong>
                <small>
                  {user
                    ? `${user.role} account`
                    : "Sign in or create an account"}
                </small>
              </span>
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="flex">
              <button
                className="icon-button mobile-only"
                aria-label="Open navigation"
                onClick={() => setMenu(true)}
              >
                <Menu />
              </button>
              <span className="breadcrumb">
                Your health space <span>/</span> <strong>{pageName}</strong>
              </span>
            </div>
            <div className="topbar-right">
              {user && user.role !== "admin" && <label className="location-select">
                <MapPin size={16} />
                <select
                  aria-label="Choose your location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                >
                  <option value="all">Across Africa</option>
                  {config.locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.city}, {l.code}
                    </option>
                  ))}
                  <optgroup label="Browse by country">
                    {config.countries.map((c) => (
                      <option key={c} value={`country:${c}`}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <ChevronDown size={13} />
              </label>}
              {user && <div className="topbar-divider" />}
              {user ? (
                <button
                  title="Sign out"
                  aria-label="Sign out"
                  className="icon-button"
                  onClick={async () => {
                    try {
                      await api("/auth/logout", { method: "POST", body: {} });
                      setUser(null);
                      setCsrf(null);
                      setMessage("You are signed out.");
                      navigate("/");
                    } catch (e) {
                      setMessage((e as Error).message);
                    }
                  }}
                >
                  <LogOut size={18} />
                </button>
              ) : (
                <Link className="sign-in" to="/account">
                  Sign in <ArrowUpRight size={15} />
                </Link>
              )}
              <Link
                className="avatar small"
                to="/account"
                aria-label="Your account"
              >
                {user?.name.charAt(0) || "A"}
              </Link>
            </div>
          </header>
          <main id="main" tabIndex={-1}>
            <Routes>
              <Route path="/" element={user ? <Home /> : <Landing />} />
              <Route path="/care" element={user ? <FindCare /> : <Navigate to="/account" state={{ from: "/care" }} replace />} />
              <Route path="/appointments" element={user ? <Appointments /> : <Navigate to="/account" state={{ from: "/appointments" }} replace />} />
              <Route path="/online-visit-demo" element={<OnlineVisitDemo />} />
              <Route path="/pharmacy" element={user ? <Pharmacy /> : <Navigate to="/account" state={{ from: "/pharmacy" }} replace />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/emergency" element={<Emergency />} />
              <Route path="/account" element={<Account />} />
              <Route path="/partners/join" element={<ProviderJoin />} />
              <Route path="/workspace" element={user ? <Workspace /> : <Navigate to="/account" replace />} />
              <Route path="/about" element={<About />} />
              <Route path="/privacy" element={<About privacy />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <footer className="footer">
            <span>
              © {new Date().getFullYear()} AERIX. Your health, connected.
            </span>
            <div>
              {config.demo && (
                <span className="demo-indicator">
                  <i />
                  Preview · sample providers
                </span>
              )}
              <span>{selected ? selected.country : "Built for Africa"}</span>
              <Link to="/privacy">Privacy & safety</Link>
            </div>
          </footer>
        </div>
      </div>
      {message && (
        <div className="toast" role="status">
          {message}
          <button
            onClick={() => setMessage("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}

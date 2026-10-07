import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  MapPin,
  ArrowRight,
  X,
  Building2,
  Info,
  CalendarDays,
  LoaderCircle,
} from "lucide-react";
import type { Facility } from "./types";
export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="AERIX home">
      <img src="/favicon.svg" alt="" />
      <span>
        aerix<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`status ${value}`}>
      <span />
      {value.replaceAll("-", " ")}
    </span>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice">
      <Info size={17} />
      <div>{children}</div>
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <CalendarDays size={26} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={24} /> Getting things ready…
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function FacilityCard({
  facility,
  onBook,
  distance,
}: {
  facility: Facility;
  onBook: (f: Facility) => void;
  distance?: number;
}) {
  return (
    <article className="facility-card">
      <div className={`facility-art ${facility.color}`}>
        <img src={`/facility-${facility.image}.svg`} alt="" loading="lazy" />
        {facility.sample && <span className="sample-label">Illustrative provider</span>}
        <span className="art-symbol">
          <Building2 size={18} />
        </span>
      </div>
      <div className="facility-body">
        <div className="card-kicker">
          <span>
            {facility.kind === "hospital"
              ? "CLINIC & HEALTH CENTRE"
              : "COMMUNITY PHARMACY"}
          </span>
          <span className={`availability ${facility.accepting ? "yes" : ""}`}>
            <i />
            {facility.accepting ? "Accepting requests" : "Unavailable"}
          </span>
        </div>
        <h3>{facility.name}</h3>
        <p className="muted flex">
          <MapPin size={14} />
          {facility.city}, {facility.country}
          {distance !== undefined ? ` · ${distance.toFixed(1)} km` : ""}
        </p>
        <div className="tags">
          {facility.services.slice(0, 2).map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
        <div className="card-bottom">
          <span>{facility.hours}</span>
          <button
            aria-label={`View ${facility.name}`}
            className="round-arrow"
            onClick={() => onBook(facility)}
          >
            <ArrowUpRight size={19} />
          </button>
        </div>
      </div>
    </article>
  );
}
export function TextLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowRight size={16} />
    </Link>
  );
}

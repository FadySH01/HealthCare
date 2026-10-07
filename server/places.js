// Read-only OpenStreetMap discovery. These listings are not AERIX partners.
// Public community instances can be temporarily overloaded. Keep requests
// sequential, identify the app, and use the same small cached query on failover.
const endpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const cache = new Map();
const ttl = 10 * 60 * 1000;

export function normalizePlaces(elements, center, kind) {
  const seen = new Set();
  return elements.flatMap((item) => {
    const tags = item.tags || {};
    const lat = Number(item.lat ?? item.center?.lat);
    const lng = Number(item.lon ?? item.center?.lon);
    const name = String(tags.name || tags["name:en"] || "").trim().slice(0, 120);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || !["node", "way", "relation"].includes(item.type) || !Number.isSafeInteger(item.id)) return [];
    const key = `${name.toLowerCase()}-${lat.toFixed(3)}-${lng.toFixed(3)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const phone = String(tags["contact:phone"] || tags.phone || "").trim();
    const safePhone = /^\+?[0-9 ()-]{7,25}$/.test(phone) ? phone : null;
    const email = String(tags["contact:email"] || tags.email || "").trim().slice(0, 254);
    const safeEmail = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : null;
    const address = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]].filter(Boolean).map((s) => String(s).slice(0, 80)).join(" ");
    const radians = (n) => n * Math.PI / 180;
    const a = Math.sin(radians(lat - center.lat) / 2) ** 2 + Math.cos(radians(center.lat)) * Math.cos(radians(lat)) * Math.sin(radians(lng - center.lng) / 2) ** 2;
    const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return [{ id: `${item.type}-${item.id}`, name, kind: tags.amenity === "pharmacy" ? "pharmacy" : kind, lat, lng, distanceKm, address: address || null, phone: safePhone, email: safeEmail, mapUrl: `https://www.openstreetmap.org/${item.type}/${item.id}` }];
  }).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 20);
}

export async function nearbyPlaces({ kind, lat, lng }, fetcher = fetch) {
  const center = { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000 };
  const key = `${kind}:${center.lat}:${center.lng}`;
  const saved = cache.get(key);
  if (saved && saved.expires > Date.now()) return saved.value;
  // Lagos State is the relation checked in OSM (relation 3718182; generated
  // Overpass area id 3603718182). Restrict both hospital tags to this boundary
  // so a radius near the state edge does not return Ogun/other-state facilities.
  const query = kind === "hospital"
    ? `[out:json][timeout:12];area(3603718182)->.lagos;(nwr["amenity"="hospital"](around:12000,${center.lat},${center.lng})(area.lagos);nwr["healthcare"="hospital"](around:12000,${center.lat},${center.lng})(area.lagos););out center 150;`
    : `[out:json][timeout:12];nwr["amenity"="pharmacy"](around:12000,${center.lat},${center.lng});out center 150;`;
  for (const endpoint of endpoints) {
    try {
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": "AERIX-health/1.0 (community facility finder)" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(8000),
      });
      // A rate limited or transiently unavailable instance may be followed by
      // another public instance. Keep this list short and requests sequential.
      if (!response.ok) {
        continue;
      }
      const payload = await response.json();
      if (!Array.isArray(payload.elements)) continue;
      const value = { source: "OpenStreetMap", places: normalizePlaces(payload.elements, center, kind) };
      if (cache.size > 200) cache.clear();
      cache.set(key, { expires: Date.now() + ttl, value });
      return value;
    } catch {
      // Try one documented alternative for transient DNS/connection failures.
    }
  }
  throw Object.assign(new Error("Nearby map listings are temporarily unavailable. Please try again later."), { status: 503 });
}

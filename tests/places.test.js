import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../server/app.js";
import { LocalStore } from "../server/store.js";
import { nearbyPlaces, normalizePlaces } from "../server/places.js";

test("nearby map listings normalize public contact methods and reject unsafe values", () => {
  const places = normalizePlaces([
    { type: "node", id: 12, lat: 6.52, lon: 3.38, tags: { name: "Lagos Hospital", amenity: "hospital", phone: "+234 801 234 5678", email: "hello@example.org" } },
    { type: "way", id: 44, center: { lat: 6.53, lon: 3.39 }, tags: { name: "Another Clinic", phone: "javascript:alert(1)" } },
    { type: "node", id: 55, lat: 6.54, lon: 3.4, tags: {} },
  ], { lat: 6.52, lng: 3.38 }, "hospital");
  assert.equal(places.length, 2);
  assert.equal(places[0].distanceKm, 0);
  assert.equal(places[0].phone, "+234 801 234 5678");
  assert.equal(places[0].email, "hello@example.org");
  assert.equal(places[1].phone, null);
  assert.equal(places[0].mapUrl, "https://www.openstreetmap.org/node/12");
});

test("nearby search uses a public endpoint and rounds the requested location", async () => {
  let called = 0;
  const result = await nearbyPlaces({ kind: "pharmacy", lat: 6.5244, lng: 3.3792 }, async (url, options) => {
    called++;
    assert.equal(url, "https://overpass-api.de/api/interpreter");
    assert.match(options.body.get("data"), /around:12000,6\.524,3\.379/);
    assert.match(options.body.get("data"), /pharmacy/);
    return { ok: true, json: async () => ({ elements: [{ type: "node", id: 7, lat: 6.52, lon: 3.38, tags: { name: "Community Pharmacy", amenity: "pharmacy" } }] }) };
  });
  assert.equal(result.places[0].name, "Community Pharmacy");
  await nearbyPlaces({ kind: "pharmacy", lat: 6.5244, lng: 3.3792 }, async () => { called++; throw new Error("cache missed"); });
  assert.equal(called, 1);
});

test("nearby search tries one backup when the first map server is unavailable", async () => {
  const urls = [];
  const result = await nearbyPlaces({ kind: "hospital", lat: 6.401, lng: 3.201 }, async (url) => {
    urls.push(url);
    if (urls.length === 1) throw new Error("temporarily unavailable");
    return { ok: true, json: async () => ({ elements: [] }) };
  });
  assert.equal(urls.length, 2);
  assert.equal(result.source, "OpenStreetMap");
});

test("hospital map search requests hospitals and excludes clinics", async () => {
  await nearbyPlaces({ kind: "hospital", lat: 6.41, lng: 3.22 }, async (_url, options) => {
    const query = options.body.get("data");
    assert.match(query, /amenity.*hospital/);
    assert.match(query, /healthcare.*hospital/);
    assert.match(query, /area\(3603718182\)/);
    assert.match(query, /area\.lagos/);
    assert.doesNotMatch(query, /clinic/);
    return { ok: true, json: async () => ({ elements: [] }) };
  });
});

test("hospital finder includes facilities tagged healthcare=hospital", () => {
  const places = normalizePlaces([
    { type: "node", id: 881, lat: 6.52, lon: 3.38, tags: { name: "Lagos General Hospital", healthcare: "hospital" } },
  ], { lat: 6.52, lng: 3.38 }, "hospital");
  assert.equal(places.length, 1);
  assert.equal(places[0].name, "Lagos General Hospital");
});

test("public nearby search validates coordinates without exposing account data", async () => {
  const app = createApp(new LocalStore(), { demo: true, test: true, lookupPlaces: async () => ({ source: "OpenStreetMap", places: [] }) });
  assert.equal((await request(app).get("/api/nearby?kind=hospital&lat=999&lng=3.4")).status, 400);
  assert.equal((await request(app).get("/api/nearby?kind=hospital&lat=6.5&lng=3.4")).status, 200);
  assert.equal((await request(app).get("/api/facilities")).status, 401);
});

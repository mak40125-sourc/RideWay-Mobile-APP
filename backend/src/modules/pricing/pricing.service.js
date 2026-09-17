const { PRICING_VERSION, CURRENCY, RATES, MIN_FARE } = require('./pricing.config');
const { logger } = require('../../core/logger/logger');

const OSRM_BASE_URL = (process.env.OSRM_BASE_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
const OSRM_TIMEOUT_MS = 8000;

function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function normalizeVehicleType(vehicleType) {
  const v = String(vehicleType || '').toLowerCase();
  if (RATES[v]) return v;
  const alias = { dash: 'mini', comfort: 'sedan', mega: 'shuttle', auto: 'mini', ride: 'mini' };
  if (alias[v] && RATES[alias[v]]) return alias[v];
  const e = new Error(`Invalid vehicleType. Must be one of: ${Object.keys(RATES).join(', ')}`);
  e.status = 422;
  throw e;
}

function validateCoords(point, name) {
  const lat = Number(point.lat ?? point.latitude);
  const lng = Number(point.lng ?? point.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    const e = new Error(`Invalid ${name} coordinates`);
    e.status = 422;
    throw e;
  }
  return { lat, lng };
}

async function resolveRoute(pickup, dropoff) {
  const url = `${OSRM_BASE_URL}/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=false`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();
    const route = data.routes && data.routes[0];
    if (!route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
      throw new Error('No route');
    }
    return {
      distanceKm: Math.max(0, route.distance / 1000),
      durationMin: Math.max(1, Math.round(route.duration / 60)),
      source: 'osrm',
    };
  } catch (err) {
    const distanceKm = haversineKm(pickup, dropoff);
    const durationMin = Math.max(1, Math.round((distanceKm / 30) * 60));
    logger.warn({ type: 'pricing', event: 'route_fallback', reason: err.message, distanceKm, durationMin });
    return { distanceKm, durationMin, source: 'haversine-fallback' };
  }
}

async function getRoute(pickupRaw, dropoffRaw) {
  const pickup = validateCoords(pickupRaw, 'pickup');
  const dropoff = validateCoords(dropoffRaw, 'dropoff');
  const url = `${OSRM_BASE_URL}/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();
    const route = data.routes && data.routes[0];
    if (!route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
      throw new Error('No route');
    }
    const coords = route.geometry && route.geometry.coordinates;
    const path = Array.isArray(coords) && coords.length
      ? coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
      : [ { latitude: pickup.lat, longitude: pickup.lng }, { latitude: dropoff.lat, longitude: dropoff.lng } ];
    return {
      distanceKm: Number((route.distance / 1000).toFixed(1)),
      durationMin: Math.max(1, Math.round(route.duration / 60)),
      path,
      source: 'osrm',
    };
  } catch (err) {
    const distanceKm = Number(haversineKm(pickup, dropoff).toFixed(1));
    const durationMin = Math.max(1, Math.round((distanceKm / 30) * 60));
    logger.warn({ type: 'pricing', event: 'route_geometry_fallback', reason: err.message, distanceKm, durationMin });
    return {
      distanceKm,
      durationMin,
      path: [ { latitude: pickup.lat, longitude: pickup.lng }, { latitude: dropoff.lat, longitude: dropoff.lng } ],
      source: 'haversine-fallback',
    };
  }
}

function calculateFare(vehicleType, distanceKm, durationMin) {
  const rate = RATES[vehicleType];
  const distanceFare = distanceKm * rate.perKm;
  const timeFare = durationMin * rate.perMin;
  const total = Math.max(MIN_FARE, Math.round(rate.baseFare + distanceFare + timeFare));
  return {
    currency: CURRENCY,
    totalFare: total,
    breakdown: { baseFare: rate.baseFare, distanceFare: Math.round(distanceFare), timeFare: Math.round(timeFare) },
    distanceKm: Number(distanceKm.toFixed(1)),
    durationMin,
    vehicleType,
    pricingVersion: PRICING_VERSION,
  };
}

const quoteFare = async (pickupRaw, dropoffRaw, vehicleTypeRaw) => {
  const vehicleType = normalizeVehicleType(vehicleTypeRaw);
  const pickup = validateCoords(pickupRaw, 'pickup');
  const dropoff = validateCoords(dropoffRaw, 'dropoff');
  const route = await resolveRoute(pickup, dropoff);
  const quote = calculateFare(vehicleType, route.distanceKm, route.durationMin);
  return { ...quote, routeSource: route.source };
};

module.exports = { PRICING_VERSION, CURRENCY, RATES, MIN_FARE, normalizeVehicleType, validateCoords, resolveRoute, calculateFare, quoteFare, getRoute };

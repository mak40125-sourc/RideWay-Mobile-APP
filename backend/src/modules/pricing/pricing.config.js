// Central authoritative pricing table. Mirrors the historical client rates
// (components/ride/ride-config.ts) so existing fares do not change; the
// backend is now the single source of truth.
const PRICING_VERSION = 'v1';
const CURRENCY = 'INR';

const RATES = {
  bike: { baseFare: 26, perKm: 8, perMin: 1 },
  mini: { baseFare: 42, perKm: 12, perMin: 2 },
  sedan: { baseFare: 64, perKm: 15, perMin: 3 },
  shuttle: { baseFare: 88, perKm: 18, perMin: 4 },
};

const MIN_FARE = 20;

module.exports = { PRICING_VERSION, CURRENCY, RATES, MIN_FARE };

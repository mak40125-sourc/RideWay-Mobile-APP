module.exports = {
  RIDE_REQUEST_TTL_SECONDS: 120,
  RIDE_LOCK_TTL_SECONDS: 10,
  NEARBY_DRIVER_RADIUS_METERS: 3000,
  NOTIFICATION_EVENT: 'ride:notifications',
  RIDE_REQUEST_PREFIX: 'ride:request:',
  RIDE_QUEUE_PREFIX: 'ride:queue:',
  RIDE_LOCK_PREFIX: 'ride:lock:',
  RIDE_OFFERS_PREFIX: 'ride:offers:',
  // ── Wave discovery (2-driver waves + individual offer timers) ──
  // WAVE_SIZE caps simultaneously-active drivers; OFFER_DURATION is per-driver,
  // never the global request lifetime (RIDE_REQUEST_TTL_SECONDS stays 120s).
  WAVE_SIZE: 2,
  OFFER_DURATION_SECONDS: 10,
  OFFER_CANCELLED_EVENT: 'ride:offer_cancelled',
  RIDE_WAVE_PREFIX: 'ride:wave:',
  RIDE_OFFER_PREFIX: 'ride:offer:',
};

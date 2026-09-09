# Matching Flow

See `architecture/matching-architecture.md` sequence. Key data: `candidateCount/candidateIds`, `expiresAt`, `riderName`, passenger fields. Filters: online GEO + hash `rideType` + `vehicle_type` exact. Ranker identity. Offer TTL = request TTL 120s. Accept lock TTL 10s. No server retry; rider poll discovers assignment. ✅ IMPLEMENTED.

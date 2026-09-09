# Wallet, Referral, KYC & Pricing

## Wallet

- Balance: `drivers.wallet_balance` (authoritative). Ledger: `wallet_transactions(user_id,ride_id,amount,type,description)`.
- Reads: `GET /api/v1/wallet/:userId/balance` (`get_balance` RPC), `GET …/transactions` (direct select, limit). ⚠️ Writes: no recharge/credit endpoint in code; referral reward writes directly via `try_reward_referral` (`UPDATE drivers SET wallet_balance+` + `INSERT wallet_transactions type=credit`, atomic, idempotent on `qualifying_ride_id`).

## Referral (driver→rider)

- Code: `drivers.referral_code VEL-XXXXX` (`generate_referral_code` + trigger + backfill). URL `https://velos.app/r/<code>`; backend `GET /r/:code` → `ridewayrider://r/<code>`.
- Endpoints: `GET /referrals/code|stats`, `POST /referrals/apply {referralCode}` (rider id from auth, driver role rejected), `GET /referrals/history|/`.
- Lifecycle: `pending → qualified → rewarded` (`rejected|expired` terminal). `apply_referral` enforces valid code, rider exists, anti-self-referral (`drivers.user_id = rider`), one active per rider (unique partial), expiry 90d, reward 100 (`REFERRAL_REWARD_AMOUNT`/`EXPIRY_DAYS` env, server-side only).
- Qualification: `ride.service completeRide` post-commit → `tryRewardForRide` (only `RIDE_COMPLETED`, `fare>0`, first qualifying ride by rider, any performing driver; `FOR UPDATE` + unique `qualifying_ride_id` → exactly-once).
- ✅ IMPLEMENTED.

## KYC

- Flow: `POST /drivers/register` → `upload-document` (multer→`kyc-documents` storage → `driver_documents pending`) → dashboard `POST /drivers/:id/kyc/review` (verified/needs_correction/rejected + `driver_kyc_reviews` audit) → driver gate `registration-pending` until `verified && is_verified`. Migration `backend/supabase/migrations/006_kyc_review.sql`. ✅.

## Pricing

- Rider computes: `getRouteEstimate` (OSRM, km/min) → `calculateRideFare(base+km*perKm+min*perMin)` per `ride-config` (Bike 26/8/1, Dash 42/12/2, Comfort 64/15/3, Mega 88/18/4). Backend persists verbatim through `create_ride_idempotent → ride:request → accept_ride`; never recomputes. ⚠️ Client-authoritative fare (architectural risk).

const { supabaseAdmin } = require('../../core/database/supabase')
const redisService = require('../../core/redis/redis.service')

// Read-only operations dashboard. All queries run against the service-role
// client (bypasses RLS) because the dashboard is an internal ops tool, not a
// rider/driver facing endpoint. No writes happen here.

const ACTIVE_STATUSES = [
  'REQUESTED',
  'SEARCHING_DRIVER',
  'DRIVER_ASSIGNED',
  'DRIVER_ARRIVING',
  'RIDE_STARTED',
]
const SEARCHING_STATUSES = ['REQUESTED', 'SEARCHING_DRIVER']
const COMPLETED_STATUS = 'RIDE_COMPLETED'
const CANCELLED_STATUS = 'CANCELLED'

// Start/end ISO timestamps for "today" and "yesterday" in Asia/Kolkata (IST),
// the operating timezone of the business. IST is a fixed UTC+5:30.
function istDayBounds() {
  const nowUtc = Date.now()
  const istMs = nowUtc + 5.5 * 60 * 60 * 1000
  const d = new Date(istMs)
  const startOfTodayIstUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const startOfToday = startOfTodayIstUtc - 5.5 * 60 * 60 * 1000
  return {
    todayStart: new Date(startOfToday).toISOString(),
    yesterdayStart: new Date(startOfToday - 24 * 60 * 60 * 1000).toISOString(),
    todayEnd: new Date(nowUtc).toISOString(),
  }
}

const sumFare = (rows) =>
  (rows || []).reduce((total, row) => total + (Number(row.fare) || 0), 0)

const countRows = async (query) => {
  const { count, error } = await query
  if (error) throw error
  return count || 0
}

const sanitizeLike = (value) => String(value).replace(/[\\%*]/g, '').trim()

// Resolve profile/driver ids whose display name matches the search term, so we
// can filter rides by rider or driver name even though names live in `profiles`.
async function resolveNameSearchIds(term) {
  const safe = sanitizeLike(term)
  if (!safe) return { riderIds: [], driverIds: [] }

  const { data: riders } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .ilike('name', `%${safe}%`)

  const { data: drivers } = await supabaseAdmin
    .from('drivers')
    .select('id, user_id, profiles(name)')
    .ilike('profiles.name', `%${safe}%`)

  return {
    riderIds: (riders || []).map((r) => r.id),
    driverIds: (drivers || []).map((d) => d.id),
  }
}

async function getOnlineDriverIds() {
  try {
    const ids = await redisService.getOnlineDriverIds()
    return ids || []
  } catch {
    return null
  }
}

exports.getStats = async () => {
  const { todayStart, yesterdayStart, todayEnd } = istDayBounds()
  const onlineIds = await getOnlineDriverIds()

  let onlineDrivers
  let availableDrivers
  if (onlineIds) {
    onlineDrivers = onlineIds.length
    const { data: busy } = await supabaseAdmin
      .from('rides')
      .select('driver_id')
      .in('status', ACTIVE_STATUSES)
      .not('driver_id', 'is', null)
    const busyOnline = new Set((busy || []).map((r) => r.driver_id))
    const onlineSet = new Set(onlineIds)
    let onRide = 0
    busyOnline.forEach((id) => {
      if (onlineSet.has(id)) onRide += 1
    })
    availableDrivers = Math.max(0, onlineDrivers - onRide)
  } else {
    // Redis unavailable: fall back to the Supabase `is_online` column.
    onlineDrivers = await countRows(
      supabaseAdmin
        .from('drivers')
        .select('*', { count: 'exact', head: true })
        .eq('is_online', true),
    )
    const { data: busy } = await supabaseAdmin
      .from('rides')
      .select('driver_id')
      .in('status', ACTIVE_STATUSES)
      .not('driver_id', 'is', null)
    availableDrivers = Math.max(0, onlineDrivers - new Set((busy || []).map((r) => r.driver_id)).size)
  }

  const [
    totalRides,
    activeRides,
    completedRides,
    cancelledRides,
    searchingRides,
    todayRides,
    yesterdayRides,
    revenueRows,
    todayRevenueRows,
    yesterdayRevenueRows,
    totalDrivers,
  ] = await Promise.all([
    countRows(supabaseAdmin.from('rides').select('*', { count: 'exact', head: true })),
    countRows(
      supabaseAdmin.from('rides').select('*', { count: 'exact', head: true }).in('status', ACTIVE_STATUSES),
    ),
    countRows(
      supabaseAdmin.from('rides').select('*', { count: 'exact', head: true }).eq('status', COMPLETED_STATUS),
    ),
    countRows(
      supabaseAdmin.from('rides').select('*', { count: 'exact', head: true }).eq('status', CANCELLED_STATUS),
    ),
    countRows(
      supabaseAdmin.from('rides').select('*', { count: 'exact', head: true }).in('status', SEARCHING_STATUSES),
    ),
    countRows(
      supabaseAdmin.from('rides').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
    ),
    countRows(
      supabaseAdmin
        .from('rides')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterdayStart)
        .lt('created_at', todayStart),
    ),
    supabaseAdmin.from('rides').select('fare').eq('status', COMPLETED_STATUS),
    supabaseAdmin.from('rides').select('fare').eq('status', COMPLETED_STATUS).gte('created_at', todayStart),
    supabaseAdmin
      .from('rides')
      .select('fare')
      .eq('status', COMPLETED_STATUS)
      .gte('created_at', yesterdayStart)
      .lt('created_at', todayEnd),
    countRows(supabaseAdmin.from('drivers').select('*', { count: 'exact', head: true })),
  ])

  return {
    totalRides,
    activeRides,
    completedRides,
    cancelledRides,
    searchingRides,
    revenue: sumFare(revenueRows.data),
    todayRides,
    todayRevenue: sumFare(todayRevenueRows.data),
    yesterdayRides,
    yesterdayRevenue: sumFare(yesterdayRevenueRows.data),
    totalDrivers,
    onlineDrivers,
    availableDrivers,
  }
}

exports.listRides = async ({ search, status, from, to, page = 1, pageSize = 25 }) => {
  const fromIdx = (page - 1) * pageSize

  let query = supabaseAdmin.from('rides').select('*', { count: 'exact' })
  if (status && status !== 'ALL') query = query.eq('status', status)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  if (search) {
    const safe = sanitizeLike(search)
    const { riderIds, driverIds } = await resolveNameSearchIds(safe)
    const orParts = [`id.ilike.*${safe}*`]
    if (riderIds.length) orParts.push(`rider_id.in.(${riderIds.join(',')})`)
    if (driverIds.length) orParts.push(`driver_id.in.(${driverIds.join(',')})`)
    query = query.or(orParts.join(','))
  }

  query = query.order('created_at', { ascending: false }).range(fromIdx, fromIdx + pageSize - 1)

  const { data, count, error } = await query
  if (error) throw error

  const rides = await enrichRides(data || [])
  return { rides, total: count || 0, page, pageSize }
}

exports.getRide = async (rideId) => {
  const { data: ride, error } = await supabaseAdmin
    .from('rides')
    .select('*')
    .eq('id', rideId)
    .maybeSingle()
  if (error) throw error
  if (!ride) return null

  const riderIds = ride.rider_id ? [ride.rider_id] : []
  const driverIds = ride.driver_id ? [ride.driver_id] : []
  const riderNameMap = {}
  const driverInfoMap = {}

  if (riderIds.length) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, name, phone')
      .in('id', riderIds)
    ;(profiles || []).forEach((p) => {
      riderNameMap[p.id] = { name: p.name, phone: p.phone }
    })
  }

  if (driverIds.length) {
    const { data: drivers } = await supabaseAdmin
      .from('drivers')
      .select('id, user_id, vehicle_type, vehicle_number, vehicle_model, vehicle_color')
      .in('id', driverIds)
    const userIds = (drivers || []).map((d) => d.user_id)
    const userMap = {}
    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, name, phone')
        .in('id', userIds)
      ;(profiles || []).forEach((p) => {
        userMap[p.id] = { name: p.name, phone: p.phone }
      })
    }
    ;(drivers || []).forEach((d) => {
      const profile = userMap[d.user_id] || {}
      driverInfoMap[d.id] = {
        name: profile.name || null,
        phone: profile.phone || null,
        vehicleType: d.vehicle_type || null,
        vehicleNumber: d.vehicle_number || null,
        vehicleModel: d.vehicle_model || null,
        vehicleColor: d.vehicle_color || null,
      }
    })
  }

  return {
    id: ride.id,
    status: ride.status,
    rider: riderNameMap[ride.rider_id]
      ? { id: ride.rider_id, name: riderNameMap[ride.rider_id].name, phone: riderNameMap[ride.rider_id].phone }
      : { id: ride.rider_id, name: 'Unknown rider', phone: null },
    driver: ride.driver_id
      ? { id: ride.driver_id, ...driverInfoMap[ride.driver_id] }
      : null,
    type: ride.driver_id && driverInfoMap[ride.driver_id] ? driverInfoMap[ride.driver_id].vehicleType : null,
    pickup: ride.pickup_address || null,
    destination: ride.drop_address || null,
    fare: Number(ride.fare) || 0,
    distanceKm: Number(ride.distance) || 0,
    durationMin: ride.duration != null ? Number(ride.duration) : null,
    createdAt: ride.created_at,
    updatedAt: ride.updated_at,
  }
}

exports.listDrivers = async ({ status = 'all', kycStatus = 'all', search = '', page = 1, pageSize = 25 }) => {
  const safe = sanitizeLike(search)

  let query = supabaseAdmin
    .from('drivers')
    .select('id, user_id, vehicle_type, vehicle_number, vehicle_model, vehicle_color, is_online, kyc_status, last_pings_at, created_at')

  if (safe) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('name', `%${safe}%`)
    const nameIds = (profiles || []).map((p) => p.id)
    const orParts = [`vehicle_number.ilike.*${safe}*`]
    if (nameIds.length) orParts.push(`user_id.in.(${nameIds.join(',')})`)
    query = query.or(orParts.join(','))
  }

  if (kycStatus && kycStatus !== 'all') query = query.eq('kyc_status', kycStatus)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error

  const drivers = data || []
  const onlineIds = await getOnlineDriverIds()
  const driverIds = drivers.map((d) => d.id)

  const { data: driverDocs } = await supabaseAdmin
    .from('driver_documents')
    .select('driver_id')
    .in('driver_id', driverIds)
  const documentsCountByDriver = {}
  ;(driverDocs || []).forEach((doc) => {
    documentsCountByDriver[doc.driver_id] = (documentsCountByDriver[doc.driver_id] || 0) + 1
  })

  const { data: activeRides } = await supabaseAdmin
    .from('rides')
    .select('driver_id, id, status')
    .in('status', ACTIVE_STATUSES)
    .in('driver_id', driverIds)
  const currentRideByDriver = {}
  ;(activeRides || []).forEach((r) => {
    if (!currentRideByDriver[r.driver_id]) {
      currentRideByDriver[r.driver_id] = { id: r.id, status: r.status }
    }
  })

  const userIds = drivers.map((d) => d.user_id)
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, name, phone')
    .in('id', userIds)
  const nameMap = {}
  ;(profiles || []).forEach((p) => {
    nameMap[p.id] = { name: p.name, phone: p.phone }
  })

  const onlineSet = onlineIds ? new Set(onlineIds) : null

  let rows = drivers.map((d) => {
    const isOnline = onlineSet ? onlineSet.has(d.id) : !!d.is_online
    return {
      id: d.id,
      name: nameMap[d.user_id]?.name || 'Unknown driver',
      phone: nameMap[d.user_id]?.phone || null,
      vehicleType: d.vehicle_type || null,
      vehicleNumber: d.vehicle_number || null,
    vehicleModel: d.vehicle_model || null,
      vehicleColor: d.vehicle_color || null,
    isOnline,
      kycStatus: d.kyc_status,
      documentsCount: documentsCountByDriver[d.id] || 0,
      lastActiveAt: d.last_pings_at || null,
      joinedAt: d.created_at,
      currentRide: currentRideByDriver[d.id] || null,
    }
  })

  if (status === 'online') rows = rows.filter((r) => r.isOnline)
  else if (status === 'offline') rows = rows.filter((r) => !r.isOnline)

  const total = rows.length
  const fromIdx = (page - 1) * pageSize
  const paged = rows.slice(fromIdx, fromIdx + pageSize)

  return { drivers: paged, total, page, pageSize }
}

exports.getDriver = async (driverId) => {
  const { data: driver, error } = await supabaseAdmin
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .maybeSingle()
  if (error) throw error
  if (!driver) return null

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, name, phone')
    .eq('id', driver.user_id)
    .maybeSingle()

  const { data: active } = await supabaseAdmin
    .from('rides')
    .select('id, status, rider_id, pickup_address, drop_address, fare')
    .in('status', ACTIVE_STATUSES)
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(1)

  const onlineIds = await getOnlineDriverIds()
  const isOnline = onlineIds ? onlineIds.includes(driverId) : !!driver.is_online

  const [totalRides, completedRides, cancelledRides, earningsRows, riderName] = await Promise.all([
    countRows(
      supabaseAdmin.from('rides').select('*', { count: 'exact', head: true }).eq('driver_id', driverId),
    ),
    countRows(
      supabaseAdmin
        .from('rides')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', driverId)
        .eq('status', COMPLETED_STATUS),
    ),
    countRows(
      supabaseAdmin
        .from('rides')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', driverId)
        .eq('status', CANCELLED_STATUS),
    ),
    supabaseAdmin.from('rides').select('fare').eq('driver_id', driverId).eq('status', COMPLETED_STATUS),
    active && active[0]?.rider_id
      ? supabaseAdmin.from('profiles').select('name').eq('id', active[0].rider_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  let currentRide = null
  if (active && active[0]) {
    currentRide = {
      id: active[0].id,
      status: active[0].status,
      rider: riderName?.data?.name || 'Unknown rider',
      pickup: active[0].pickup_address || null,
      destination: active[0].drop_address || null,
      fare: Number(active[0].fare) || 0,
    }
  }

  return {
    id: driver.id,
    name: profile?.name || 'Unknown driver',
    phone: profile?.phone || null,
    vehicleType: driver.vehicle_type || null,
    vehicleNumber: driver.vehicle_number || null,
    vehicleModel: driver.vehicle_model || null,
    vehicleColor: driver.vehicle_color || null,
    isOnline,
    lastActiveAt: driver.last_pings_at || null,
    joinedAt: driver.created_at,
    currentRide,
    stats: {
      totalRides,
      completedRides,
      cancelledRides,
      totalEarnings: sumFare(earningsRows.data),
    },
  }
}

async function enrichRides(rides) {
  const riderIds = [...new Set(rides.map((r) => r.rider_id).filter(Boolean))]
  const driverIds = [...new Set(rides.map((r) => r.driver_id).filter(Boolean))]
  const riderNameMap = {}
  const driverInfoMap = {}

  if (riderIds.length) {
    const { data } = await supabaseAdmin.from('profiles').select('id, name').in('id', riderIds)
    ;(data || []).forEach((p) => {
      riderNameMap[p.id] = p.name
    })
  }

  if (driverIds.length) {
    const { data } = await supabaseAdmin
      .from('drivers')
      .select('id, user_id, vehicle_type')
      .in('id', driverIds)
    const userIds = (data || []).map((d) => d.user_id)
    const userMap = {}
    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, name')
        .in('id', userIds)
      ;(profiles || []).forEach((p) => {
        userMap[p.id] = p.name
      })
    }
    ;(data || []).forEach((d) => {
      driverInfoMap[d.id] = {
        name: userMap[d.user_id] || null,
        vehicleType: d.vehicle_type || null,
      }
    })
  }

  return rides.map((r) => ({
    id: r.id,
    status: r.status,
    rider: riderNameMap[r.rider_id] || 'Unknown rider',
    driver: r.driver_id ? driverInfoMap[r.driver_id]?.name || null : null,
    type: r.driver_id && driverInfoMap[r.driver_id] ? driverInfoMap[r.driver_id].vehicleType : null,
    pickup: r.pickup_address || null,
    destination: r.drop_address || null,
    fare: Number(r.fare) || 0,
    distanceKm: Number(r.distance) || 0,
    durationMin: r.duration != null ? Number(r.duration) : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}

// ── KYC review & approval ─────────────────────────────────────────
const KYC_TRANSITIONS = {
  pending: ['in_review'],
  in_review: ['verified', 'rejected', 'needs_correction'],
  verified: [],
  needs_correction: ['in_review'],
  rejected: [],
}

const KYC_ACTION_STATUS = {
  start_review: 'in_review',
  approve: 'verified',
  reject: 'rejected',
  request_correction: 'needs_correction',
}

function extractStoragePath(documentUrl) {
  if (!documentUrl) return null
  const match = String(documentUrl).match(/\/kyc-documents\/(.+?)(?:\?.*)?$/)
  return match ? match[1] : null
}

exports.getDriverKyc = async (driverId) => {
  const { data: driver, error } = await supabaseAdmin
    .from('drivers')
    .select('id, kyc_status, is_verified')
    .eq('id', driverId)
    .maybeSingle()
  if (error) throw error
  if (!driver) return null

  const { data: docs, error: docsErr } = await supabaseAdmin
    .from('driver_documents')
    .select('id, document_type, document_url, status, rejection_reason, created_at')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: true })
  if (docsErr) throw docsErr

  const documents = await Promise.all(
    (docs || []).map(async (doc) => {
      let url = null
      const path = extractStoragePath(doc.document_url)
      if (path) {
        try {
          const { data: signed } = await supabaseAdmin.storage
            .from('kyc-documents')
            .createSignedUrl(path, 60 * 60)
          if (signed) url = signed.signedUrl
        } catch {
          url = null
        }
      }
      return {
        id: doc.id,
        documentType: doc.document_type,
        status: doc.status,
        rejectionReason: doc.rejection_reason || null,
        uploadedAt: doc.created_at,
        url,
      }
    }),
  )

  const { data: history, error: histErr } = await supabaseAdmin
    .from('driver_kyc_reviews')
    .select('id, reviewer, action, previous_status, new_status, reason, created_at')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
  if (histErr) throw histErr

  return {
    driverId: driver.id,
    kycStatus: driver.kyc_status,
    isVerified: driver.is_verified,
    documents,
    history: (history || []).map((h) => ({
      id: h.id,
      reviewer: h.reviewer || null,
      action: h.action,
      previousStatus: h.previous_status,
      newStatus: h.new_status,
      reason: h.reason || null,
      createdAt: h.created_at,
    })),
  }
}

exports.reviewDriverKyc = async (driverId, { action, reason, reviewer } = {}) => {
  // TODO (KYC auth): The dashboard currently authenticates with a shared
  // `x-dashboard-key`, so there is no real administrator identity available.
  // `reviewer` is deliberately left nullable. Future: replace the shared key
  // with an authenticated admin session and attribute KYC actions to that user
  // instead of storing null.
  if (!KYC_ACTION_STATUS[action]) {
    const err = new Error(`Invalid KYC action: ${action}`)
    err.status = 400
    throw err
  }

  const { data: driver, error } = await supabaseAdmin
    .from('drivers')
    .select('kyc_status, is_verified')
    .eq('id', driverId)
    .maybeSingle()
  if (error) throw error
  if (!driver) {
    const err = new Error('Driver not found')
    err.status = 404
    throw err
  }

  const current = driver.kyc_status
  const newStatus = KYC_ACTION_STATUS[action]
  const allowed = KYC_TRANSITIONS[current] || []
  if (!allowed.includes(newStatus)) {
    const err = new Error(`Cannot ${action} from KYC status '${current}'`)
    err.status = 400
    throw err
  }
  if ((action === 'reject' || action === 'request_correction') && !reason) {
    const err = new Error('A reason is required for this action')
    err.status = 400
    throw err
  }

  const { error: updErr } = await supabaseAdmin
    .from('drivers')
    .update({
      kyc_status: newStatus,
      is_verified: newStatus === 'verified',
      kyc_reviewed_at: new Date().toISOString(),
      kyc_reviewed_by: reviewer || null,
    })
    .eq('id', driverId)
  if (updErr) throw updErr

  if (action === 'approve') {
    await supabaseAdmin
      .from('driver_documents')
      .update({ status: 'approved' })
      .eq('driver_id', driverId)
  } else if (action === 'reject') {
    await supabaseAdmin
      .from('driver_documents')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('driver_id', driverId)
  }

  const { error: insErr } = await supabaseAdmin.from('driver_kyc_reviews').insert({
    driver_id: driverId,
    reviewer: reviewer || null,
    action,
    previous_status: current,
    new_status: newStatus,
    reason: reason || null,
  })
  if (insErr) throw insErr

  return { driverId, kycStatus: newStatus, isVerified: newStatus === 'verified' }
}

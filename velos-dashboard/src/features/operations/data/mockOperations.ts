import type {
  ActiveRideRow,
  AttentionItem,
  DriverMarker,
  LatLng,
  OperationsSummary,
  RideMarker,
} from '../types'

export const MAP_CONFIG = {
  center: { lat: 30.537, lng: 76.583 },
  zoom: 11,
} as const

const PLACES = {
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  mohali: { lat: 30.7046, lng: 76.7171 },
  panchkula: { lat: 30.6942, lng: 76.8606 },
  kharar: { lat: 30.7461, lng: 76.6466 },
  zirakpur: { lat: 30.6427, lng: 76.8176 },
  derabassi: { lat: 30.5903, lng: 76.8422 },
  banur: { lat: 30.5565, lng: 76.7139 },
  rajpura: { lat: 30.4837, lng: 76.5931 },
  patiala: { lat: 30.3398, lng: 76.3869 },
} as const

const near = (place: keyof typeof PLACES, dLat = 0, dLng = 0): LatLng => ({
  lat: PLACES[place].lat + dLat,
  lng: PLACES[place].lng + dLng,
})

export const operationsSummary: OperationsSummary = {
  onlineDrivers: 42,
  availableDrivers: 27,
  driversOnRide: 15,
  activeRides: 15,
  searchingRides: 6,
}

export const driverMarkers: DriverMarker[] = [
  {
    id: 'drv-001',
    name: 'Marcus Lee',
    vehicleType: 'Toyota Etios',
    status: 'AVAILABLE',
    position: near('mohali', 0.006, -0.004),
  },
  {
    id: 'drv-002',
    name: 'Sofia Ramos',
    vehicleType: 'Maruti Swift',
    status: 'AVAILABLE',
    position: near('chandigarh', -0.008, 0.006),
  },
  {
    id: 'drv-003',
    name: 'Luis Gomez',
    vehicleType: 'Hyundai i20',
    status: 'AVAILABLE',
    position: near('kharar', 0.004, -0.006),
  },
  {
    id: 'drv-004',
    name: 'Aisha Bello',
    vehicleType: 'Renault Triber',
    status: 'ON_RIDE',
    position: near('zirakpur', -0.006, -0.01),
    currentRideId: 'R-10412',
  },
  {
    id: 'drv-005',
    name: 'Noah Kim',
    vehicleType: 'Honda City',
    status: 'ON_RIDE',
    position: near('chandigarh', 0.012, 0.005),
    currentRideId: 'R-10410',
  },
  {
    id: 'drv-006',
    name: 'Priya Nair',
    vehicleType: 'Tata Tiago',
    status: 'AVAILABLE',
    position: near('banur', 0.004, 0.008),
  },
  {
    id: 'drv-007',
    name: 'Marco Ruiz',
    vehicleType: 'Maruti Dzire',
    status: 'OFFLINE',
    position: near('derabassi', 0.008, -0.01),
  },
  {
    id: 'drv-008',
    name: 'Dana Whitfield',
    vehicleType: 'Hyundai Creta',
    status: 'ON_RIDE',
    position: near('panchkula', -0.01, 0.008),
    currentRideId: 'R-10408',
  },
  {
    id: 'drv-009',
    name: 'Amara Okafor',
    vehicleType: 'Toyota Etios',
    status: 'OFFLINE',
    position: near('rajpura', 0.01, -0.008),
  },
]

export const rideMarkers: RideMarker[] = [
  {
    id: 'R-10412',
    rider: 'Tomás Herrera',
    driver: 'Aisha Bello',
    status: 'ONGOING',
    durationMin: 14,
    position: near('zirakpur', -0.006, -0.01),
  },
  {
    id: 'R-10410',
    rider: 'Jordan Blake',
    driver: 'Noah Kim',
    status: 'ONGOING',
    durationMin: 9,
    position: near('chandigarh', 0.012, 0.005),
  },
  {
    id: 'R-10408',
    rider: 'Emily Chen',
    driver: 'Dana Whitfield',
    status: 'DRIVER_ASSIGNED',
    durationMin: 3,
    position: near('panchkula', -0.01, 0.008),
  },
  {
    id: 'R-10415',
    rider: 'Owen Miller',
    status: 'SEARCHING',
    durationMin: 8,
    position: near('mohali', -0.01, 0.012),
  },
  {
    id: 'R-10417',
    rider: 'Lena Fischer',
    status: 'SEARCHING',
    durationMin: 12,
    position: near('patiala', 0.01, -0.012),
  },
  {
    id: 'R-10409',
    rider: 'Priya Nair',
    driver: 'Sofia Ramos',
    status: 'ONGOING',
    durationMin: 21,
    position: near('chandigarh', -0.012, -0.008),
  },
]

export const attentionItems: AttentionItem[] = [
  {
    id: 'ops-attention-1',
    kind: 'searching',
    title: 'R-10415 searching for 8 minutes',
    detail: 'No nearby drivers · Mohali',
    time: '8m',
  },
  {
    id: 'ops-attention-2',
    kind: 'disconnected',
    title: 'Driver disconnected',
    detail: 'Marco Ruiz · connection lost',
    time: '2m',
  },
  {
    id: 'ops-attention-3',
    kind: 'unassigned',
    title: 'Ride without driver',
    detail: 'R-10413 queued for assignment',
    time: '4m',
  },
  {
    id: 'ops-attention-4',
    kind: 'searching',
    title: 'R-10417 searching for 12 minutes',
    detail: 'High-demand area · Patiala',
    time: '12m',
  },
  {
    id: 'ops-attention-5',
    kind: 'disconnected',
    title: 'Driver offline',
    detail: 'Amara Okafor · shift ended early',
    time: 'Just now',
  },
]

export const activeRides: ActiveRideRow[] = [
  {
    id: 'R-10412',
    status: 'ONGOING',
    rider: 'Tomás Herrera',
    driver: 'Aisha Bello',
    durationMin: 14,
    location: 'Zirakpur',
  },
  {
    id: 'R-10410',
    status: 'ONGOING',
    rider: 'Jordan Blake',
    driver: 'Noah Kim',
    durationMin: 9,
    location: 'Sector 17 · Chandigarh',
  },
  {
    id: 'R-10409',
    status: 'ONGOING',
    rider: 'Priya Nair',
    driver: 'Sofia Ramos',
    durationMin: 21,
    location: 'Chandigarh',
  },
  {
    id: 'R-10408',
    status: 'DRIVER_ASSIGNED',
    rider: 'Emily Chen',
    driver: 'Dana Whitfield',
    durationMin: 3,
    location: 'Panchkula',
  },
  {
    id: 'R-10415',
    status: 'SEARCHING',
    rider: 'Owen Miller',
    driver: '—',
    durationMin: 8,
    location: 'Mohali',
  },
  {
    id: 'R-10417',
    status: 'SEARCHING',
    rider: 'Lena Fischer',
    driver: '—',
    durationMin: 12,
    location: 'Patiala',
  },
  {
    id: 'R-10414',
    status: 'ONGOING',
    rider: 'Rahul Verma',
    driver: 'Marcus Lee',
    durationMin: 17,
    location: 'Kharar',
  },
  {
    id: 'R-10411',
    status: 'DRIVER_ASSIGNED',
    rider: 'Meera Joshi',
    driver: 'Luis Gomez',
    durationMin: 2,
    location: 'Rajpura',
  },
]

import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import FloatingSurface from '../../../components/surfaces/FloatingSurface'
import { velosRadii } from '../../../app/theme'
import { driverMarkers, MAP_CONFIG, rideMarkers } from '../data/mockOperations'
import type { DriverMarker, DriverStatus, RideMarker, RideStatus } from '../types'
import { createDriverIcon, createRideIcon } from './mapIcons'
import '../operations.css'

type ChipColor = 'success' | 'primary' | 'info' | 'warning' | 'default'

const DRIVER_LABEL: Record<DriverStatus, string> = {
  AVAILABLE: 'Available',
  ON_RIDE: 'On ride',
  OFFLINE: 'Offline',
}

const DRIVER_CHIP: Record<DriverStatus, ChipColor> = {
  AVAILABLE: 'success',
  ON_RIDE: 'primary',
  OFFLINE: 'default',
}

const RIDE_LABEL: Record<RideStatus, string> = {
  SEARCHING: 'Searching',
  DRIVER_ASSIGNED: 'Assigned',
  ONGOING: 'Ongoing',
}

const RIDE_CHIP: Record<RideStatus, ChipColor> = {
  SEARCHING: 'warning',
  DRIVER_ASSIGNED: 'info',
  ONGOING: 'primary',
}

const DRIVER_ENTRIES: DriverStatus[] = ['AVAILABLE', 'ON_RIDE', 'OFFLINE']

const RIDE_ENTRIES: RideStatus[] = ['SEARCHING', 'DRIVER_ASSIGNED', 'ONGOING']

function MapLegend({
  driverColor,
  rideColor,
}: {
  driverColor: (status: DriverStatus) => string
  rideColor: (status: RideStatus) => string
}) {
  return (
    <FloatingSurface
      sx={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        zIndex: 1000,
        px: 1.5,
        py: 1,
        borderRadius: velosRadii.floating,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        Drivers
      </Typography>
      {DRIVER_ENTRIES.map((status) => (
        <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: driverColor(status),
              flexShrink: 0,
            }}
          />
          <Typography variant="caption">{DRIVER_LABEL[status]}</Typography>
        </Box>
      ))}
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mt: 0.5 }}>
        Rides
      </Typography>
      {RIDE_ENTRIES.map((status) => (
        <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: 2,
              borderColor: rideColor(status),
              display: 'grid',
              placeItems: 'center',
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
          >
            <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: rideColor(status) }} />
          </Box>
          <Typography variant="caption">{RIDE_LABEL[status]}</Typography>
        </Box>
      ))}
    </FloatingSurface>
  )
}

function DriverPopup({ driver }: { driver: DriverMarker }) {
  return (
    <Box sx={{ p: 1.5, minWidth: 180 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {driver.name}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {driver.vehicleType}
      </Typography>
      <Box sx={{ mt: 1 }}>
        <Chip
          label={DRIVER_LABEL[driver.status]}
          color={DRIVER_CHIP[driver.status]}
          size="small"
          variant="outlined"
        />
      </Box>
      {driver.currentRideId && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Current ride {driver.currentRideId}
        </Typography>
      )}
    </Box>
  )
}

function RidePopup({ ride }: { ride: RideMarker }) {
  return (
    <Box sx={{ p: 1.5, minWidth: 180 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {ride.id}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Rider · {ride.rider}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Driver · {ride.driver ?? 'Searching…'}
      </Typography>
      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          label={RIDE_LABEL[ride.status]}
          color={RIDE_CHIP[ride.status]}
          size="small"
          variant="outlined"
        />
        <Typography variant="caption" color="text.secondary">
          {ride.durationMin} min
        </Typography>
      </Box>
    </Box>
  )
}

export default function OperationsMap() {
  const theme = useTheme()

  const driverColor = (status: DriverStatus) => {
    if (status === 'AVAILABLE') return theme.palette.success.main
    if (status === 'ON_RIDE') return theme.palette.primary.main
    return theme.palette.grey[500]
  }

  const rideColor = (status: RideStatus) => {
    if (status === 'SEARCHING') return theme.palette.warning.main
    if (status === 'DRIVER_ASSIGNED') return theme.palette.info.main
    return theme.palette.primary.main
  }

  return (
    <Box
      sx={{
        position: 'relative',
        height: { xs: 420, lg: 600 },
        borderRadius: velosRadii.panel,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
      }}
    >
      <MapContainer
        center={[MAP_CONFIG.center.lat, MAP_CONFIG.center.lng]}
        zoom={MAP_CONFIG.zoom}
        scrollWheelZoom
        className="velos-map"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {driverMarkers.map((driver) => (
          <Marker
            key={driver.id}
            position={[driver.position.lat, driver.position.lng]}
            icon={createDriverIcon(
              driverColor(driver.status),
              driver.status === 'OFFLINE' ? 0.6 : 1,
            )}
          >
            <Popup>
              <DriverPopup driver={driver} />
            </Popup>
          </Marker>
        ))}
        {rideMarkers.map((ride) => (
          <Marker
            key={ride.id}
            position={[ride.position.lat, ride.position.lng]}
            icon={createRideIcon(rideColor(ride.status))}
          >
            <Popup>
              <RidePopup ride={ride} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <MapLegend driverColor={driverColor} rideColor={rideColor} />
    </Box>
  )
}

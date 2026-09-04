import type { ReactNode } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined'
import TripOriginOutlined from '@mui/icons-material/TripOriginOutlined'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import { formatDistance, formatFare, formatRideTime } from '../../../rides/format'
import { RIDE_TYPE_LABEL } from '../../../lib/rideStatus'
import type { RideType } from '../../../lib/rideStatus'
import { useRide } from '../../dashboard/queries'
import type { RideDetail } from '../../dashboard/types'
import { ErrorState, LoadingState } from '../../../components/ui/Feedback'
import RideStatusChip from './RideStatusChip'
import RideTimeline from './RideTimeline'

const DRAWER_WIDTH = 400

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 2,
        py: 0.75,
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, textAlign: 'right' }}>
        {value}
      </Typography>
    </Box>
  )
}

function JourneyRow({ icon, label, address }: { icon: ReactNode; label: string; address: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 0.75 }}>
      <Box sx={{ mt: 0.25, display: 'flex' }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {address}
        </Typography>
      </Box>
    </Box>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
      {children}
    </Typography>
  )
}

function RideDetailsContent({ ride, onClose }: { ride: RideDetail; onClose: () => void }) {
  const times = {
    requested: formatRideTime(ride.createdAt),
    matched: undefined,
    driver_arrived: undefined,
    trip_started: undefined,
    completed:
      ride.status === 'RIDE_COMPLETED' ? formatRideTime(ride.updatedAt ?? undefined) : undefined,
    cancelled:
      ride.status === 'CANCELLED' ? formatRideTime(ride.updatedAt ?? undefined) : undefined,
  }

  const typeLabel = ride.type ? RIDE_TYPE_LABEL[ride.type as RideType] : '—'

  return (
    <Box
      sx={{
        width: DRAWER_WIDTH,
        maxWidth: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {ride.id}
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <RideStatusChip status={ride.status} />
          </Box>
        </Box>
        <IconButton onClick={onClose} aria-label="Close ride details" size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 3, py: 2 }}>
        <SectionTitle>Parties</SectionTitle>
        <Row label="Rider" value={ride.rider.name} />
        <Row label="Driver" value={ride.driver?.name ?? 'Searching for driver'} />

        <Divider sx={{ my: 2 }} />

        <SectionTitle>Ride</SectionTitle>
        <Row label="Ride type" value={typeLabel} />
        <Row label="Fare" value={formatFare(ride.fare)} />
        <Row label="Distance" value={formatDistance(ride.distanceKm)} />
        <Row label="Duration" value={ride.durationMin != null ? `${ride.durationMin} min` : '—'} />

        <Divider sx={{ my: 2 }} />

        <SectionTitle>Journey</SectionTitle>
        <JourneyRow
          icon={<TripOriginOutlined sx={{ fontSize: 18, color: 'success.main' }} />}
          label="Pickup"
          address={ride.pickup ?? '—'}
        />
        <JourneyRow
          icon={<LocationOnOutlined sx={{ fontSize: 18, color: 'primary.main' }} />}
          label="Destination"
          address={ride.destination ?? '—'}
        />

        <Divider sx={{ my: 2 }} />

        <SectionTitle>Timeline</SectionTitle>
        <RideTimeline status={ride.status} times={times} />
      </Box>
    </Box>
  )
}

interface RideDetailsDrawerProps {
  rideId: string | null
  onClose: () => void
}

export default function RideDetailsDrawer({ rideId, onClose }: RideDetailsDrawerProps) {
  const { data: ride, isLoading, isError, error, refetch } = useRide(rideId)

  return (
    <Drawer
      anchor="right"
      open={rideId !== null}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: DRAWER_WIDTH,
            maxWidth: '100%',
          },
        },
      }}
    >
      {isLoading ? (
        <LoadingState message="Loading ride…" />
      ) : isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : ride ? (
        <RideDetailsContent ride={ride} onClose={onClose} />
      ) : null}
    </Drawer>
  )
}

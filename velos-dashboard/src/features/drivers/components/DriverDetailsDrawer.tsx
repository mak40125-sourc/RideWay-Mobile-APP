import { useState } from 'react'
import type { ReactNode } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import StatusBadge from '../../../components/ui/StatusBadge'
import { formatFare } from '../../../rides/format'
import { useDriver } from '../../dashboard/queries'
import type { DriverDetail } from '../../dashboard/types'
import { ErrorState, LoadingState } from '../../../components/ui/Feedback'
import { RIDE_STATUS_BADGE, RIDE_STATUS_LABEL } from '../../../lib/rideStatus'
import type { RideStatus } from '../../../lib/rideStatus'
import { KYC_STATUS_BADGE, KYC_STATUS_LABEL } from '../kycStatus'
import KycReviewDialog from './KycReviewDialog'

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

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
      {children}
    </Typography>
  )
}

function DriverDetailsContent({
  driver,
  onClose,
  onReview,
}: {
  driver: DriverDetail
  onClose: () => void
  onReview: () => void
}) {
  const vehicle =
    [driver.vehicleType, driver.vehicleNumber].filter(Boolean).join(' · ') || '—'

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
            {driver.name}
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <StatusBadge
              label={driver.isOnline ? 'Online' : 'Offline'}
              color={driver.isOnline ? 'success' : 'neutral'}
              size="small"
            />
          </Box>
        </Box>
        <IconButton onClick={onClose} aria-label="Close driver details" size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 3, py: 2 }}>
        <SectionTitle>Contact</SectionTitle>
        <Row label="Phone" value={driver.phone ?? '—'} />
        <Row label="Joined" value={driver.joinedAt ? new Date(driver.joinedAt).toLocaleDateString('en-IN') : '—'} />
        <Row
          label="Last active"
          value={driver.lastActiveAt ? new Date(driver.lastActiveAt).toLocaleString('en-IN') : '—'}
        />

        <Divider sx={{ my: 2 }} />

        <SectionTitle>Vehicle</SectionTitle>
        <Row label="Vehicle" value={vehicle} />
        <Row label="Model" value={driver.vehicleModel ?? '—'} />
        <Row label="Color" value={driver.vehicleColor ?? '—'} />

        <Divider sx={{ my: 2 }} />

        <SectionTitle>Current ride</SectionTitle>
        {driver.currentRide ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {driver.currentRide.id.slice(0, 8)}
              </Typography>
              <StatusBadge
                label={RIDE_STATUS_LABEL[driver.currentRide.status as RideStatus]}
                color={RIDE_STATUS_BADGE[driver.currentRide.status as RideStatus]}
                size="small"
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Rider: {driver.currentRide.rider ?? '—'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {driver.currentRide.pickup ?? '—'} → {driver.currentRide.destination ?? '—'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Fare: {driver.currentRide.fare ? formatFare(driver.currentRide.fare) : '—'}
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No active ride
          </Typography>
        )}

        <Divider sx={{ my: 2 }} />

        <SectionTitle>KYC</SectionTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <StatusBadge
            label={KYC_STATUS_LABEL[driver.kycStatus]}
            color={KYC_STATUS_BADGE[driver.kycStatus]}
            size="small"
          />
          <Button variant="outlined" size="small" onClick={onReview}>
            Review KYC
          </Button>
        </Box>

        <Divider sx={{ my: 2 }} />

        <SectionTitle>Stats</SectionTitle>
        <Row label="Total rides" value={driver.stats.totalRides.toLocaleString('en-IN')} />
        <Row label="Completed" value={driver.stats.completedRides.toLocaleString('en-IN')} />
        <Row label="Cancelled" value={driver.stats.cancelledRides.toLocaleString('en-IN')} />
        <Row label="Earnings" value={formatFare(driver.stats.totalEarnings)} />
      </Box>
    </Box>
  )
}

interface DriverDetailsDrawerProps {
  driverId: string | null
  onClose: () => void
}

export default function DriverDetailsDrawer({ driverId, onClose }: DriverDetailsDrawerProps) {
  const { data: driver, isLoading, isError, error, refetch } = useDriver(driverId)
  const [reviewOpen, setReviewOpen] = useState(false)

  return (
    <Drawer
      anchor="right"
      open={driverId !== null}
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
        <LoadingState message="Loading driver…" />
      ) : isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : driver ? (
        <DriverDetailsContent driver={driver} onClose={onClose} onReview={() => setReviewOpen(true)} />
      ) : null}
      <KycReviewDialog driverId={driverId} open={reviewOpen} onClose={() => setReviewOpen(false)} />
    </Drawer>
  )
}

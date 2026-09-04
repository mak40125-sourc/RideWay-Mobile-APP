import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { RideStatus } from '../../../lib/rideStatus'

type StageState = 'done' | 'active' | 'cancelled'

interface Stage {
  key: string
  label: string
  state: StageState
  time?: string
}

const STAGE_LABEL: Record<string, string> = {
  requested: 'Requested',
  searching: 'Searching',
  matched: 'Matched',
  driver_arrived: 'Driver arrived',
  trip_started: 'Trip started',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function stagesForStatus(status: RideStatus): Stage[] {
  switch (status) {
    case 'REQUESTED':
    case 'SEARCHING_DRIVER':
      return [
        { key: 'requested', label: STAGE_LABEL.requested, state: 'done' },
        { key: 'searching', label: STAGE_LABEL.searching, state: 'active' },
      ]
    case 'DRIVER_ASSIGNED':
      return [
        { key: 'requested', label: STAGE_LABEL.requested, state: 'done' },
        { key: 'searching', label: STAGE_LABEL.searching, state: 'done' },
        { key: 'matched', label: STAGE_LABEL.matched, state: 'done' },
        { key: 'driver_arrived', label: STAGE_LABEL.driver_arrived, state: 'active' },
      ]
    case 'DRIVER_ARRIVING':
    case 'RIDE_STARTED':
      return [
        { key: 'requested', label: STAGE_LABEL.requested, state: 'done' },
        { key: 'searching', label: STAGE_LABEL.searching, state: 'done' },
        { key: 'matched', label: STAGE_LABEL.matched, state: 'done' },
        { key: 'driver_arrived', label: STAGE_LABEL.driver_arrived, state: 'done' },
        { key: 'trip_started', label: STAGE_LABEL.trip_started, state: 'active' },
      ]
    case 'RIDE_COMPLETED':
      return [
        { key: 'requested', label: STAGE_LABEL.requested, state: 'done' },
        { key: 'searching', label: STAGE_LABEL.searching, state: 'done' },
        { key: 'matched', label: STAGE_LABEL.matched, state: 'done' },
        { key: 'driver_arrived', label: STAGE_LABEL.driver_arrived, state: 'done' },
        { key: 'trip_started', label: STAGE_LABEL.trip_started, state: 'done' },
        { key: 'completed', label: STAGE_LABEL.completed, state: 'done' },
      ]
    case 'CANCELLED':
      return [
        { key: 'requested', label: STAGE_LABEL.requested, state: 'done' },
        { key: 'cancelled', label: STAGE_LABEL.cancelled, state: 'cancelled' },
      ]
    case 'IDLE':
    default:
      return [{ key: 'requested', label: STAGE_LABEL.requested, state: 'active' }]
  }
}

interface RideTimelineProps {
  status: RideStatus
  times?: Partial<Record<string, string>>
}

export default function RideTimeline({ status, times }: RideTimelineProps) {
  const stages = stagesForStatus(status).map((stage) => ({
    ...stage,
    time: times?.[stage.key],
  }))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {stages.map((stage, index) => {
        const isLast = index === stages.length - 1
        const isDone = stage.state === 'done'
        const isActive = stage.state === 'active'
        const isCancelled = stage.state === 'cancelled'
        const indicatorColor = isCancelled
          ? 'error.main'
          : isDone || isActive
            ? 'primary.main'
            : 'divider'

        return (
          <Box key={stage.key} sx={{ display: 'flex', gap: 1.5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: 1,
                  borderColor: indicatorColor,
                  color: indicatorColor,
                  bgcolor: isActive ? 'primary.main' : 'background.paper',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {isDone && <CheckIcon sx={{ fontSize: 14 }} />}
                {isActive && (
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'background.paper' }} />
                )}
                {isCancelled && <CloseIcon sx={{ fontSize: 14 }} />}
              </Box>
              {!isLast && (
                <Box
                  sx={{
                    width: 2,
                    flexGrow: 1,
                    my: 0.5,
                    bgcolor: isDone ? 'primary.main' : 'divider',
                  }}
                />
              )}
            </Box>
            <Box sx={{ pb: isLast ? 0 : 1.5 }}>
              <Typography
                variant="body2"
                sx={{
                  color: isCancelled
                    ? 'error.main'
                    : isDone || isActive
                      ? 'text.primary'
                      : 'text.disabled',
                  fontWeight: isDone || isActive ? 600 : 400,
                }}
              >
                {stage.label}
              </Typography>
              {stage.time && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {stage.time}
                </Typography>
              )}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

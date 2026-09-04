import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Panel from '../../../app/components/Panel'
import StatusBadge from '../../../components/ui/StatusBadge'
import { ErrorState, LoadingState, EmptyState } from '../../../components/ui/Feedback'
import { useRides } from '../../dashboard/queries'
import { RIDE_STATUS_BADGE, RIDE_STATUS_LABEL } from '../../../lib/rideStatus'
import type { RideStatus } from '../../../lib/rideStatus'

const HEADER_STYLE = { color: 'text.secondary', fontWeight: 500 } as const

const ACTIVE_STATUSES: RideStatus[] = [
  'REQUESTED',
  'SEARCHING_DRIVER',
  'DRIVER_ASSIGNED',
  'DRIVER_ARRIVING',
  'RIDE_STARTED',
]

const shortId = (id: string) => id.slice(0, 8)

export default function ActiveRidesTable() {
  const { data, isLoading, isError, error, refetch } = useRides({ pageSize: 25, page: 1 })

  const active = (data?.rides ?? []).filter((ride) => ACTIVE_STATUSES.includes(ride.status))

  return (
    <Panel title="Active rides">
      {isLoading ? (
        <LoadingState message="Loading rides…" />
      ) : isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : active.length === 0 ? (
        <EmptyState message="No active rides" />
      ) : (
        <TableContainer>
          <Table sx={{ minWidth: 720 }} size="medium" aria-label="Active rides">
            <TableHead>
              <TableRow>
                <TableCell sx={HEADER_STYLE}>Ride ID</TableCell>
                <TableCell sx={HEADER_STYLE}>Status</TableCell>
                <TableCell sx={HEADER_STYLE}>Rider</TableCell>
                <TableCell sx={HEADER_STYLE}>Driver</TableCell>
                <TableCell sx={HEADER_STYLE}>Duration</TableCell>
                <TableCell sx={HEADER_STYLE}>Location</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {active.map((ride) => (
                <TableRow key={ride.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{shortId(ride.id)}</TableCell>
                  <TableCell>
                    <StatusBadge
                      label={RIDE_STATUS_LABEL[ride.status]}
                      color={RIDE_STATUS_BADGE[ride.status]}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{ride.rider}</TableCell>
                  <TableCell>{ride.driver ?? '—'}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {ride.durationMin != null ? `${ride.durationMin} min` : '—'}
                  </TableCell>
                  <TableCell>{ride.pickup ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Panel>
  )
}

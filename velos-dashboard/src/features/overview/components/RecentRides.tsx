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
import { formatFare } from '../../../rides/format'

const HEADER_STYLE = { color: 'text.secondary', fontWeight: 500 } as const

const shortId = (id: string) => id.slice(0, 8)

export default function RecentRides() {
  const { data, isLoading, isError, error, refetch } = useRides({ pageSize: 6, page: 1 })

  return (
    <Panel title="Recent Rides">
      {isLoading ? (
        <LoadingState message="Loading rides…" />
      ) : isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : (data?.rides.length ?? 0) === 0 ? (
        <EmptyState message="No rides yet" />
      ) : (
        <TableContainer>
          <Table size="medium" sx={{ minWidth: 640 }} aria-label="Recent rides">
            <TableHead>
              <TableRow>
                <TableCell sx={HEADER_STYLE}>Ride ID</TableCell>
                <TableCell sx={HEADER_STYLE}>Rider</TableCell>
                <TableCell sx={HEADER_STYLE}>Driver</TableCell>
                <TableCell align="right" sx={HEADER_STYLE}>
                  Fare
                </TableCell>
                <TableCell sx={HEADER_STYLE}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.rides.map((ride) => (
                <TableRow key={ride.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{shortId(ride.id)}</TableCell>
                  <TableCell>{ride.rider}</TableCell>
                  <TableCell>{ride.driver ?? '—'}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {ride.fare > 0 ? formatFare(ride.fare) : '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={RIDE_STATUS_LABEL[ride.status as RideStatus]}
                      color={RIDE_STATUS_BADGE[ride.status as RideStatus]}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Panel>
  )
}

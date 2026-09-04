import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Panel from '../../../app/components/Panel'
import { useDashboardStats } from '../../dashboard/queries'
import { ErrorState, LoadingState } from '../../../components/ui/Feedback'
import OperationalAttention from './OperationalAttention'

export default function OperationsPanel() {
  const { data: stats, isLoading, isError, error, refetch } = useDashboardStats()

  if (isLoading) return <LoadingState message="Loading live status…" />
  if (isError)
    return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const driversOnRide = stats
    ? Math.max(0, stats.activeRides - stats.searchingRides)
    : 0

  const ROWS: { label: string; value: number }[] = stats
    ? [
        { label: 'Online drivers', value: stats.onlineDrivers },
        { label: 'Available drivers', value: stats.availableDrivers },
        { label: 'Drivers on ride', value: driversOnRide },
        { label: 'Searching rides', value: stats.searchingRides },
        { label: 'Active rides', value: stats.activeRides },
      ]
    : []

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Panel title="Live status">
        <Box sx={{ flexGrow: 1 }}>
          {ROWS.map((row, index) => (
            <Box key={row.label}>
              {index > 0 && <Divider />}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  px: 3,
                  py: 1.5,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {row.label}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                >
                  {row.value}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Panel>

      <Panel title="Attention">
        <OperationalAttention />
      </Panel>
    </Box>
  )
}

import { Fragment } from 'react'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Surface from '../../../components/surfaces/Surface'
import { useDashboardStats } from '../../dashboard/queries'
import { ErrorState, LoadingState } from '../../../components/ui/Feedback'

const ITEMS: { label: string; key: keyof import('../../dashboard/types').DashboardStats }[] = [
  { label: 'Online drivers', key: 'onlineDrivers' },
  { label: 'Available drivers', key: 'availableDrivers' },
  { label: 'Active rides', key: 'activeRides' },
  { label: 'Searching rides', key: 'searchingRides' },
]

export default function OperationsSummary() {
  const { data: stats, isLoading, isError, error, refetch } = useDashboardStats()

  if (isLoading) return <LoadingState message="Loading summary…" />
  if (isError)
    return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  return (
    <Surface sx={{ display: 'flex', flexWrap: 'wrap' }}>
      {ITEMS.map((item, index) => (
        <Fragment key={item.key}>
          {index > 0 && (
            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
          )}
          <Box sx={{ flex: { xs: '0 0 50%', sm: 1 }, minWidth: 0, px: 3, py: 2 }}>
            <Typography variant="caption" color="text.secondary" component="div" noWrap>
              {item.label}
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', mt: 0.25 }}
            >
              {stats ? (stats[item.key] as number) : 0}
            </Typography>
          </Box>
        </Fragment>
      ))}
    </Surface>
  )
}

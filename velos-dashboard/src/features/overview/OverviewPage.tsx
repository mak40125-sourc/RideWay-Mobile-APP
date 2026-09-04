import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import PageHeader from '../../components/ui/PageHeader'
import { ErrorState, LoadingState } from '../../components/ui/Feedback'
import AttentionPanel from './components/AttentionPanel'
import MetricCard from './components/MetricCard'
import OperationsPreview from './components/OperationsPreview'
import RecentRides from './components/RecentRides'
import { useDashboardStats } from '../dashboard/queries'
import { formatFare } from '../rides/format'
import type { Metric } from './data/types'

const formatInt = (value: number) => value.toLocaleString('en-IN')

export default function OverviewPage() {
  const { data: stats, isLoading, isError, error, refetch } = useDashboardStats()

  const metrics: Metric[] = stats
    ? [
        {
          id: 'rides-today',
          label: 'Rides today',
          value: formatInt(stats.todayRides),
          footnote: `of ${formatInt(stats.totalRides)} all-time`,
        },
        {
          id: 'online-drivers',
          label: 'Online drivers',
          value: formatInt(stats.onlineDrivers),
          footnote: `of ${formatInt(stats.totalDrivers)} drivers`,
        },
        {
          id: 'active-rides',
          label: 'Active rides',
          value: formatInt(stats.activeRides),
          footnote: 'live now',
        },
        {
          id: 'revenue-today',
          label: 'Revenue today',
          value: formatFare(stats.todayRevenue),
          footnote: `of ${formatFare(stats.revenue)} all-time`,
        },
      ]
    : []

  return (
    <Box component="section" aria-label="Overview">
      <PageHeader title="Overview" subtitle="Your operations at a glance" />

      {isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <LoadingState message="Loading overview…" />
      ) : stats ? (
        <Grid container spacing={2}>
          {metrics.map((metric) => (
            <Grid key={metric.id} size={{ xs: 12, sm: 6, lg: 3 }} sx={{ minWidth: 0 }}>
              <MetricCard metric={metric} />
            </Grid>
          ))}

          <Grid size={{ xs: 12, lg: 9 }} sx={{ minWidth: 0 }}>
            <OperationsPreview stats={stats} />
          </Grid>

          <Grid size={{ xs: 12, lg: 3 }} sx={{ minWidth: 0 }}>
            <AttentionPanel />
          </Grid>

          <Grid size={12} sx={{ minWidth: 0 }}>
            <RecentRides />
          </Grid>
        </Grid>
      ) : null}
    </Box>
  )
}

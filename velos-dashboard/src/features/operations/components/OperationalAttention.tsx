import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import { velosRadii } from '../../../app/theme'
import { useDashboardStats, useRides } from '../../dashboard/queries'
import { ErrorState, LoadingState, EmptyState } from '../../../components/ui/Feedback'

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function OperationalAttention() {
  const theme = useTheme()
  const { data: stats } = useDashboardStats()
  const { data: rides, isLoading, isError, error, refetch } = useRides({ pageSize: 10, page: 1 })

  const searching = (rides?.rides ?? []).filter(
    (ride) => ride.status === 'SEARCHING_DRIVER' || ride.status === 'REQUESTED',
  )
  const offlineDrivers = stats ? Math.max(0, stats.totalDrivers - stats.onlineDrivers) : 0

  if (isLoading) return <LoadingState message="Loading attention…" />
  if (isError)
    return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const items: { id: string; icon: 'searching' | 'offline'; title: string; detail: string; time: string }[] =
    []

  searching.slice(0, 6).forEach((ride) => {
    items.push({
      id: `searching-${ride.id}`,
      icon: 'searching',
      title: `${ride.id.slice(0, 8)} · waiting for driver`,
      detail: `${ride.rider} · ${ride.pickup ?? 'Unknown pickup'}`,
      time: timeAgo(ride.createdAt),
    })
  })

  if (offlineDrivers > 0) {
    items.unshift({
      id: 'offline-drivers',
      icon: 'offline',
      title: `${offlineDrivers} driver${offlineDrivers === 1 ? '' : 's'} offline`,
      detail: 'Not currently accepting rides',
      time: 'now',
    })
  }

  if (items.length === 0) {
    return <EmptyState message="Nothing needs attention right now" />
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      {items.map((item, index) => {
        const colorKey = item.icon === 'searching' ? 'warning' : 'error'
        const color = theme.palette[colorKey].main
        return (
          <Box key={item.id}>
            {index > 0 && <Divider />}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.5 }}>
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: velosRadii.control,
                  bgcolor: alpha(color, 0.1),
                  color,
                  fontSize: 17,
                }}
              >
                {item.icon === 'searching' ? '⏱' : '⚠'}
              </Box>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {item.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap component="div">
                  {item.detail}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
                {item.time}
              </Typography>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

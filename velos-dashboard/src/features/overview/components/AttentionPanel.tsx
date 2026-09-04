import type { ComponentType } from 'react'
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined'
import WifiOffOutlinedIcon from '@mui/icons-material/WifiOffOutlined'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import type { SvgIconProps } from '@mui/material/SvgIcon'
import { alpha, useTheme } from '@mui/material/styles'
import Panel from '../../../app/components/Panel'
import { velosRadii } from '../../../app/theme'
import { useRides } from '../../dashboard/queries'
import { ErrorState, LoadingState, EmptyState } from '../../../components/ui/Feedback'
import type { AttentionKind } from '../data/types'

const KIND_META: Record<AttentionKind, { icon: ComponentType<SvgIconProps>; colorKey: 'warning' | 'error' }> = {
  searching: { icon: ScheduleOutlinedIcon, colorKey: 'warning' },
  offline: { icon: WifiOffOutlinedIcon, colorKey: 'error' },
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function AttentionPanel() {
  const theme = useTheme()
  const { data, isLoading, isError, error, refetch } = useRides({ pageSize: 8, page: 1 })

  const searching = (data?.rides ?? []).filter(
    (ride) => ride.status === 'SEARCHING_DRIVER' || ride.status === 'REQUESTED',
  )

  if (isLoading) return <LoadingState message="Loading attention…" />
  if (isError)
    return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  if (searching.length === 0) {
    return (
      <Panel title="Needs Attention">
        <EmptyState message="Nothing needs attention right now" />
      </Panel>
    )
  }

  return (
    <Panel title="Needs Attention">
      <Box sx={{ flexGrow: 1 }}>
        {searching.map((item, index) => {
          const meta = KIND_META.searching
          const Icon = meta.icon
          const color = theme.palette[meta.colorKey].main

          return (
            <Box key={item.id}>
              {index > 0 && <Divider />}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.75 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: velosRadii.control,
                    bgcolor: alpha(color, 0.1),
                    color,
                  }}
                >
                  <Icon fontSize="small" />
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {item.id} · waiting for driver
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {item.rider} · {item.pickup ?? 'Unknown pickup'}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
                  {timeAgo(item.createdAt)}
                </Typography>
              </Box>
            </Box>
          )
        })}
      </Box>
    </Panel>
  )
}

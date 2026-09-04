import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import Panel from '../../../app/components/Panel'
import { velosRadii } from '../../../app/theme'
import type { DashboardStats } from '../../dashboard/types'

const STATS: { label: string; key: keyof DashboardStats }[] = [
  { label: 'Active rides', key: 'activeRides' },
  { label: 'Available drivers', key: 'availableDrivers' },
  { label: 'Searching rides', key: 'searchingRides' },
]

export default function OperationsPreview({ stats }: { stats: DashboardStats }) {
  const theme = useTheme()

  return (
    <Panel title="Live Operations">
      <Box
        sx={{
          flexGrow: 1,
          m: 3,
          minHeight: { xs: 300, lg: 400 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          textAlign: 'center',
          borderRadius: velosRadii.surface,
          border: 1,
          borderStyle: 'dashed',
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.text.primary, 0.02),
          color: 'text.secondary',
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Live map view
        </Typography>
        <Typography variant="caption" color="text.disabled">
          Map integration arrives in a later phase
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', borderTop: 1, borderColor: 'divider' }}>
        {STATS.map((stat, index) => (
          <Box key={stat.key}>
            {index > 0 && <Divider orientation="vertical" flexItem />}
            <Box sx={{ flex: 1, minWidth: 0, px: 3, py: 2 }}>
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {stat.label}
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
              >
                {stats[stat.key] as number}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Panel>
  )
}

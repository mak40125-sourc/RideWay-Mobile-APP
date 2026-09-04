import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Surface from '../../../components/surfaces/Surface'
import StatusBadge from '../../../components/ui/StatusBadge'
import type { StatusBadgeColor } from '../../../components/ui/StatusBadge'
import type { Metric, TrendDirection } from '../data/types'

const TREND_BADGE: Record<TrendDirection, StatusBadgeColor> = {
  up: 'success',
  down: 'error',
  flat: 'neutral',
}

const formatChange = (value: number) => `${value > 0 ? '+' : ''}${value}%`

export default function MetricCard({ metric }: { metric: Metric }) {
  return (
    <Surface
      sx={{
        p: 2.5,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 2,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {metric.label}
      </Typography>
      <Box>
        <Typography
          variant="h4"
          component="p"
          sx={{
            fontWeight: 600,
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.15,
          }}
        >
          {metric.value}
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          {metric.footnote ? (
            <Typography variant="caption" color="text.secondary">
              {metric.footnote}
            </Typography>
          ) : metric.comparison ? (
            <>
              <StatusBadge
                label={formatChange(metric.change ?? 0)}
                color={TREND_BADGE[metric.trend ?? 'flat']}
                size="small"
              />
              <Typography variant="caption" color="text.secondary">
                {metric.comparison}
              </Typography>
            </>
          ) : null}
        </Box>
      </Box>
    </Surface>
  )
}

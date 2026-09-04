import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import { velosRadii } from '../../app/theme'

export type StatusBadgeColor = 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral'

export interface StatusBadgeProps {
  label: string
  color?: StatusBadgeColor
  size?: 'small' | 'medium'
}

/** Functional status indicator rendered as a subtle tinted pill with a colored dot. */
export default function StatusBadge({
  label,
  color = 'neutral',
  size = 'medium',
}: StatusBadgeProps) {
  const theme = useTheme()
  const isSmall = size === 'small'
  const tone = color === 'neutral' ? theme.palette.text.secondary : theme.palette[color].main

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        height: isSmall ? 22 : 26,
        px: isSmall ? 1 : 1.25,
        borderRadius: velosRadii.control,
        bgcolor: alpha(tone, 0.1),
        color: tone,
        border: `1px solid ${alpha(tone, 0.18)}`,
        whiteSpace: 'nowrap',
      }}
    >
      <Box
        sx={{
          width: isSmall ? 5 : 6,
          height: isSmall ? 5 : 6,
          borderRadius: '50%',
          bgcolor: tone,
          flexShrink: 0,
        }}
      />
      <Typography
        component="span"
        sx={{
          fontSize: isSmall ? 11 : 12,
          fontWeight: 600,
          letterSpacing: '0.01em',
          lineHeight: 1,
        }}
      >
        {label}
      </Typography>
    </Box>
  )
}

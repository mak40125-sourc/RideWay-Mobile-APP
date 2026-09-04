import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material/styles'
import Paper from '@mui/material/Paper'
import { velosRadii } from '../../app/theme'

export interface SurfaceProps {
  children?: ReactNode
  /** Lift the surface with a soft shadow instead of a subtle border. */
  elevated?: boolean
  sx?: SxProps<Theme>
}

/**
 * Primary workspace surface. The default building block for content cards.
 * Uses the standard surface radius and a soft border; pass `elevated` for a
 * softly lifted surface.
 */
export default function Surface({ children, elevated = false, sx }: SurfaceProps) {
  return (
    <Paper
      variant={elevated ? 'elevation' : 'outlined'}
      elevation={elevated ? 2 : 0}
      sx={{
        borderRadius: velosRadii.surface,
        bgcolor: 'surface',
        ...sx,
      }}
    >
      {children}
    </Paper>
  )
}

import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material/styles'
import Paper from '@mui/material/Paper'
import { useTheme } from '@mui/material/styles'
import { velosRadii } from '../../app/theme'

export interface FloatingSurfaceProps {
  children?: ReactNode
  sx?: SxProps<Theme>
}

/**
 * Elevated, translucent floating surface for controls that sit above the
 * workspace (popovers, drawers, map legends). Applies a soft backdrop blur,
 * the floating radius and a restrained shadow.
 */
export default function FloatingSurface({ children, sx }: FloatingSurfaceProps) {
  const theme = useTheme()

  return (
    <Paper
      elevation={2}
      sx={{
        borderRadius: velosRadii.floating,
        border: 1,
        borderColor: 'divider',
        backgroundColor: theme.palette.elevated,
        backdropFilter: 'blur(18px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.4)',
        boxShadow: theme.shadows[1],
        transition: theme.transitions.create(['box-shadow', 'background-color'], {
          duration: theme.transitions.duration.short,
        }),
        ...sx,
      }}
    >
      {children}
    </Paper>
  )
}

import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Surface from '../../components/surfaces/Surface'
import { velosRadii } from '../theme'

interface PanelProps {
  title: string
  action?: ReactNode
  children: ReactNode
  sx?: SxProps<Theme>
}

export default function Panel({ title, action, children, sx }: PanelProps) {
  return (
    <Surface
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: velosRadii.panel,
        ...sx,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: 3,
          py: 2,
        }}
      >
        <Typography variant="subtitle1">{title}</Typography>
        {action}
      </Box>
      <Divider />
      <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>
    </Surface>
  )
}

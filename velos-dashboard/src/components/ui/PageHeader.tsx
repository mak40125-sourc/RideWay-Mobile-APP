import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

/** Restrained page title with an optional subtitle and trailing action. */
export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <Box
      sx={{
        mb: 3,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 2,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" component="h1">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Box>
  )
}

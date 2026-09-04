import type { ReactNode } from 'react'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'

interface StateProps {
  message?: string
  onRetry?: () => void
}

/** Centered, padding-rich placeholder used for loading / empty / error states. */
function Centered({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        textAlign: 'center',
        color: 'text.secondary',
        px: 3,
        py: 6,
      }}
    >
      {children}
    </Box>
  )
}

export function LoadingState({ message = 'Loading…' }: StateProps) {
  return (
    <Centered>
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Centered>
  )
}

export function EmptyState({ message = 'No results' }: StateProps) {
  return (
    <Centered>
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Centered>
  )
}

export function ErrorState({ message, onRetry }: StateProps) {
  const theme = useTheme()
  return (
    <Centered>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          bgcolor: alpha(theme.palette.error.main, 0.1),
          color: 'error.main',
        }}
      >
        <ErrorOutlineIcon fontSize="small" />
      </Box>
      <Typography variant="body2" color="text.primary" sx={{ fontWeight: 600 }}>
        Couldn’t load data
      </Typography>
      {message && (
        <Typography variant="caption" color="text.secondary">
          {message}
        </Typography>
      )}
      {onRetry && (
        <Button variant="outlined" size="small" sx={{ mt: 0.5 }} onClick={onRetry}>
          Retry
        </Button>
      )}
    </Centered>
  )
}

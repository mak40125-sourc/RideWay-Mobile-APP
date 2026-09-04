import MenuIcon from '@mui/icons-material/Menu'
import SearchIcon from '@mui/icons-material/Search'
import AppBar from '@mui/material/AppBar'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import { velosRadii } from '../theme'

function SearchField() {
  const theme = useTheme()

  return (
    <>
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          height: 32,
          borderRadius: velosRadii.control,
          bgcolor: 'action.hover',
          border: 1,
          borderColor: 'divider',
          transition: theme.transitions.create(['border-color', 'box-shadow', 'background-color'], {
            duration: theme.transitions.duration.short,
          }),
          '&:focus-within': {
            borderColor: 'primary.main',
            boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.14)}`,
            bgcolor: 'background.paper',
          },
        }}
      >
        <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <InputBase
          placeholder="Search"
          aria-label="Search"
          inputProps={{ 'aria-label': 'Search' }}
          sx={{ width: 200, fontSize: '0.875rem' }}
        />
      </Box>
      <Tooltip title="Search">
        <IconButton aria-label="Search" sx={{ display: { xs: 'inline-flex', md: 'none' } }}>
          <SearchIcon />
        </IconButton>
      </Tooltip>
    </>
  )
}

function ProfileArea() {
  return (
    <Tooltip title="Profile">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar
          aria-hidden
          sx={{
            width: 30,
            height: 30,
            bgcolor: 'primary.main',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          OP
        </Avatar>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            Operator
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Admin
          </Typography>
        </Box>
      </Box>
    </Tooltip>
  )
}

export default function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <AppBar component="header">
      <Toolbar sx={{ gap: 2, px: { xs: 2, sm: 3 } }}>
        <IconButton
          edge="start"
          onClick={onMenuClick}
          sx={{ display: { lg: 'none' } }}
          aria-label="Open navigation"
        >
          <MenuIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }} />
        <SearchField />
        <ProfileArea />
      </Toolbar>
    </AppBar>
  )
}

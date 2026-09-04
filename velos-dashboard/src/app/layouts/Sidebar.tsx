import { NavLink, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { NAV_ITEMS } from './navigation'

function Brand() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box
        sx={{
          width: 30,
          height: 30,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 1,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          boxShadow: (t) => t.shadows[1],
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1 }}>
          V
        </Typography>
      </Box>
      <Typography variant="h6" noWrap>
        Velos
      </Typography>
    </Box>
  )
}

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation()

  const isActive = (path: string, end?: boolean) =>
    end ? pathname === path : pathname.startsWith(path)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ px: 1.75 }}>
        <Brand />
      </Toolbar>
      <Divider sx={{ mx: 2 }} />
      <List
        sx={{
          px: 1.25,
          py: 1.25,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.25,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                component={NavLink}
                to={item.path}
                end={item.end}
                selected={isActive(item.path, item.end)}
                onClick={onNavigate}
              >
                <ListItemIcon>
                  <Icon />
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>
    </Box>
  )
}

import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const SIDEBAR_WIDTH = 272

export default function AppLayout() {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'))
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleDrawerToggle = () => {
    setMobileOpen((open) => !open)
  }

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: 'background.default',
        overflowX: 'hidden',
      }}
    >
      <Box
        component="nav"
        sx={{ width: { lg: SIDEBAR_WIDTH }, flexShrink: { lg: 0 } }}
        aria-label="Main navigation"
      >
        {isDesktop ? (
          <Drawer
            variant="permanent"
            open
            sx={{
              '& .MuiDrawer-paper': {
                width: SIDEBAR_WIDTH,
                boxSizing: 'border-box',
              },
            }}
          >
            <Sidebar />
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': {
                width: SIDEBAR_WIDTH,
                boxSizing: 'border-box',
              },
            }}
          >
            <Sidebar onNavigate={handleDrawerToggle} />
          </Drawer>
        )}
      </Box>

      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Topbar onMenuClick={handleDrawerToggle} />
        <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, sm: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}

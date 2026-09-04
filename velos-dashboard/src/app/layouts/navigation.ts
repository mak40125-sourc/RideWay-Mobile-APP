import type { ComponentType } from 'react'
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined'
import RadarOutlinedIcon from '@mui/icons-material/RadarOutlined'
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined'
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined'
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'
import { ROUTES } from '../router/paths'

export interface NavItem {
  label: string
  path: string
  icon: ComponentType
  end?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Overview',
    path: ROUTES.root,
    icon: SpaceDashboardOutlinedIcon,
    end: true,
  },
  { label: 'Operations', path: ROUTES.operations, icon: RadarOutlinedIcon },
  { label: 'Rides', path: ROUTES.rides, icon: RouteOutlinedIcon },
  { label: 'Drivers', path: ROUTES.drivers, icon: GroupOutlinedIcon },
  { label: 'KYC Review', path: ROUTES.kyc, icon: VerifiedUserOutlinedIcon },
]

import { createBrowserRouter } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import DriversPage from '../../features/drivers/DriversPage'
import OperationsPage from '../../features/operations/OperationsPage'
import OverviewPage from '../../features/overview/OverviewPage'
import RidesPage from '../../features/rides/RidesPage'
import KycReviewPage from '../../features/kyc/KycReviewPage'
import { ROUTES } from './paths'

export const router = createBrowserRouter([
  {
    path: ROUTES.root,
    element: <AppLayout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: ROUTES.operations, element: <OperationsPage /> },
      { path: ROUTES.rides, element: <RidesPage /> },
      { path: ROUTES.drivers, element: <DriversPage /> },
      { path: ROUTES.kyc, element: <KycReviewPage /> },
    ],
  },
])

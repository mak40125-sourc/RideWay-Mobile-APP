import Chip from '@mui/material/Chip'
import { RIDE_STATUS_CHIP, RIDE_STATUS_LABEL } from '../../../lib/rideStatus'
import type { RideStatus } from '../../../lib/rideStatus'

interface RideStatusChipProps {
  status: RideStatus
}

export default function RideStatusChip({ status }: RideStatusChipProps) {
  return (
    <Chip label={RIDE_STATUS_LABEL[status]} color={RIDE_STATUS_CHIP[status]} size="small" variant="outlined" />
  )
}

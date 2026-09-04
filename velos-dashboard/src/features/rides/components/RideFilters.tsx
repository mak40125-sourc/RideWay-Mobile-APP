import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import { RIDE_STATUSES, RIDE_STATUS_LABEL } from '../types'
import type { RideStatusFilter } from '../types'

interface RideFiltersProps {
  search: string
  status: RideStatusFilter
  onSearchChange: (value: string) => void
  onStatusChange: (value: RideStatusFilter) => void
  onReset: () => void
}

export default function RideFilters({
  search,
  status,
  onSearchChange,
  onStatusChange,
  onReset,
}: RideFiltersProps) {
  const hasActiveFilters = search.length > 0 || status !== 'ALL'

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1.5,
        mb: 2,
      }}
    >
      <TextField
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search by ride ID, rider or driver"
        size="small"
        sx={{ width: { xs: '100%', sm: 320 } }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          },
        }}
      />
      <TextField
        select
        label="Status"
        size="small"
        value={status}
        onChange={(event) => onStatusChange(event.target.value as RideStatusFilter)}
        sx={{ width: { xs: '100%', sm: 200 } }}
      >
        <MenuItem value="ALL">All</MenuItem>
        {RIDE_STATUSES.map((item) => (
          <MenuItem key={item} value={item}>
            {RIDE_STATUS_LABEL[item]}
          </MenuItem>
        ))}
      </TextField>
      {hasActiveFilters && (
        <Button variant="text" size="small" startIcon={<CloseIcon />} onClick={onReset}>
          Reset
        </Button>
      )}
    </Box>
  )
}

import { useState } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import type { GridColDef } from '@mui/x-data-grid'
import SearchIcon from '@mui/icons-material/Search'
import Box from '@mui/material/Box'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Panel from '../../app/components/Panel'
import StatusBadge from '../../components/ui/StatusBadge'
import { ErrorState, EmptyState } from '../../components/ui/Feedback'
import { formatCreatedAt } from '../../rides/format'
import { useDrivers } from '../dashboard/queries'
import type { DriverListItem, KycStatus } from '../dashboard/types'
import { KYC_FILTER_OPTIONS, KYC_STATUS_BADGE, KYC_STATUS_LABEL } from './kycStatus'
import DriverDetailsDrawer from './components/DriverDetailsDrawer'

const columns: GridColDef<DriverListItem>[] = [
  { field: 'name', headerName: 'Driver', width: 180 },
  {
    field: 'phone',
    headerName: 'Phone',
    width: 150,
    valueFormatter: (value?: string | null) => value ?? '—',
  },
  {
    field: 'vehicle',
    headerName: 'Vehicle',
    width: 180,
    valueGetter: (_value, row) => [row.vehicleType, row.vehicleNumber].filter(Boolean).join(' · ') || '—',
  },
  {
    field: 'isOnline',
    headerName: 'Status',
    width: 120,
    renderCell: (params) => (
      <StatusBadge label={params.row.isOnline ? 'Online' : 'Offline'} color={params.row.isOnline ? 'success' : 'neutral'} size="small" />
    ),
  },
  {
    field: 'kycStatus',
    headerName: 'KYC',
    width: 150,
    renderCell: (params) => (
      <StatusBadge
        label={KYC_STATUS_LABEL[params.row.kycStatus]}
        color={KYC_STATUS_BADGE[params.row.kycStatus]}
        size="small"
      />
    ),
  },
  {
    field: 'currentRide',
    headerName: 'Current ride',
    width: 160,
    valueGetter: (_value, row) => (row.currentRide ? row.currentRide.id.slice(0, 8) : '—'),
  },
  {
    field: 'lastActiveAt',
    headerName: 'Last active',
    width: 160,
    valueFormatter: (value?: string | null) => (value ? formatCreatedAt(value) : '—'),
  },
  {
    field: 'joinedAt',
    headerName: 'Joined',
    width: 140,
    valueFormatter: (value: string) => formatCreatedAt(value),
  },
]

export default function DriversPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'online' | 'offline'>('all')
  const [kycStatus, setKycStatus] = useState<'all' | KycStatus>('all')
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const [paginationModel, setPaginationModel] = useState({ pageSize: 10, page: 0 })

  const { data, isLoading, isError, error, refetch } = useDrivers({
    search,
    status,
    kycStatus,
    page: paginationModel.page + 1,
    pageSize: paginationModel.pageSize,
  })

  const drivers = data?.drivers ?? []

  return (
    <Box component="section" aria-label="Drivers">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h1">
          Drivers
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Monitor Velos drivers and their availability
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <TextField
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPaginationModel((model) => ({ ...model, page: 0 }))
          }}
          placeholder="Search by name or vehicle number"
          size="small"
          sx={{ width: { xs: '100%', sm: 320 } }}
          slotProps={{
            input: {
              startAdornment: <SearchIcon fontSize="small" />,
            },
          }}
        />
        <TextField
          select
          label="Status"
          size="small"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as 'all' | 'online' | 'offline')
            setPaginationModel((model) => ({ ...model, page: 0 }))
          }}
          sx={{ width: { xs: '100%', sm: 200 } }}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="online">Online</MenuItem>
          <MenuItem value="offline">Offline</MenuItem>
        </TextField>
        <TextField
          select
          label="KYC"
          size="small"
          value={kycStatus}
          onChange={(event) => {
            setKycStatus(event.target.value as 'all' | KycStatus)
            setPaginationModel((model) => ({ ...model, page: 0 }))
          }}
          sx={{ width: { xs: '100%', sm: 200 } }}
        >
          {KYC_FILTER_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Panel title="All drivers">
        {isError ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : (data?.total ?? 0) === 0 && !isLoading ? (
          <EmptyState message="No drivers match your filters" />
        ) : (
          <DataGrid<DriverListItem>
            rows={drivers}
            columns={columns}
            getRowId={(row) => row.id}
            density="compact"
            autoHeight
            disableRowSelectionOnClick
            disableColumnMenu
            loading={isLoading}
            paginationMode="server"
            rowCount={data?.total ?? 0}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[10, 25, 50]}
            onRowClick={(params) => setSelectedDriverId(params.row.id)}
            sx={{
              border: 'none',
              '& .MuiDataGrid-columnHeaderTitle': {
                color: 'text.secondary',
                fontWeight: 500,
              },
              '& .MuiDataGrid-cell': {
                fontVariantNumeric: 'tabular-nums',
              },
              '& .MuiDataGrid-row': {
                cursor: 'pointer',
              },
            }}
          />
        )}
      </Panel>

      <DriverDetailsDrawer driverId={selectedDriverId} onClose={() => setSelectedDriverId(null)} />
    </Box>
  )
}

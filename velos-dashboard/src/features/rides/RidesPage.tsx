import { useMemo, useState } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import type { GridColDef } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Panel from '../../app/components/Panel'
import { ErrorState, EmptyState } from '../../components/ui/Feedback'
import { formatCreatedAt, formatFare } from './format'
import RideDetailsDrawer from './components/RideDetailsDrawer'
import RideFilters from './components/RideFilters'
import RideStatusChip from './components/RideStatusChip'
import { useRides } from '../dashboard/queries'
import { RIDE_TYPE_LABEL } from './types'
import type { Ride, RideStatusFilter, RideType } from './types'

const columns: GridColDef<Ride>[] = [
  { field: 'id', headerName: 'Ride ID', width: 112 },
  { field: 'rider', headerName: 'Rider', width: 160 },
  {
    field: 'driver',
    headerName: 'Driver',
    width: 160,
    valueFormatter: (value?: string | null) => value ?? '—',
  },
  {
    field: 'type',
    headerName: 'Ride type',
    width: 110,
    valueFormatter: (value?: RideType | null) => (value ? RIDE_TYPE_LABEL[value] : '—'),
  },
  { field: 'pickup', headerName: 'Pickup', width: 200 },
  { field: 'destination', headerName: 'Destination', width: 210 },
  {
    field: 'fare',
    headerName: 'Fare',
    width: 104,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (value: number) => formatFare(value),
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 150,
    renderCell: (params) => <RideStatusChip status={params.row.status} />,
  },
  {
    field: 'createdAt',
    headerName: 'Created',
    width: 150,
    valueFormatter: (value: string) => formatCreatedAt(value),
  },
]

export default function RidesPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<RideStatusFilter>('ALL')
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null)
  const [paginationModel, setPaginationModel] = useState({ pageSize: 10, page: 0 })

  const { data, isLoading, isError, error, refetch } = useRides({
    search,
    status: status === 'ALL' ? 'ALL' : status,
    page: paginationModel.page + 1,
    pageSize: paginationModel.pageSize,
  })

  const rides = useMemo(() => data?.rides ?? [], [data])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPaginationModel((model) => ({ ...model, page: 0 }))
  }

  const handleStatusChange = (value: RideStatusFilter) => {
    setStatus(value)
    setPaginationModel((model) => ({ ...model, page: 0 }))
  }

  const handleReset = () => {
    setSearch('')
    setStatus('ALL')
    setPaginationModel((model) => ({ ...model, page: 0 }))
  }

  return (
    <Box component="section" aria-label="Rides">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h1">
          Rides
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Monitor and inspect Velos rides
        </Typography>
      </Box>

      <RideFilters
        search={search}
        status={status}
        onSearchChange={handleSearchChange}
        onStatusChange={handleStatusChange}
        onReset={handleReset}
      />

      <Panel title="All rides">
        {isError ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : (data?.total ?? 0) === 0 && !isLoading ? (
          <EmptyState message="No rides match your filters" />
        ) : (
          <DataGrid<Ride>
            rows={rides}
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

      <RideDetailsDrawer rideId={selectedRideId} onClose={() => setSelectedRideId(null)} />
    </Box>
  )
}

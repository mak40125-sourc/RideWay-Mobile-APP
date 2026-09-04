import { useMemo, useState } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import type { GridColDef } from '@mui/x-data-grid'
import SearchIcon from '@mui/icons-material/Search'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Panel from '../../app/components/Panel'
import StatusBadge from '../../components/ui/StatusBadge'
import { ErrorState, EmptyState } from '../../components/ui/Feedback'
import { formatCreatedAt } from '../../rides/format'
import { useDrivers } from '../dashboard/queries'
import type { DriverListItem, KycStatus } from '../dashboard/types'
import { KYC_FILTER_OPTIONS, KYC_STATUS_BADGE, KYC_STATUS_LABEL } from '../drivers/kycStatus'
import KycReviewDialog from '../drivers/components/KycReviewDialog'

// Attention states are surfaced first in the default queue so reviewers see the
// applications that actually need a decision.
const KYC_PRIORITY: Record<KycStatus, number> = {
  pending: 0,
  in_review: 1,
  needs_correction: 2,
  verified: 3,
  rejected: 4,
}

export default function KycReviewPage() {
  const [search, setSearch] = useState('')
  const [kycStatus, setKycStatus] = useState<'all' | KycStatus>('all')
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [paginationModel, setPaginationModel] = useState({ pageSize: 10, page: 0 })

  const { data, isLoading, isError, error, refetch } = useDrivers({
    search,
    kycStatus,
    page: paginationModel.page + 1,
    pageSize: paginationModel.pageSize,
  })

  const drivers = useMemo(() => {
    const rows = data?.drivers ?? []
    return [...rows].sort((a, b) => {
      const diff = KYC_PRIORITY[a.kycStatus] - KYC_PRIORITY[b.kycStatus]
      if (diff !== 0) return diff
      return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
    })
  }, [data])

  const columns: GridColDef<DriverListItem>[] = [
    { field: 'name', headerName: 'Driver', width: 180 },
    {
      field: 'vehicle',
      headerName: 'Vehicle',
      width: 180,
      valueGetter: (_value, row) => [row.vehicleType, row.vehicleNumber].filter(Boolean).join(' · ') || '—',
    },
    {
      field: 'kycStatus',
      headerName: 'KYC Status',
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
      field: 'documentsCount',
      headerName: 'Documents',
      width: 120,
      valueFormatter: (value: number) => (value > 0 ? `${value} submitted` : 'None'),
    },
    {
      field: 'joinedAt',
      headerName: 'Date',
      width: 140,
      valueFormatter: (value: string) => formatCreatedAt(value),
    },
    {
      field: 'action',
      headerName: 'Action',
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Button variant="outlined" size="small" onClick={() => setReviewId(params.row.id)}>
          Review
        </Button>
      ),
    },
  ]

  const noAttention = (data?.total ?? 0) === 0 && !isLoading

  return (
    <Box component="section" aria-label="KYC Review">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h1">
          KYC Review
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Review driver KYC submissions and approve or reject applications
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

      <Panel title="Applications">
        {isError ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : noAttention ? (
          <EmptyState message="No KYC applications require review." />
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
            onRowClick={(params) => setReviewId(params.row.id)}
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

      <KycReviewDialog driverId={reviewId} open={reviewId !== null} onClose={() => setReviewId(null)} />
    </Box>
  )
}

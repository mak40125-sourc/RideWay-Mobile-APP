import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import PageHeader from '../../components/ui/PageHeader'
import ActiveRidesTable from './components/ActiveRidesTable'
import OperationsMap from './components/OperationsMap'
import OperationsPanel from './components/OperationsPanel'
import OperationsSummary from './components/OperationsSummary'

export default function OperationsPage() {
  return (
    <Box component="section" aria-label="Operations">
      <PageHeader title="Operations" subtitle="Live view of the Velos network" />

      <Box sx={{ mb: 2 }}>
        <OperationsSummary />
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 9 }} sx={{ minWidth: 0 }}>
          <OperationsMap />
        </Grid>

        <Grid size={{ xs: 12, lg: 3 }} sx={{ minWidth: 0 }}>
          <OperationsPanel />
        </Grid>

        <Grid size={12} sx={{ minWidth: 0 }}>
          <ActiveRidesTable />
        </Grid>
      </Grid>
    </Box>
  )
}

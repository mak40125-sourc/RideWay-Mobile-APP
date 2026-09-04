import { useState } from 'react'
import type { ReactNode } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import StatusBadge from '../../../components/ui/StatusBadge'
import { ErrorState, LoadingState } from '../../../components/ui/Feedback'
import { formatCreatedAt } from '../../rides/format'
import { useDriverKyc, useReviewDriverKyc } from '../../dashboard/queries'
import type { DriverKyc, KycReviewEvent } from '../../dashboard/types'
import { KYC_DOCUMENT_LABEL, KYC_STATUS_LABEL, EXPECTED_DOCUMENT_TYPES } from '../kycStatus'

type ConfirmAction = 'approve' | 'reject' | 'request_correction' | null

const HISTORY_ACTION_LABEL: Record<string, string> = {
  start_review: 'Review started',
  approve: 'KYC approved',
  reject: 'KYC rejected',
  request_correction: 'Correction requested',
}

const CONFIRM_COPY: Record<string, { title: string; confirm: string; reason: boolean }> = {
  approve: { title: 'Approve KYC for this driver?', confirm: 'Approve KYC', reason: false },
  reject: { title: 'Reject KYC', confirm: 'Reject KYC', reason: true },
  request_correction: {
    title: 'Request correction from this driver?',
    confirm: 'Request Correction',
    reason: true,
  },
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
      {children}
    </Typography>
  )
}

function latestDocForType(kyc: DriverKyc, type: string) {
  return kyc.documents
    .filter((doc) => doc.documentType === type)
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0]
}

function HistoryRow({ event }: { event: KycReviewEvent }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, py: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {HISTORY_ACTION_LABEL[event.action] ?? event.action}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {new Date(event.createdAt).toLocaleString('en-IN')}
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {event.previousStatus ? KYC_STATUS_LABEL[event.previousStatus] : '—'} →{' '}
        {KYC_STATUS_LABEL[event.newStatus]}
        {event.reviewer ? ` · by ${event.reviewer}` : ''}
      </Typography>
      {event.reason && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          Reason: {event.reason}
        </Typography>
      )}
    </Box>
  )
}

export default function KycReviewDialog({
  driverId,
  open,
  onClose,
}: {
  driverId: string | null
  open: boolean
  onClose: () => void
}) {
  const { data: kyc, isLoading, isError, error, refetch } = useDriverKyc(driverId)
  const review = useReviewDriverKyc()
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [reason, setReason] = useState('')
  const [success, setSuccess] = useState<string | null>(null)

  const closeConfirm = () => {
    setConfirmAction(null)
    setReason('')
  }

  const submitAction = () => {
    if (!driverId || !confirmAction) return
    if (CONFIRM_COPY[confirmAction].reason && !reason.trim()) return
    review.mutate(
      { driverId, payload: { action: confirmAction, reason: reason.trim() || undefined } },
      {
        onSuccess: () => {
          setSuccess(
            confirmAction === 'approve'
              ? 'KYC approved'
              : confirmAction === 'reject'
                ? 'KYC rejected'
                : 'Correction requested',
          )
          closeConfirm()
        },
      },
    )
  }

  const confirmMeta = confirmAction ? CONFIRM_COPY[confirmAction] : null

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            KYC Review
          </Typography>
          {kyc && (
            <Typography variant="body2" color="text.secondary">
              {kyc.driverId.slice(0, 8)}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} aria-label="Close KYC review" size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {isLoading ? (
          <LoadingState message="Loading KYC…" />
        ) : isError ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : !kyc ? (
          <Typography variant="body2" color="text.secondary">
            No KYC data found for this driver.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <SectionTitle>Driver</SectionTitle>
              <Typography variant="body2">Status: {KYC_STATUS_LABEL[kyc.kycStatus]}</Typography>
            </Box>

            <Box>
              <SectionTitle>Documents</SectionTitle>
              {EXPECTED_DOCUMENT_TYPES.map((type) => {
                const doc = latestDocForType(kyc, type)
                return (
                  <Box
                    key={type}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                      py: 1,
                    }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {KYC_DOCUMENT_LABEL[type] ?? type}
                      </Typography>
                      {doc ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                          <StatusBadge
                            label={doc.status}
                            color={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'error' : 'neutral'}
                            size="small"
                          />
                          {doc.uploadedAt && (
                            <Typography variant="caption" color="text.secondary">
                              {formatCreatedAt(doc.uploadedAt)}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Not submitted
                        </Typography>
                      )}
                    </Box>
                    {doc?.url ? (
                      <Button
                        variant="outlined"
                        size="small"
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View
                      </Button>
                    ) : (
                      <Button variant="outlined" size="small" disabled>
                        View
                      </Button>
                    )}
                  </Box>
                )
              })}
            </Box>

            <Box>
              <SectionTitle>Audit history</SectionTitle>
              {kyc.history.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No review activity yet
                </Typography>
              ) : (
                kyc.history.map((event, index) => (
                  <Box key={event.id}>
                    {index > 0 && <Box sx={{ borderTop: 1, borderColor: 'divider' }} />}
                    <HistoryRow event={event} />
                  </Box>
                ))
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      {kyc && !isError && (
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button
            variant="outlined"
            color="error"
            disabled={review.isPending}
            onClick={() => setConfirmAction('reject')}
          >
            Reject
          </Button>
          <Button
            variant="outlined"
            color="info"
            disabled={review.isPending}
            onClick={() => setConfirmAction('request_correction')}
          >
            Request Correction
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            variant="contained"
            color="success"
            disabled={review.isPending}
            onClick={() => setConfirmAction('approve')}
          >
            Approve KYC
          </Button>
        </DialogActions>
      )}

      <Dialog open={!!confirmAction} onClose={closeConfirm} fullWidth maxWidth="xs">
        <DialogTitle>{confirmMeta?.title}</DialogTitle>
        <DialogContent>
          {review.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {(review.error as Error).message}
            </Alert>
          )}
          {confirmMeta?.reason && (
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={2}
              label={
                confirmAction === 'reject' ? 'Reason for rejection' : 'Reason for correction'
              }
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={!reason.trim()}
              helperText={!reason.trim() ? 'A reason is required' : undefined}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeConfirm} disabled={review.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={confirmAction === 'reject' ? 'error' : 'primary'}
            disabled={review.isPending || (confirmMeta?.reason && !reason.trim())}
            onClick={submitAction}
          >
            {confirmMeta?.confirm}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!success}
        autoHideDuration={3000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
    </Dialog>
  )
}

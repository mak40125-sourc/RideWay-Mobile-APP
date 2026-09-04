import type { StatusBadgeColor } from '../../components/ui/StatusBadge'
import type { KycStatus } from '../dashboard/types'

export const KYC_STATUS_LABEL: Record<KycStatus, string> = {
  pending: 'Pending',
  in_review: 'Under Review',
  verified: 'Approved',
  needs_correction: 'Needs Correction',
  rejected: 'Rejected',
}

export const KYC_STATUS_BADGE: Record<KycStatus, StatusBadgeColor> = {
  pending: 'neutral',
  in_review: 'warning',
  verified: 'success',
  needs_correction: 'info',
  rejected: 'error',
}

export const KYC_DOCUMENT_LABEL: Record<string, string> = {
  license: 'Driving Licence',
  id_proof: 'Government ID',
  rc: 'Vehicle RC',
  insurance: 'Vehicle Insurance',
}

export const KYC_FILTER_OPTIONS: { value: 'all' | KycStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_review', label: 'Under Review' },
  { value: 'verified', label: 'Approved' },
  { value: 'needs_correction', label: 'Needs Correction' },
  { value: 'rejected', label: 'Rejected' },
]

// Document types we expect a driver to have submitted. Documents not present
// in the backend response are shown as "Not submitted".
export const EXPECTED_DOCUMENT_TYPES = ['license', 'id_proof', 'rc', 'insurance'] as const

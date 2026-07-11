export type DriverStatus = 'OFFLINE' | 'ONLINE_IDLE' | 'REQUEST_RECEIVED' | 'ACCEPTED' | 'NAVIGATING_TO_PICKUP' | 'ARRIVED_AT_PICKUP' | 'RIDE_STARTED' | 'NAVIGATING_TO_DROP' | 'RIDE_COMPLETED';

export type KYCStatus = 'pending' | 'in_review' | 'verified' | 'rejected';

export interface Driver {
  id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_number: string;
  vehicle_model?: string;
  vehicle_color?: string;
  is_online: boolean;
  kyc_status: KYCStatus;
  is_verified: boolean;
  wallet_balance: number;
  location?: unknown;
  last_pings_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface DriverLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface DriverLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}
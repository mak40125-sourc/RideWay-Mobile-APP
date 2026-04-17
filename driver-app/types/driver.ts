export type DriverStatus = 'OFFLINE' | 'ONLINE_IDLE' | 'REQUEST_RECEIVED' | 'ACCEPTED' | 'NAVIGATING_TO_PICKUP' | 'ARRIVED_AT_PICKUP' | 'RIDE_STARTED' | 'NAVIGATING_TO_DROP' | 'RIDE_COMPLETED';

export type VehicleStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type KYCStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Driver {
  id: string;
  phone: string;
  name: string;
  email?: string;
  profile_photo?: string;
  kyc_status: KYCStatus;
  vehicle_status: VehicleStatus;
  vehicle_info?: VehicleInfo;
  is_online: boolean;
  rating: number;
  total_rides: number;
  created_at: string;
}

export interface VehicleInfo {
  vehicle_type: string;
  vehicle_number: string;
  vehicle_model: string;
  vehicle_color: string;
}

export interface DriverLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}
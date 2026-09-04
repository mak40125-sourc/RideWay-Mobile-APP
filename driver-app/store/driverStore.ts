import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Driver, DriverStatus, DriverLocation } from '../types/driver';

export interface KYCDocument {
  document_type: string;
  document_url: string;
}

interface DriverState {
  driver: Driver | null;
  status: DriverStatus;
  location: DriverLocation | null;
  is_online: boolean;
  earnings_today: number;
  kycDocuments: KYCDocument[];
  _hasHydrated: boolean;
  
  setDriver: (driver: Driver) => void;
  setStatus: (status: DriverStatus) => void;
  setLocation: (location: DriverLocation) => void;
  setOnline: (is_online: boolean) => void;
  setEarningsToday: (amount: number) => void;
  setVehicleInfo: (info: { vehicle_type: string; vehicle_number: string; vehicle_model?: string; vehicle_color?: string }) => void;
  addKYCDocument: (doc: KYCDocument) => void;
  clearKYCDocuments: () => void;
  logout: () => void;
}

export const useDriverStore = create<DriverState>()(
  persist(
    (set) => ({
      driver: null,
      status: 'OFFLINE',
      location: null,
      is_online: false,
      earnings_today: 0,
      kycDocuments: [],
      _hasHydrated: false,

      setDriver: (driver) => set({ driver }),
      setStatus: (status) => set({ status }),
      setLocation: (location) => set({ location }),
      setOnline: (is_online) => set({ is_online }),
      setEarningsToday: (amount) => set({ earnings_today: amount }),
      setVehicleInfo: (info) => set((state) => ({
        driver: state.driver ? { ...state.driver, ...info } : null
      })),
      addKYCDocument: (doc) => set((state) => ({
        kycDocuments: [...state.kycDocuments, doc]
      })),
      clearKYCDocuments: () => set({ kycDocuments: [] }),
      logout: () => set({ driver: null, status: 'OFFLINE', is_online: false, location: null, earnings_today: 0, kycDocuments: [] }),
    }),
    {
      name: 'driver-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        driver: state.driver,
        status: state.status,
        location: state.location,
        is_online: state.is_online,
        earnings_today: state.earnings_today,
        kycDocuments: state.kycDocuments,
      }),
      onRehydrateStorage: () => () => {
        useDriverStore.setState({ _hasHydrated: true });
      },
    }
  )
);

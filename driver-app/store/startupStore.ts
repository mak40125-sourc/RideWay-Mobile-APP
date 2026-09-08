import { create } from 'zustand';

export type StartupPhase =
  | 'BOOTING'
  | 'AUTH_HYDRATING'
  | 'AUTH_READY'
  | 'PERSISTED_HYDRATING'
  | 'PERSISTED_READY'
  | 'RIDE_RECONCILING'
  | 'RIDE_RECONCILED'
  | 'NAV_RECONCILING'
  | 'APP_READY';

export type RideRecoveryState = 'UNRESOLVED' | 'FOUND' | 'NOT_FOUND' | 'FAILED';
export type NavRecoveryState = 'UNRESOLVED' | 'NOT_REQUIRED' | 'RECONSTRUCTED' | 'PENDING_GPS' | 'FAILED';

interface StartupState {
  phase: StartupPhase;
  rideRecovery: RideRecoveryState;
  navRecovery: NavRecoveryState;
  appReady: boolean;
  rideReconciled: boolean;
  recoveryGeneration: number;
  setPhase: (phase: StartupPhase) => void;
  setRideRecovery: (s: RideRecoveryState) => void;
  setNavRecovery: (s: NavRecoveryState) => void;
  markAppReady: () => void;
  resetForAuthLoss: () => void;
  nextGeneration: () => number;
}

export const useStartupStore = create<StartupState>()((set, get) => ({
  phase: 'BOOTING',
  rideRecovery: 'UNRESOLVED',
  navRecovery: 'UNRESOLVED',
  appReady: false,
  rideReconciled: false,
  recoveryGeneration: 0,
  setPhase: (phase) => set({ phase }),
  setRideRecovery: (s) =>
    set((state) => ({
      rideRecovery: s,
      rideReconciled: s === 'FOUND' || s === 'NOT_FOUND',
      phase: s === 'FOUND' || s === 'NOT_FOUND' ? 'RIDE_RECONCILED' : state.phase,
    })),
  setNavRecovery: (s) => set({ navRecovery: s }),
  markAppReady: () => set({ appReady: true, phase: 'APP_READY' }),
  resetForAuthLoss: () =>
    set({
      phase: 'AUTH_READY',
      rideRecovery: 'UNRESOLVED',
      navRecovery: 'UNRESOLVED',
      appReady: false,
      rideReconciled: false,
    }),
  nextGeneration: () => {
    const next = get().recoveryGeneration + 1;
    set({ recoveryGeneration: next });
    return next;
  },
}));

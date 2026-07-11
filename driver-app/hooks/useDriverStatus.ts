import { useCallback } from 'react';
import { useDriverStore } from '../store/driverStore';
import { useWalletStore } from '../store/walletStore';
import type { DriverStatus } from '../types/driver';

const VALID_TRANSITIONS: Record<DriverStatus, DriverStatus[]> = {
  OFFLINE: ['ONLINE_IDLE'],
  ONLINE_IDLE: ['OFFLINE', 'REQUEST_RECEIVED'],
  REQUEST_RECEIVED: ['ACCEPTED', 'ONLINE_IDLE'],
  ACCEPTED: ['NAVIGATING_TO_PICKUP', 'ONLINE_IDLE'],
  NAVIGATING_TO_PICKUP: ['ARRIVED_AT_PICKUP', 'ONLINE_IDLE'],
  ARRIVED_AT_PICKUP: ['RIDE_STARTED', 'ONLINE_IDLE'],
  RIDE_STARTED: ['NAVIGATING_TO_DROP', 'ONLINE_IDLE'],
  NAVIGATING_TO_DROP: ['RIDE_COMPLETED', 'ONLINE_IDLE'],
  RIDE_COMPLETED: ['ONLINE_IDLE'],
};

export const useDriverStatus = () => {
  const { status, setStatus } = useDriverStore();
  const { balance } = useWalletStore();
  const MIN_BALANCE = 50;

  const canTransitionTo = useCallback((nextStatus: DriverStatus): boolean => {
    const allowed = VALID_TRANSITIONS[status];
    if (!allowed?.includes(nextStatus)) return false;

    if (nextStatus === 'ONLINE_IDLE' && balance < MIN_BALANCE) return false;

    return true;
  }, [status, balance]);

  const safeTransitionTo = useCallback((nextStatus: DriverStatus): boolean => {
    if (!canTransitionTo(nextStatus)) return false;
    setStatus(nextStatus);
    return true;
  }, [canTransitionTo, setStatus]);

  const canGoOnline = balance >= MIN_BALANCE;
  const isActive = status !== 'OFFLINE';

  return {
    status,
    canTransitionTo,
    safeTransitionTo,
    canGoOnline,
    isActive,
  };
};

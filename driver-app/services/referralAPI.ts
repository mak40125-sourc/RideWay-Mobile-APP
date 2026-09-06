import { api } from './api';

export type ReferralCodeResp = { referralCode: string; referralUrl: string; driverId: string };
export type ReferralStats = { referred: number; pending: number; qualified: number; rewarded: number; earned: number; completedFirstRide: number; referralCode: string; referralUrl: string; rewardAmount: number; expiryDays: number };

export const referralAPI = {
  getCode: () => api.get<ReferralCodeResp>('/referrals/code'),
  getStats: () => api.get<ReferralStats>('/referrals/stats'),
  getHistory: (limit=20, offset=0) => api.get<any[]>(`/referrals/history?limit=${limit}&offset=${offset}`),
  getAll: (limit=20, offset=0) => api.get<any[]>(`/referrals?limit=${limit}&offset=${offset}`),
};

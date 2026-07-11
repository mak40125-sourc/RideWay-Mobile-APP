import { supabase } from '../lib/supabase';
import type { WalletTransaction } from '../types/wallet';

export const walletAPI = {
  getBalance: async (driverId: string): Promise<number> => {
    const { data } = await supabase
      .from('wallet')
      .select('balance')
      .eq('driver_id', driverId)
      .single();
    return data?.balance || 0;
  },

  getTransactions: async (driverId: string): Promise<WalletTransaction[]> => {
    const { data } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });
    return data || [];
  },

  recharge: async (driverId: string, amount: number) => {
    return supabase.rpc('recharge_wallet', {
      p_driver_id: driverId,
      p_amount: amount,
    });
  },

  deductCommission: async (driverId: string, amount: number, rideId: string) => {
    return supabase.rpc('deduct_commission', {
      p_driver_id: driverId,
      p_amount: amount,
      p_ride_id: rideId,
    });
  },

  subscribeToWalletUpdates: (driverId: string, callback: (balance: number) => void) => {
    return supabase
      .channel(`wallet-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wallet',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          callback(payload.new.balance);
        }
      )
      .subscribe();
  },
};

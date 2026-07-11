import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WalletTransaction } from '../types/wallet';

const MINIMUM_BALANCE = 50;

interface WalletState {
  balance: number;
  transactions: WalletTransaction[];
  is_loading: boolean;
  
  setBalance: (balance: number) => void;
  addTransaction: (transaction: WalletTransaction) => void;
  setTransactions: (transactions: WalletTransaction[]) => void;
  setLoading: (loading: boolean) => void;
  getIsLowBalance: () => boolean;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      balance: 0,
      transactions: [],
      is_loading: false,

      setBalance: (balance) => set({ balance }),
      addTransaction: (transaction) => set((state) => ({
        transactions: [transaction, ...state.transactions],
        balance: transaction.balance_after,
      })),
      setTransactions: (transactions) => set({ transactions }),
      setLoading: (loading) => set({ is_loading: loading }),
      getIsLowBalance: () => get().balance < MINIMUM_BALANCE,
    }),
    {
      name: 'wallet-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ balance: state.balance }),
    }
  )
);

export const WALLET_MINIMUM = MINIMUM_BALANCE;
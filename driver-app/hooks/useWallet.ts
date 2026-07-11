import { useCallback } from 'react';
import { useWalletStore } from '../store/walletStore';
import { walletAPI } from '../services/walletAPI';
import { WALLET_MINIMUM } from '../constants/wallet';

export const useWallet = () => {
  const { balance, transactions, setBalance, addTransaction, setTransactions, setLoading } = useWalletStore();

  const isLowBalance = balance < WALLET_MINIMUM;

  const fetchBalance = useCallback(async (driverId: string) => {
    setLoading(true);
    try {
      const bal = await walletAPI.getBalance(driverId);
      setBalance(bal);
    } finally {
      setLoading(false);
    }
  }, [setBalance, setLoading]);

  const fetchTransactions = useCallback(async (driverId: string) => {
    setLoading(true);
    try {
      const txns = await walletAPI.getTransactions(driverId);
      setTransactions(txns);
    } finally {
      setLoading(false);
    }
  }, [setTransactions, setLoading]);

  const recharge = useCallback(async (driverId: string, amount: number) => {
    setLoading(true);
    try {
      await walletAPI.recharge(driverId, amount);
      await fetchBalance(driverId);
    } finally {
      setLoading(false);
    }
  }, [fetchBalance, setLoading]);

  return {
    balance,
    transactions,
    isLowBalance,
    minimumBalance: WALLET_MINIMUM,
    fetchBalance,
    fetchTransactions,
    recharge,
    addTransaction,
  };
};

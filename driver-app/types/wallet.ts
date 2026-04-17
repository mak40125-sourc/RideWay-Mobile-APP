export type TransactionType = 'COMMISSION_DEBIT' | 'WALLET_RECHARGE' | 'INCENTIVE_CREDIT' | 'ADJUSTMENT' | 'REFUND';

export interface WalletTransaction {
  id: string;
  driver_id: string;
  type: TransactionType;
  amount: number;
  balance_after: number;
  ride_id?: string;
  description: string;
  created_at: string;
}

export interface WalletState {
  balance: number;
  minimum_balance: number;
  is_low_balance: boolean;
  transactions: WalletTransaction[];
  is_loading: boolean;
}
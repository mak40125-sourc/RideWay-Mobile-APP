import { api } from "../services/api";

export type WalletTransaction = {
  id: string;
  user_id: string;
  ride_id: string | null;
  amount: number;
  type: "credit" | "debit";
  description: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  ride_id: string;
  amount: number;
  status: "pending" | "completed" | "failed" | "refunded";
  method: string | null;
  transaction_id: string | null;
  created_at: string;
};

export type WalletBalance = {
  balance: number;
};

export async function getWalletBalance(userId: string): Promise<WalletBalance> {
  return api.get<WalletBalance>(`/wallet/${userId}/balance`);
}

export async function getWalletTransactions(userId: string, limit = 20): Promise<WalletTransaction[]> {
  return api.get<WalletTransaction[]>(`/wallet/${userId}/transactions?limit=${limit}`);
}

export async function getPayment(rideId: string): Promise<Payment> {
  return api.get<Payment>(`/payments/${rideId}`);
}

export async function processPayment(rideId: string, method: string, amount: number): Promise<Payment> {
  return api.post<Payment>("/payments/process", { rideId, method, amount });
}

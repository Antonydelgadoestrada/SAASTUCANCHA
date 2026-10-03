import api from "./axios"

export interface Transaction {
  id: string;
  sourceType: string;
  sourceId: string;
  clubId: string;
  reservationId?: string;
  membershipPaymentId?: string;
  occurredAt?: string;
  submittedAt?: string;
  direction: 'IN' | 'OUT';
  category: string;
  origin: string;
  paymentMethod: string;
  channel: string;
  grossAmount: number;
  feeAmount: number;
  feePercent: number;
  netAmount: number;
  currency: string;
  reservationTotal?: number;
  paidAccumulated?: number;
  pendingAfter?: number;
  status: string;
  description?: string;
  externalId?: string;
  voucherRef?: string;
  metadata?: any;
}

export interface TransactionsResponse {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MetricsResponse {
  totalIngresosBrutos: number;
  totalIngresosNetos: number;
  totalComisiones: number;
}

export async function getTransactions(page = 1, limit = 10, startDate?: string, endDate?: string): Promise<TransactionsResponse> {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const res = await api.get(`/transactions?${params.toString()}`);
  return res.data;
}

export async function getTransactionMetrics(startDate?: string, endDate?: string): Promise<MetricsResponse> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const res = await api.get(`/transactions/metrics?${params.toString()}`);
  return res.data;
}

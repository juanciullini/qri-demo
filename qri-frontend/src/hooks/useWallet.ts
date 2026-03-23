import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import * as walletService from '@/services/wallet.service';
import { transactionKeys } from '@/hooks/useTransactions';
import type {
  PaginatedResponse,
  ParsedQRInfo,
  Transaction,
  TransactionFilters,
  WalletPayRequest,
} from '@/types';

export const walletKeys = {
  all: ['wallet'] as const,
  transactions: (filters?: Omit<TransactionFilters, 'direction' | 'merchant_id'>) =>
    [...walletKeys.all, 'transactions', filters] as const,
  transaction: (id: string) => [...walletKeys.all, 'transaction', id] as const,
};

export function useScanQR() {
  return useMutation<ParsedQRInfo, Error, string>({
    mutationFn: (qrData) => walletService.scanQR(qrData),
  });
}

export function useWalletPay() {
  const queryClient = useQueryClient();

  return useMutation<
    { transactionId: string; status: string; id_debin?: string },
    Error,
    WalletPayRequest
  >({
    mutationFn: (request) => walletService.pay(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

export function useWalletTransactions(
  filters?: Omit<TransactionFilters, 'direction' | 'merchant_id'>,
  options?: Partial<UseQueryOptions<PaginatedResponse<Transaction>>>,
) {
  return useQuery<PaginatedResponse<Transaction>>({
    queryKey: walletKeys.transactions(filters),
    queryFn: () => walletService.getWalletTransactions(filters),
    ...options,
  });
}

export function useWalletTransaction(
  id: string,
  options?: Partial<UseQueryOptions<Transaction>>,
) {
  return useQuery<Transaction>({
    queryKey: walletKeys.transaction(id),
    queryFn: () => walletService.getWalletTransaction(id),
    enabled: !!id,
    ...options,
  });
}

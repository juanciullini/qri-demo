import { useEffect } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import * as txService from '@/services/transactions.service';
import { useSocket } from '@/hooks/useSocket';
import type {
  PaginatedResponse,
  RefundRequest,
  Transaction,
  TransactionFilters,
  TransactionStats,
  WsTransactionEvent,
} from '@/types';

// ── Query keys ──

export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (filters?: TransactionFilters) =>
    [...transactionKeys.lists(), filters] as const,
  details: () => [...transactionKeys.all, 'detail'] as const,
  detail: (id: string) => [...transactionKeys.details(), id] as const,
  stats: (filters?: Omit<TransactionFilters, 'page' | 'limit'>) =>
    [...transactionKeys.all, 'stats', filters] as const,
};

// ── Hooks ──

export function useTransactionsList(
  filters?: TransactionFilters,
  options?: Partial<UseQueryOptions<PaginatedResponse<Transaction>>>,
) {
  return useQuery<PaginatedResponse<Transaction>>({
    queryKey: transactionKeys.list(filters),
    queryFn: () => txService.getTransactions(filters),
    ...options,
  });
}

export function useTransaction(
  id: string,
  options?: Partial<UseQueryOptions<Transaction>>,
) {
  return useQuery<Transaction>({
    queryKey: transactionKeys.detail(id),
    queryFn: () => txService.getTransaction(id),
    enabled: !!id,
    ...options,
  });
}

export function useTransactionStats(
  filters?: Omit<TransactionFilters, 'page' | 'limit'>,
  options?: Partial<UseQueryOptions<TransactionStats>>,
) {
  return useQuery<TransactionStats>({
    queryKey: transactionKeys.stats(filters),
    queryFn: () => txService.getTransactionStats(filters),
    ...options,
  });
}

export function useRefundMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RefundRequest }) =>
      txService.requestRefund(id, data),
    onSuccess: (_data, variables) => {
      // Invalidate both the specific transaction and the list
      queryClient.invalidateQueries({
        queryKey: transactionKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: transactionKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: transactionKeys.all,
      });
    },
  });
}

// ── WebSocket integration ──

export function useTransactionSocket() {
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    function handleTransactionEvent(event: WsTransactionEvent) {
      // Invalidate lists and stats so they refetch
      queryClient.invalidateQueries({
        queryKey: transactionKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: [...transactionKeys.all, 'stats'],
      });

      // Update cache for the specific transaction if we have it
      if (event.data?.id) {
        queryClient.setQueryData(
          transactionKeys.detail(event.data.id),
          event.data,
        );
      }
    }

    socket.on('transaction:created', (data: Transaction) =>
      handleTransactionEvent({ type: 'transaction:created', data }),
    );
    socket.on('transaction:updated', (data: Transaction) =>
      handleTransactionEvent({ type: 'transaction:updated', data }),
    );
    socket.on('transaction:refunded', (data: Transaction) =>
      handleTransactionEvent({ type: 'transaction:refunded', data }),
    );

    return () => {
      socket.off('transaction:created');
      socket.off('transaction:updated');
      socket.off('transaction:refunded');
    };
  }, [socket, queryClient]);
}

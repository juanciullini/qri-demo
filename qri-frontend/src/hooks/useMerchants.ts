import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import * as merchantsService from '@/services/merchants.service';
import type {
  CreateMerchantData,
  Merchant,
  MerchantFilters,
  PaginatedResponse,
  UpdateMerchantData,
} from '@/types';

// ── Query keys ──

export const merchantKeys = {
  all: ['merchants'] as const,
  lists: () => [...merchantKeys.all, 'list'] as const,
  list: (filters?: MerchantFilters) =>
    [...merchantKeys.lists(), filters] as const,
  details: () => [...merchantKeys.all, 'detail'] as const,
  detail: (id: string) => [...merchantKeys.details(), id] as const,
  stats: (id: string) => [...merchantKeys.all, 'stats', id] as const,
};

// ── Hooks ──

export function useMerchantsList(
  filters?: MerchantFilters,
  options?: Partial<UseQueryOptions<PaginatedResponse<Merchant>>>,
) {
  return useQuery<PaginatedResponse<Merchant>>({
    queryKey: merchantKeys.list(filters),
    queryFn: () => merchantsService.getMerchants(filters),
    ...options,
  });
}

export function useMerchant(
  id: string,
  options?: Partial<UseQueryOptions<Merchant>>,
) {
  return useQuery<Merchant>({
    queryKey: merchantKeys.detail(id),
    queryFn: () => merchantsService.getMerchant(id),
    enabled: !!id,
    ...options,
  });
}

export function useMerchantStats(id: string) {
  return useQuery({
    queryKey: merchantKeys.stats(id),
    queryFn: () => merchantsService.getMerchantStats(id),
    enabled: !!id,
  });
}

export function useCreateMerchant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMerchantData) =>
      merchantsService.createMerchant(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: merchantKeys.lists() });
    },
  });
}

export function useUpdateMerchant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMerchantData }) =>
      merchantsService.updateMerchant(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: merchantKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: merchantKeys.lists() });
    },
  });
}

export function useDeleteMerchant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => merchantsService.deleteMerchant(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: merchantKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: merchantKeys.lists() });
    },
  });
}

export function useActivateMerchant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => merchantsService.activateMerchant(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({
        queryKey: merchantKeys.detail(id),
      });
      queryClient.invalidateQueries({ queryKey: merchantKeys.lists() });
    },
  });
}

export function useSuspendMerchant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => merchantsService.suspendMerchant(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({
        queryKey: merchantKeys.detail(id),
      });
      queryClient.invalidateQueries({ queryKey: merchantKeys.lists() });
    },
  });
}

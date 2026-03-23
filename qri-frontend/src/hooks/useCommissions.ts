import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import * as commService from '@/services/commissions.service'
import type {
  CommissionDashboard,
  CommissionDashboardFilters,
  CommissionProfile,
  CreateCommissionProfileData,
  PaginatedResponse,
  UpdateCommissionProfileData,
} from '@/types'

// ── Query keys ──

export const commissionKeys = {
  all: ['commissions'] as const,
  profiles: () => [...commissionKeys.all, 'profiles'] as const,
  profileList: (params?: Record<string, unknown>) =>
    [...commissionKeys.profiles(), params] as const,
  profileDetail: (id: string) =>
    [...commissionKeys.profiles(), id] as const,
  dashboard: (filters?: CommissionDashboardFilters) =>
    [...commissionKeys.all, 'dashboard', filters] as const,
}

// ── Hooks ──

export function useCommissionProfiles(
  params?: { is_active?: boolean; search?: string; page?: number; limit?: number },
  options?: Partial<UseQueryOptions<PaginatedResponse<CommissionProfile>>>,
) {
  return useQuery<PaginatedResponse<CommissionProfile>>({
    queryKey: commissionKeys.profileList(params),
    queryFn: () => commService.getProfiles(params),
    ...options,
  })
}

export function useCommissionProfile(
  id: string,
  options?: Partial<UseQueryOptions<CommissionProfile>>,
) {
  return useQuery<CommissionProfile>({
    queryKey: commissionKeys.profileDetail(id),
    queryFn: () => commService.getProfile(id),
    enabled: !!id,
    ...options,
  })
}

export function useCommissionDashboard(
  filters?: CommissionDashboardFilters,
  options?: Partial<UseQueryOptions<CommissionDashboard>>,
) {
  return useQuery<CommissionDashboard>({
    queryKey: commissionKeys.dashboard(filters),
    queryFn: () => commService.getDashboard(filters),
    ...options,
  })
}

export function useCreateProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCommissionProfileData) =>
      commService.createProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commissionKeys.profiles() })
    },
  })
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCommissionProfileData }) =>
      commService.updateProfile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commissionKeys.profiles() })
    },
  })
}

export function useDeleteProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => commService.deleteProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commissionKeys.profiles() })
    },
  })
}

export function useAssignProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ merchantId, profileId }: { merchantId: string; profileId: string | null }) =>
      commService.assignProfile(merchantId, profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commissionKeys.profiles() })
    },
  })
}

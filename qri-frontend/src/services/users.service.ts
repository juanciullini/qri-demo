import api from '@/services/api';
import type {
  CreateUserData,
  PaginatedResponse,
  UpdateUserData,
  User,
  UserFilters,
} from '@/types';

// ── Mappers ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUser(raw: any): User {
  return {
    id: raw._id ?? raw.id,
    email: raw.email ?? '',
    name: raw.name ?? '',
    role: raw.role ?? 'VIEWER',
    merchantId: raw.merchant_id ?? raw.merchantId,
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPaginatedUsers(raw: any): PaginatedResponse<User> {
  const items = raw.data ?? raw.users ?? [];
  const pagination = raw.pagination ?? raw;
  return {
    data: items.map(mapUser),
    total: pagination.total ?? items.length,
    page: pagination.page ?? 1,
    limit: pagination.limit ?? items.length,
    totalPages: pagination.total_pages ?? pagination.totalPages ?? 1,
  };
}

function mapCreateUserRequest(payload: CreateUserData): Record<string, unknown> {
  return {
    email: payload.email,
    name: payload.name,
    password: payload.password,
    role: payload.role,
    merchant_id: payload.merchantId,
  };
}

function mapUpdateUserRequest(payload: UpdateUserData): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (payload.name !== undefined) body.name = payload.name;
  if (payload.email !== undefined) body.email = payload.email;
  if (payload.role !== undefined) body.role = payload.role;
  if (payload.merchantId !== undefined) body.merchant_id = payload.merchantId;
  return body;
}

// ── API calls ──

export async function getUsers(
  filters?: UserFilters,
): Promise<PaginatedResponse<User>> {
  const { data } = await api.get('/users', { params: filters });
  return mapPaginatedUsers(data);
}

export async function getUser(id: string): Promise<User> {
  const { data } = await api.get(`/users/${id}`);
  return mapUser(data.data ?? data);
}

export async function createUser(payload: CreateUserData): Promise<User> {
  const { data } = await api.post('/users', mapCreateUserRequest(payload));
  return mapUser(data.data ?? data);
}

export async function updateUser(
  id: string,
  payload: UpdateUserData,
): Promise<User> {
  const { data } = await api.patch(`/users/${id}`, mapUpdateUserRequest(payload));
  return mapUser(data.data ?? data);
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}

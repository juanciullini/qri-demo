import type { FastifyReply, FastifyRequest } from 'fastify';
import { Role } from '../../config/constants.js';
import { AppError } from '../../middleware/error-handler.js';
import {
  createProfileSchema,
  updateProfileSchema,
  assignProfileSchema,
  profileFiltersSchema,
  dashboardFiltersSchema,
} from './commissions.schemas.js';
import * as commissionService from './commissions.service.js';

// ── Create Profile ──

export async function createProfileHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createProfileSchema.parse(request.body);
  const profile = await commissionService.createProfile(body);
  reply.status(201).send(profile);
}

// ── Update Profile ──

export async function updateProfileHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const body = updateProfileSchema.parse(request.body);
  const profile = await commissionService.updateProfile(id, body);
  reply.send(profile);
}

// ── Get Profiles ──

export async function getProfilesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const filters = profileFiltersSchema.parse(request.query);
  const result = await commissionService.getProfiles(filters);
  reply.send(result);
}

// ── Get Profile by ID ──

export async function getProfileByIdHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const profile = await commissionService.getProfileById(id);
  reply.send(profile);
}

// ── Delete Profile ──

export async function deleteProfileHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  await commissionService.deleteProfile(id);
  reply.status(204).send();
}

// ── Assign Profile to Merchant ──

export async function assignProfileHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = assignProfileSchema.parse(request.body);
  const merchant = await commissionService.assignProfileToMerchant(body.merchant_id, body.profile_id);
  reply.send(merchant);
}

// ── Dashboard ──

export async function getDashboardHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const filters = dashboardFiltersSchema.parse(request.query);

  // MERCHANT role auto-scoped
  let merchantIdScope: string | undefined;
  if (request.user?.role === Role.MERCHANT) {
    if (!request.user.merchantId) {
      throw new AppError(403, 'No merchant associated with this user', 'NO_MERCHANT');
    }
    merchantIdScope = request.user.merchantId;
  }

  const dashboard = await commissionService.getCommissionDashboard(filters, merchantIdScope);
  reply.send(dashboard);
}

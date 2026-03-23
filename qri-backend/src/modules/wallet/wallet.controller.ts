import type { FastifyReply, FastifyRequest } from 'fastify';
import { scanQRSchema, paySchema, walletTransactionFiltersSchema } from './wallet.schemas.js';
import * as walletService from './wallet.service.js';

export async function scanQR(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = scanQRSchema.parse(request.body);
  const result = walletService.scanQR(body.qr_data);
  reply.send(result);
}

export async function pay(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = paySchema.parse(request.body);
  const userId = request.user!.userId;
  const result = await walletService.initiatePayment(body, userId);
  reply.send(result);
}

export async function listTransactions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const filters = walletTransactionFiltersSchema.parse(request.query);
  const userId = request.user!.userId;
  const result = await walletService.getWalletTransactions(filters, userId);
  reply.send(result);
}

export async function getTransaction(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params;
  const userId = request.user!.userId;
  const result = await walletService.getWalletTransactionById(id, userId);
  reply.send(result);
}

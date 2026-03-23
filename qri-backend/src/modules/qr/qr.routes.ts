import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { Role } from '../../config/constants.js';
import {
  createStaticQRHandler,
  createDynamicQRHandler,
  getQRCodesHandler,
  getQRByIdHandler,
  getQRImageHandler,
  getQRPdfHandler,
  disableQRHandler,
} from './qr.controller.js';

export async function qrRoutes(app: FastifyInstance): Promise<void> {
  // All QR routes require authentication
  app.addHook('preHandler', authMiddleware);

  // ── List QR codes ──
  app.get('/', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR, Role.MERCHANT, Role.VIEWER)],
  }, getQRCodesHandler);

  // ── Create static QR ──
  app.post('/static', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR, Role.MERCHANT)],
  }, createStaticQRHandler);

  // ── Create dynamic QR ──
  app.post('/dynamic', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR, Role.MERCHANT)],
  }, createDynamicQRHandler);

  // ── Get QR by ID ──
  app.get('/:id', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR, Role.MERCHANT, Role.VIEWER)],
  }, getQRByIdHandler);

  // ── Get QR image (PNG or SVG) ──
  app.get('/:id/image', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR, Role.MERCHANT, Role.VIEWER)],
  }, getQRImageHandler);

  // ── Get QR as printable PDF ──
  app.get('/:id/pdf', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR, Role.MERCHANT, Role.VIEWER)],
  }, getQRPdfHandler);

  // ── Disable QR code ──
  app.post('/:id/disable', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR, Role.MERCHANT)],
  }, disableQRHandler);
}

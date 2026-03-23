import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../../utils/logger.js';
import {
  handleIntentionPayment,
  handleConfirmDebit,
  handleReversal,
  handleOperationFinished,
  handleOperationFinishedAcquirer,
} from '../transactions/transaction.service.js';
import type {
  QRIntencionPagoRequest,
  QRConfirmaDebitoRequest,
  QRReversoRequest,
  QROperacionFinalizadaRequest,
  QROperacionFinalizadaAdquirenteRequest,
} from './coelsa.types.js';

/**
 * COELSA webhook routes.
 *
 * These endpoints are called BY COELSA via mTLS (no JWT authentication).
 * They are mounted under /coelsa and excluded from the rate limiter.
 *
 * IntencionPago and ConfirmaDebito MUST respond within 2 seconds
 * (COELSA has a 3-second timeout; we target <2s for safety margin).
 */
export async function coelsaRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /qr/intencion-pago ──
  // COELSA notifies that a buyer scanned a QR and wants to pay.
  // Must respond in <2s.
  app.post(
    '/qr/intencion-pago',
    async (request: FastifyRequest<{ Body: QRIntencionPagoRequest }>, reply: FastifyReply) => {
      const startTime = Date.now();

      try {
        const sandboxScenario = request.headers['x-sandbox-scenario'] as string | undefined;
        const response = await handleIntentionPayment(request.body, sandboxScenario);

        const elapsed = Date.now() - startTime;
        logger.info({ elapsed_ms: elapsed, qr_id_trx: request.body.operacion?.detalle?.qr_id_trx }, 'IntencionPago completed');

        if (elapsed > 1500) {
          logger.warn({ elapsed_ms: elapsed }, 'IntencionPago approaching 2s SLA');
        }

        reply.send(response);
      } catch (error) {
        const elapsed = Date.now() - startTime;
        logger.error({ error, elapsed_ms: elapsed }, 'IntencionPago failed');

        // Even on error, we must return a valid COELSA response format
        const detalle = request.body?.operacion?.detalle;
        reply.send({
          qr_id_trx: detalle?.qr_id_trx ?? '',
          id_debin: detalle?.id_debin ?? '',
          id_billetera: detalle?.id_billetera ?? 0,
          fecha_negocio: detalle?.fecha_negocio ?? new Date().toISOString(),
          validation_data: null,
          validation_status: {
            status: 'FAIL',
            on_error: { code: '5799', description: 'ERROR GENERAL' },
          },
        });
      }
    },
  );

  // ── POST /qr/confirma-debito ──
  // COELSA confirms that the buyer's bank debited the amount.
  // Must respond in <2s.
  app.post(
    '/qr/confirma-debito',
    async (request: FastifyRequest<{ Body: QRConfirmaDebitoRequest }>, reply: FastifyReply) => {
      const startTime = Date.now();

      try {
        const sandboxScenario = request.headers['x-sandbox-scenario'] as string | undefined;
        const response = await handleConfirmDebit(request.body, sandboxScenario);

        const elapsed = Date.now() - startTime;
        logger.info({ elapsed_ms: elapsed, qr_id_trx: request.body.operacion?.detalle?.qr_id_trx }, 'ConfirmaDebito completed');

        if (elapsed > 1500) {
          logger.warn({ elapsed_ms: elapsed }, 'ConfirmaDebito approaching 2s SLA');
        }

        reply.send(response);
      } catch (error) {
        const elapsed = Date.now() - startTime;
        logger.error({ error, elapsed_ms: elapsed }, 'ConfirmaDebito failed');

        const detalle = request.body?.operacion?.detalle;
        reply.send({
          qr_id_trx: detalle?.qr_id_trx ?? '',
          id_debin: detalle?.id_debin ?? '',
          id_billetera: detalle?.id_billetera ?? 0,
          fecha_negocio: detalle?.fecha_negocio ?? new Date().toISOString(),
          transaction_status: {
            status: 'REJECTED',
            on_error: { code: '2899', description: 'ERROR GENERAL' },
          },
        });
      }
    },
  );

  // ── POST /qr/reverso ──
  // COELSA requests reversal of an in-progress transaction.
  app.post(
    '/qr/reverso',
    async (request: FastifyRequest<{ Body: QRReversoRequest }>, reply: FastifyReply) => {
      try {
        await handleReversal(request.body);
        // COELSA does not expect a response body for reversals
        reply.status(200).send();
      } catch (error) {
        logger.error(
          { error, qr_id_trx: request.body?.operacion?.detalle?.qr_id_trx },
          'QRReverso processing error',
        );
        // Return 200 anyway to acknowledge receipt; the reversal will be retried if needed
        reply.status(200).send();
      }
    },
  );

  // ── POST /qr/operacion-finalizada ──
  // COELSA notifies the final outcome of an operation (billetera/OUTBOUND).
  app.post(
    '/qr/operacion-finalizada',
    async (request: FastifyRequest<{ Body: QROperacionFinalizadaRequest }>, reply: FastifyReply) => {
      try {
        await handleOperationFinished(request.body);
        reply.status(200).send();
      } catch (error) {
        logger.error(
          { error, qr_id_trx: request.body?.operacion_original?.qr_id_trx },
          'OperacionFinalizada processing error',
        );
        reply.status(200).send();
      }
    },
  );

  // ── POST /qr/operacion-finalizada-adquirente ──
  // COELSA notifies the final outcome of an INBOUND operation (we are the PSP/Adquirente).
  // Typically confirms 5700 after ConfirmaDebito. Errors come via QRReverso.
  app.post(
    '/qr/operacion-finalizada-adquirente',
    async (request: FastifyRequest<{ Body: QROperacionFinalizadaAdquirenteRequest }>, reply: FastifyReply) => {
      try {
        await handleOperationFinishedAcquirer(request.body);
        reply.status(200).send();
      } catch (error) {
        logger.error(
          { error, qr_id_trx: request.body?.operacion_original?.qr_id_trx },
          'OperacionFinalizadaAdquirente processing error',
        );
        reply.status(200).send();
      }
    },
  );
}

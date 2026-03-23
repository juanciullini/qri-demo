import pino from 'pino';

export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      qr_id_trx: req.headers?.['x-qr-id-trx'],
    }),
  },
});

export function txLogger(qrIdTrx: string): pino.Logger {
  return logger.child({ correlation_id: qrIdTrx });
}

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/users/user.routes.js';
import { merchantRoutes } from './modules/merchants/merchant.routes.js';
import { qrRoutes } from './modules/qr/qr.routes.js';
import { transactionRoutes } from './modules/transactions/transaction.routes.js';
import { settlementRoutes } from './modules/settlements/settlement.routes.js';
import { coelsaRoutes } from './modules/coelsa/coelsa.routes.js';
import { systemRoutes } from './modules/system/system.routes.js';
import { walletRoutes } from './modules/wallet/wallet.routes.js';
import { sandboxRoutes } from './modules/sandbox/sandbox.routes.js';
import { commissionRoutes } from './modules/commissions/commissions.routes.js';
import { setupWebSocket } from './websocket/socket.js';
import { prisma } from './utils/prisma.js';

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
  },
});

async function bootstrap(): Promise<void> {
  // Plugins
  await app.register(cors, { origin: env.FRONTEND_URL, credentials: true });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "wss:", "ws:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    allowList: (req) => req.url?.startsWith('/coelsa') ?? false,
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // API routes (JWT protected)
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(userRoutes, { prefix: '/api/users' });
  await app.register(merchantRoutes, { prefix: '/api/merchants' });
  await app.register(qrRoutes, { prefix: '/api/qr' });
  await app.register(transactionRoutes, { prefix: '/api/transactions' });
  await app.register(settlementRoutes, { prefix: '/api/settlements' });
  await app.register(systemRoutes, { prefix: '/api/system' });
  await app.register(walletRoutes, { prefix: '/api/wallet' });
  await app.register(commissionRoutes, { prefix: '/api/commissions' });

  // Sandbox routes (only in sandbox mode)
  if (env.COELSA_MODE === 'sandbox') {
    await app.register(sandboxRoutes, { prefix: '/api/sandbox' });
  }

  // COELSA webhooks (mTLS, no JWT)
  await app.register(coelsaRoutes, { prefix: '/coelsa' });

  // Serve static files in production (landing + SPA)
  if (env.NODE_ENV === 'production') {
    const publicDir = path.join(__dirname, '..', 'public');

    // Serve /app/* from public/app/ (first registration decorates reply with sendFile)
    await app.register(fastifyStatic, {
      root: path.join(publicDir, 'app'),
      prefix: '/app/',
      wildcard: false,
    });

    // Serve /landing/* from public/landing/ (screenshots, etc.)
    await app.register(fastifyStatic, {
      root: path.join(publicDir, 'landing'),
      prefix: '/landing/',
      decorateReply: false,
      wildcard: false,
    });

    // Landing page at root
    app.get('/', (_request, reply) => {
      return reply.sendFile('index.html', path.join(publicDir, 'landing'));
    });

    // SPA fallback: /app/* routes serve app/index.html
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/app')) {
        return reply.sendFile('index.html', path.join(publicDir, 'app'));
      }
      if (!request.url.startsWith('/api') && !request.url.startsWith('/coelsa') && !request.url.startsWith('/ws')) {
        return reply.sendFile('index.html', path.join(publicDir, 'landing'));
      }
      reply.status(404).send({ error: 'Not found' });
    });
  }

  // WebSocket
  const io = setupWebSocket(app.server);
  app.decorate('io', io);

  // Start
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}] [coelsa: ${env.COELSA_MODE}]`);
}

bootstrap().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});

// Graceful shutdown
const shutdown = async (): Promise<void> => {
  logger.info('Shutting down...');
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app };

import { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { Role } from '../config/constants.js';
import type { JwtPayload } from '../middleware/auth.middleware.js';
import type {
  TransactionCreatedPayload,
  TransactionStatusChangedPayload,
  TransactionCompletedPayload,
  TransactionErrorPayload,
  TransactionRefundedPayload,
  SystemCoelsaStatusPayload,
  SystemAlertPayload,
} from './events.js';
import { WS_EVENTS } from './events.js';

let io: SocketIOServer | null = null;

export function setupWebSocket(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
    path: '/ws',
  });

  // JWT authentication on handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token ?? socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as JwtPayload;
    logger.info({ userId: user.userId, role: user.role }, 'WebSocket connected');

    // Join rooms based on role
    if (user.role === Role.ADMIN || user.role === Role.OPERATOR || user.role === Role.VIEWER) {
      socket.join('transactions:all');
    }

    if (user.role === Role.MERCHANT && user.merchantId) {
      socket.join(`transactions:merchant:${user.merchantId}`);
    }

    socket.on('disconnect', () => {
      logger.debug({ userId: user.userId }, 'WebSocket disconnected');
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('WebSocket not initialized');
  return io;
}

// ── Emit helpers ──

export function emitTransactionCreated(payload: TransactionCreatedPayload): void {
  if (!io) return;
  io.to('transactions:all').emit(WS_EVENTS.TRANSACTION_CREATED, payload);
  io.to(`transactions:merchant:${payload.merchant_id}`).emit(WS_EVENTS.TRANSACTION_CREATED, payload);
}

export function emitTransactionStatusChanged(payload: TransactionStatusChangedPayload): void {
  if (!io) return;
  io.to('transactions:all').emit(WS_EVENTS.TRANSACTION_STATUS_CHANGED, payload);
  io.to(`transactions:merchant:${payload.merchant_id}`).emit(WS_EVENTS.TRANSACTION_STATUS_CHANGED, payload);
}

export function emitTransactionCompleted(payload: TransactionCompletedPayload): void {
  if (!io) return;
  io.to('transactions:all').emit(WS_EVENTS.TRANSACTION_COMPLETED, payload);
  io.to(`transactions:merchant:${payload.merchant_id}`).emit(WS_EVENTS.TRANSACTION_COMPLETED, payload);
}

export function emitTransactionError(payload: TransactionErrorPayload): void {
  if (!io) return;
  io.to('transactions:all').emit(WS_EVENTS.TRANSACTION_ERROR, payload);
  io.to(`transactions:merchant:${payload.merchant_id}`).emit(WS_EVENTS.TRANSACTION_ERROR, payload);
}

export function emitTransactionRefunded(payload: TransactionRefundedPayload): void {
  if (!io) return;
  io.to('transactions:all').emit(WS_EVENTS.TRANSACTION_REFUNDED, payload);
  io.to(`transactions:merchant:${payload.merchant_id}`).emit(WS_EVENTS.TRANSACTION_REFUNDED, payload);
}

export function emitSystemCoelsaStatus(payload: SystemCoelsaStatusPayload): void {
  if (!io) return;
  io.to('transactions:all').emit(WS_EVENTS.SYSTEM_COELSA_STATUS, payload);
}

export function emitSystemAlert(payload: SystemAlertPayload): void {
  if (!io) return;
  io.to('transactions:all').emit(WS_EVENTS.SYSTEM_ALERT, payload);
}

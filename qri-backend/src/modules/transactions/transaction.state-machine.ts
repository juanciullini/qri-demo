import { TX_TRANSITIONS } from '../../config/constants.js';
import { AppError } from '../../middleware/error-handler.js';

/**
 * Check whether a state transition is allowed according to the
 * TX_TRANSITIONS map defined in config/constants.ts.
 */
export function canTransition(currentStatus: string, newStatus: string): boolean {
  const allowed = TX_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(newStatus);
}

/**
 * Assert that a state transition is valid.
 * Throws AppError (409 Conflict) when the transition is not permitted.
 */
export function validateTransition(currentStatus: string, newStatus: string): void {
  if (!canTransition(currentStatus, newStatus)) {
    throw new AppError(
      409,
      `Invalid state transition: ${currentStatus} -> ${newStatus}`,
      'INVALID_STATE_TRANSITION',
    );
  }
}

import { canTransition, validateTransition } from '../../src/modules/transactions/transaction.state-machine.js';
import { AppError } from '../../src/middleware/error-handler.js';

describe('canTransition', () => {
  describe('valid forward transitions', () => {
    it('should allow CREADO -> INTENCION_ENVIADA', () => {
      expect(canTransition('CREADO', 'INTENCION_ENVIADA')).toBe(true);
    });

    it('should allow INTENCION_ENVIADA -> INTENCION_ACEPTADA', () => {
      expect(canTransition('INTENCION_ENVIADA', 'INTENCION_ACEPTADA')).toBe(true);
    });

    it('should allow INTENCION_ACEPTADA -> DEBITO_PENDIENTE', () => {
      expect(canTransition('INTENCION_ACEPTADA', 'DEBITO_PENDIENTE')).toBe(true);
    });

    it('should allow DEBITO_PENDIENTE -> DEBITO_CONFIRMADO', () => {
      expect(canTransition('DEBITO_PENDIENTE', 'DEBITO_CONFIRMADO')).toBe(true);
    });

    it('should allow DEBITO_CONFIRMADO -> CREDITO_ENVIADO', () => {
      expect(canTransition('DEBITO_CONFIRMADO', 'CREDITO_ENVIADO')).toBe(true);
    });

    it('should allow CREDITO_ENVIADO -> EN_CURSO', () => {
      expect(canTransition('CREDITO_ENVIADO', 'EN_CURSO')).toBe(true);
    });

    it('should allow EN_CURSO -> ACREDITADO', () => {
      expect(canTransition('EN_CURSO', 'ACREDITADO')).toBe(true);
    });

    it('should allow ACREDITADO -> DEVUELTO', () => {
      expect(canTransition('ACREDITADO', 'DEVUELTO')).toBe(true);
    });
  });

  describe('valid reversal transitions', () => {
    it('should allow INTENCION_ENVIADA -> REVERSADO', () => {
      expect(canTransition('INTENCION_ENVIADA', 'REVERSADO')).toBe(true);
    });

    it('should allow INTENCION_ACEPTADA -> REVERSADO', () => {
      expect(canTransition('INTENCION_ACEPTADA', 'REVERSADO')).toBe(true);
    });

    it('should allow DEBITO_PENDIENTE -> REVERSADO', () => {
      expect(canTransition('DEBITO_PENDIENTE', 'REVERSADO')).toBe(true);
    });

    it('should allow DEBITO_CONFIRMADO -> REVERSADO', () => {
      expect(canTransition('DEBITO_CONFIRMADO', 'REVERSADO')).toBe(true);
    });

    it('should allow CREDITO_ENVIADO -> REVERSADO', () => {
      expect(canTransition('CREDITO_ENVIADO', 'REVERSADO')).toBe(true);
    });

    it('should allow EN_CURSO -> REVERSADO', () => {
      expect(canTransition('EN_CURSO', 'REVERSADO')).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    it('should not allow CREADO -> ACREDITADO (skipping states)', () => {
      expect(canTransition('CREADO', 'ACREDITADO')).toBe(false);
    });

    it('should not allow CREADO -> REVERSADO', () => {
      expect(canTransition('CREADO', 'REVERSADO')).toBe(false);
    });

    it('should not allow ACREDITADO -> REVERSADO', () => {
      expect(canTransition('ACREDITADO', 'REVERSADO')).toBe(false);
    });

    it('should not allow backward transition ACREDITADO -> EN_CURSO', () => {
      expect(canTransition('ACREDITADO', 'EN_CURSO')).toBe(false);
    });

    it('should not allow INTENCION_ENVIADA -> DEBITO_PENDIENTE (skipping)', () => {
      expect(canTransition('INTENCION_ENVIADA', 'DEBITO_PENDIENTE')).toBe(false);
    });
  });

  describe('terminal states', () => {
    it('should not allow any transition from REVERSADO', () => {
      expect(canTransition('REVERSADO', 'CREADO')).toBe(false);
      expect(canTransition('REVERSADO', 'INTENCION_ENVIADA')).toBe(false);
      expect(canTransition('REVERSADO', 'ACREDITADO')).toBe(false);
      expect(canTransition('REVERSADO', 'DEVUELTO')).toBe(false);
    });

    it('should not allow any transition from DEVUELTO', () => {
      expect(canTransition('DEVUELTO', 'CREADO')).toBe(false);
      expect(canTransition('DEVUELTO', 'REVERSADO')).toBe(false);
      expect(canTransition('DEVUELTO', 'ACREDITADO')).toBe(false);
    });
  });

  describe('unknown states', () => {
    it('should return false for an unknown current state', () => {
      expect(canTransition('UNKNOWN', 'CREADO')).toBe(false);
    });

    it('should return false for an unknown target state', () => {
      expect(canTransition('CREADO', 'UNKNOWN')).toBe(false);
    });

    it('should return false when both states are unknown', () => {
      expect(canTransition('FOO', 'BAR')).toBe(false);
    });

    it('should return false for empty strings', () => {
      expect(canTransition('', '')).toBe(false);
    });
  });
});

describe('validateTransition', () => {
  describe('valid transitions', () => {
    it('should not throw for CREADO -> INTENCION_ENVIADA', () => {
      expect(() => validateTransition('CREADO', 'INTENCION_ENVIADA')).not.toThrow();
    });

    it('should not throw for INTENCION_ENVIADA -> INTENCION_ACEPTADA', () => {
      expect(() => validateTransition('INTENCION_ENVIADA', 'INTENCION_ACEPTADA')).not.toThrow();
    });

    it('should not throw for EN_CURSO -> REVERSADO', () => {
      expect(() => validateTransition('EN_CURSO', 'REVERSADO')).not.toThrow();
    });

    it('should not throw for ACREDITADO -> DEVUELTO', () => {
      expect(() => validateTransition('ACREDITADO', 'DEVUELTO')).not.toThrow();
    });
  });

  describe('invalid transitions', () => {
    it('should throw AppError with status 409 for CREADO -> ACREDITADO', () => {
      expect(() => validateTransition('CREADO', 'ACREDITADO')).toThrow(AppError);
      try {
        validateTransition('CREADO', 'ACREDITADO');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(409);
        expect((error as AppError).code).toBe('INVALID_STATE_TRANSITION');
        expect((error as AppError).message).toBe('Invalid state transition: CREADO -> ACREDITADO');
      }
    });

    it('should throw AppError with status 409 for REVERSADO -> CREADO', () => {
      expect(() => validateTransition('REVERSADO', 'CREADO')).toThrow(AppError);
      try {
        validateTransition('REVERSADO', 'CREADO');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(409);
        expect((error as AppError).code).toBe('INVALID_STATE_TRANSITION');
      }
    });

    it('should throw AppError with status 409 for ACREDITADO -> REVERSADO', () => {
      expect(() => validateTransition('ACREDITADO', 'REVERSADO')).toThrow(AppError);
      try {
        validateTransition('ACREDITADO', 'REVERSADO');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(409);
      }
    });

    it('should throw AppError with status 409 for unknown state', () => {
      expect(() => validateTransition('UNKNOWN', 'CREADO')).toThrow(AppError);
      try {
        validateTransition('UNKNOWN', 'CREADO');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(409);
        expect((error as AppError).message).toBe('Invalid state transition: UNKNOWN -> CREADO');
      }
    });

    it('should include both states in the error message', () => {
      try {
        validateTransition('DEVUELTO', 'ACREDITADO');
      } catch (error) {
        expect((error as AppError).message).toContain('DEVUELTO');
        expect((error as AppError).message).toContain('ACREDITADO');
      }
    });
  });
});

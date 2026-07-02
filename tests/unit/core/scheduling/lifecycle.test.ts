import { setupGracefulShutdown, isShutdownInProgress, resetLifecycleState } from '../../../../src/core/scheduling';

describe('Lifecycle Management', () => {
  beforeEach(() => {
    resetLifecycleState();
  });

  describe('isShutdownInProgress', () => {
    it('should return false initially', () => {
      expect(isShutdownInProgress()).toBe(false);
    });
  });

  describe('setupGracefulShutdown', () => {
    it('should register shutdown handlers without error', () => {
      const mockShutdown = jest.fn().mockResolvedValue(undefined);
      
      expect(() => {
        setupGracefulShutdown(mockShutdown);
      }).not.toThrow();
    });

    it('should not register handlers twice', () => {
      const mockShutdown = jest.fn().mockResolvedValue(undefined);
      
      setupGracefulShutdown(mockShutdown);
      setupGracefulShutdown(mockShutdown); // Second call should be ignored
      
      // No error should be thrown
    });
  });

  describe('resetLifecycleState', () => {
    it('should reset shutdown state', () => {
      const mockShutdown = jest.fn().mockResolvedValue(undefined);
      setupGracefulShutdown(mockShutdown);
      
      resetLifecycleState();
      
      // After reset, we should be able to register again
      expect(() => {
        setupGracefulShutdown(mockShutdown);
      }).not.toThrow();
    });
  });
});

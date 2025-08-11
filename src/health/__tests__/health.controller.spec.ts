import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return health status', () => {
      const result = controller.getHealth();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('version');
      
      expect(typeof result.timestamp).toBe('string');
      expect(typeof result.uptime).toBe('number');
      expect(typeof result.version).toBe('string');
      
      // Verify timestamp is a valid ISO string
      expect(() => new Date(result.timestamp)).not.toThrow();
      
      // Verify uptime is positive
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return current timestamp', () => {
      const before = new Date();
      const result = controller.getHealth();
      const after = new Date();
      
      const timestamp = new Date(result.timestamp);
      
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime() - 100);
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime() + 100);
    });
  });
});

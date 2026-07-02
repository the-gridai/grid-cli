import fs from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';
import { ConfigManager } from '../../../../src/core/config/config-manager';

// Simple test schema
const TestConfigSchema = z.object({
  name: z.string(),
  value: z.number(),
  nested: z.object({
    enabled: z.boolean(),
    items: z.array(z.string()),
  }),
});

type TestConfig = z.infer<typeof TestConfigSchema>;

describe('ConfigManager', () => {
  const testConfig: TestConfig = {
    name: 'test',
    value: 42,
    nested: {
      enabled: true,
      items: ['a', 'b'],
    },
  };

  describe('basic operations', () => {
    it('should initialize with config', () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
      });

      expect(manager.getConfig()).toEqual(testConfig);
    });

    it('should return config as readonly', () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
      });

      const config = manager.getConfig();
      expect(Object.isFrozen(config)).toBeFalsy(); // Not actually frozen, but TypeScript enforces readonly
      expect(config.name).toBe('test');
    });

    it('should get values using dot notation', () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
      });

      expect(manager.getValue('name')).toBe('test');
      expect(manager.getValue('value')).toBe(42);
      expect(manager.getValue('nested.enabled')).toBe(true);
      expect(manager.getValue('nested.items')).toEqual(['a', 'b']);
    });

    it('should return undefined for non-existent paths', () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
      });

      expect(manager.getValue('nonexistent')).toBeUndefined();
      expect(manager.getValue('nested.nonexistent')).toBeUndefined();
    });
  });

  describe('updateConfig', () => {
    it('should update with partial config', async () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
      });

      const result = await manager.updateConfig({ value: 100 });

      expect(result.success).toBe(true);
      expect(manager.getConfig().value).toBe(100);
      expect(manager.getConfig().name).toBe('test'); // unchanged
    });

    it('should deep merge nested objects', async () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
      });

      const result = await manager.updateConfig({
        nested: { enabled: false },
      });

      expect(result.success).toBe(true);
      expect(manager.getConfig().nested.enabled).toBe(false);
      expect(manager.getConfig().nested.items).toEqual(['a', 'b']); // unchanged
    });

    it('should reject invalid updates', async () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
      });

      const result = await manager.updateConfig({
        value: 'not a number' as any,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
      expect(result.validationErrors).toBeDefined();
      expect(manager.getConfig().value).toBe(42); // unchanged
    });

    it('should return previous config on success', async () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
      });

      const result = await manager.updateConfig({ value: 100 });

      expect(result.previousConfig?.value).toBe(42);
      expect(result.config?.value).toBe(100);
    });
  });

  describe('setValue', () => {
    it('should set a single value by path', async () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
      });

      const result = await manager.setValue('value', 200);

      expect(result.success).toBe(true);
      expect(manager.getConfig().value).toBe(200);
    });

    it('should set nested values by path', async () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
      });

      const result = await manager.setValue('nested.enabled', false);

      expect(result.success).toBe(true);
      expect(manager.getConfig().nested.enabled).toBe(false);
    });

    it('should reject invalid values', async () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
      });

      const result = await manager.setValue('value', 'invalid');

      expect(result.success).toBe(false);
      expect(manager.getConfig().value).toBe(42); // unchanged
    });
  });

  describe('replaceConfig', () => {
    it('should replace entire config', async () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
      });

      const newConfig: TestConfig = {
        name: 'new',
        value: 999,
        nested: { enabled: false, items: ['x'] },
      };

      const result = await manager.replaceConfig(newConfig);

      expect(result.success).toBe(true);
      expect(manager.getConfig()).toEqual(newConfig);
    });

    it('should reject invalid replacement', async () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
      });

      const result = await manager.replaceConfig({
        name: 'new',
        // missing required fields
      } as any);

      expect(result.success).toBe(false);
      expect(manager.getConfig()).toEqual(testConfig); // unchanged
    });
  });

  describe('validateConfig', () => {
    it('should validate without applying', () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
      });

      const validResult = manager.validateConfig({
        name: 'valid',
        value: 1,
        nested: { enabled: true, items: [] },
      });

      expect(validResult.success).toBe(true);
      expect(manager.getConfig()).toEqual(testConfig); // unchanged

      const invalidResult = manager.validateConfig({
        name: 123, // wrong type
      });

      expect(invalidResult.success).toBe(false);
      expect(invalidResult.validationErrors).toBeDefined();
    });
  });

  describe('change callbacks', () => {
    it('should notify listeners on update', async () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
      });

      const callback = jest.fn();
      manager.onConfigChange(callback);

      await manager.updateConfig({ value: 100 });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ value: 100 }),
        expect.objectContaining({ value: 42 }),
        undefined
      );
    });

    it('should allow unsubscribing', async () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
      });

      const callback = jest.fn();
      const unsubscribe = manager.onConfigChange(callback);

      await manager.updateConfig({ value: 100 });
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      await manager.updateConfig({ value: 200 });
      expect(callback).toHaveBeenCalledTimes(1); // not called again
    });

    it('should handle async callbacks', async () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
      });

      let asyncCallbackCompleted = false;
      const asyncCallback = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        asyncCallbackCompleted = true;
      };

      manager.onConfigChange(asyncCallback);
      await manager.updateConfig({ value: 100 });

      expect(asyncCallbackCompleted).toBe(true);
    });

    it('should not notify on failed updates', async () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
      });

      const callback = jest.fn();
      manager.onConfigChange(callback);

      await manager.updateConfig({ value: 'invalid' as any });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('file persistence', () => {
    let tempDir: string;
    let configPath: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-manager-test-'));
      configPath = path.join(tempDir, 'config.json');
    });

    afterEach(() => {
      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should persist config to file on update', async () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
        configPath,
      });

      await manager.updateConfig({ value: 100 });

      const savedContent = fs.readFileSync(configPath, 'utf8');
      const savedConfig = JSON.parse(savedContent);

      expect(savedConfig.value).toBe(100);
    });

    it('should create backup before saving', async () => {
      // Write initial file
      fs.writeFileSync(configPath, JSON.stringify(testConfig));

      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
        configPath,
        createBackup: true,
      });

      await manager.updateConfig({ value: 100 });

      const backupPath = `${configPath}.bak`;
      expect(fs.existsSync(backupPath)).toBe(true);

      const backupContent = fs.readFileSync(backupPath, 'utf8');
      const backupConfig = JSON.parse(backupContent);
      expect(backupConfig.value).toBe(42); // original value
    });

    it('should use atomic write', async () => {
      const manager = new ConfigManager({
        initialConfig: testConfig,
        schema: TestConfigSchema,
        configPath,
      });

      await manager.updateConfig({ value: 100 });

      // Temp file should not exist after successful write
      const tempPath = path.join(tempDir, '.config.json.tmp');
      expect(fs.existsSync(tempPath)).toBe(false);
    });
  });
});

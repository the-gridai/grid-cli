import {
  deepMerge,
  setAtPath,
  getAtPath,
  parseValue,
  type DeepPartial
} from '../../../../src/core/config/deep-merge';

describe('deep-merge utilities', () => {
  describe('deepMerge', () => {
    it('should merge simple objects', () => {
      const target = { a: 1, b: 2 };
      const source: DeepPartial<typeof target> = { b: 3 };

      const result = deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: 3 });
    });

    it('should not mutate the original object', () => {
      const target = { a: 1, b: 2 };
      const source: DeepPartial<typeof target> = { b: 3 };

      const result = deepMerge(target, source);

      expect(target).toEqual({ a: 1, b: 2 });
      expect(result).not.toBe(target);
    });

    it('should recursively merge nested objects', () => {
      const target = {
        global: { refreshIntervalMs: 15000, warmupDelayMs: 5000 },
        risk: { maxLoss: 500 },
      };
      const source: DeepPartial<typeof target> = {
        global: { refreshIntervalMs: 30000 },
      };

      const result = deepMerge(target, source);

      expect(result).toEqual({
        global: { refreshIntervalMs: 30000, warmupDelayMs: 5000 },
        risk: { maxLoss: 500 },
      });
    });

    it('should replace arrays entirely', () => {
      const target = { items: [1, 2, 3] };
      const source: DeepPartial<typeof target> = { items: [4, 5] };

      const result = deepMerge(target, source);

      expect(result).toEqual({ items: [4, 5] });
    });

    it('should handle null values in source', () => {
      const target = { a: { b: 1 }, c: 2 } as Record<string, unknown>;
      const source = { a: null } as DeepPartial<typeof target>;

      const result = deepMerge(target, source);

      expect(result).toEqual({ a: null, c: 2 });
    });

    it('should ignore undefined values in source', () => {
      const target = { a: 1, b: 2 };
      const source: DeepPartial<typeof target> = { a: undefined, b: 3 };

      const result = deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: 3 });
    });

    it('should handle deeply nested structures', () => {
      const target = {
        level1: {
          level2: {
            level3: {
              value: 'original',
              other: 'keep',
            },
          },
        },
      };
      const source: DeepPartial<typeof target> = {
        level1: {
          level2: {
            level3: {
              value: 'updated',
            },
          },
        },
      };

      const result = deepMerge(target, source);

      expect(result.level1.level2.level3.value).toBe('updated');
      expect(result.level1.level2.level3.other).toBe('keep');
    });
  });

  describe('setAtPath', () => {
    it('should set a value at a simple path', () => {
      const obj = { a: 1 };
      const result = setAtPath(obj, 'a', 2);

      expect(result).toEqual({ a: 2 });
    });

    it('should set a value at a nested path', () => {
      const obj = { global: { refresh: 1000 } };
      const result = setAtPath(obj, 'global.refresh', 2000);

      expect(result).toEqual({ global: { refresh: 2000 } });
    });

    it('should create intermediate objects', () => {
      const obj: Record<string, unknown> = {};
      const result = setAtPath(obj, 'a.b.c', 'value');

      expect(result).toEqual({ a: { b: { c: 'value' } } });
    });

    it('should not mutate the original object', () => {
      const obj = { a: 1 };
      const result = setAtPath(obj, 'a', 2);

      expect(obj).toEqual({ a: 1 });
      expect(result).not.toBe(obj);
    });

    it('should preserve other properties at the same level', () => {
      const obj = { a: { x: 1, y: 2 } };
      const result = setAtPath(obj, 'a.x', 10);

      expect(result).toEqual({ a: { x: 10, y: 2 } });
    });
  });

  describe('getAtPath', () => {
    it('should get a value at a simple path', () => {
      const obj = { a: 1 };
      const result = getAtPath(obj, 'a');

      expect(result).toBe(1);
    });

    it('should get a value at a nested path', () => {
      const obj = { global: { refresh: 1000 } };
      const result = getAtPath(obj, 'global.refresh');

      expect(result).toBe(1000);
    });

    it('should return undefined for non-existent paths', () => {
      const obj = { a: 1 };
      const result = getAtPath(obj, 'b.c.d');

      expect(result).toBeUndefined();
    });

    it('should return undefined when path goes through a primitive', () => {
      const obj = { a: 1 };
      const result = getAtPath(obj, 'a.b');

      expect(result).toBeUndefined();
    });

    it('should handle deeply nested values', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              value: 'found',
            },
          },
        },
      };
      const result = getAtPath(obj, 'level1.level2.level3.value');

      expect(result).toBe('found');
    });
  });

  describe('parseValue', () => {
    it('should parse numbers', () => {
      expect(parseValue('123')).toBe(123);
      expect(parseValue('123.45')).toBe(123.45);
      expect(parseValue('-42')).toBe(-42);
    });

    it('should parse booleans', () => {
      expect(parseValue('true')).toBe(true);
      expect(parseValue('false')).toBe(false);
    });

    it('should parse null', () => {
      expect(parseValue('null')).toBeNull();
    });

    it('should parse arrays', () => {
      expect(parseValue('[1, 2, 3]')).toEqual([1, 2, 3]);
      expect(parseValue('["a", "b"]')).toEqual(['a', 'b']);
    });

    it('should parse objects', () => {
      expect(parseValue('{"a": 1}')).toEqual({ a: 1 });
    });

    it('should return strings that are not valid JSON as-is', () => {
      expect(parseValue('hello world')).toBe('hello world');
      expect(parseValue('not-json')).toBe('not-json');
    });

    it('should not parse partial JSON', () => {
      expect(parseValue('{invalid')).toBe('{invalid');
    });
  });
});

/**
 * Deep Merge Utility
 * 
 * Provides deep merging functionality for configuration objects.
 * Handles nested objects, arrays, and primitive values correctly.
 * 
 * @module deep-merge
 */

/**
 * Type helper for deep partial
 */
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

/**
 * Check if a value is a plain object (not array, null, Date, etc.)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  // Check for plain object (not Array, Date, RegExp, etc.)
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Deep merge two objects
 * 
 * Rules:
 * - Primitive values from source override target
 * - Arrays from source replace target arrays entirely
 * - Plain objects are recursively merged
 * - undefined values in source are ignored (don't override)
 * - null values in source DO override target
 * 
 * @param target - The base object
 * @param source - The object with updates
 * @returns A new merged object (does not mutate inputs)
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: DeepPartial<T>
): T {
  // Create a shallow copy of the target
  const result = { ...target } as T;

  if (!isPlainObject(source)) {
    return result;
  }

  for (const key of Object.keys(source)) {
    const sourceValue = (source as Record<string, unknown>)[key];
    const targetValue = (target as Record<string, unknown>)[key];

    // Skip undefined values in source (explicit null is allowed)
    if (sourceValue === undefined) {
      continue;
    }

    // If both are plain objects, recursively merge
    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as DeepPartial<Record<string, unknown>>
      );
    } else {
      // Otherwise, replace (handles arrays, primitives, null, etc.)
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Set a value at a dot-notation path in an object
 * 
 * @example
 * setAtPath({}, 'a.b.c', 5) // { a: { b: { c: 5 } } }
 * setAtPath({ a: { x: 1 } }, 'a.b', 2) // { a: { x: 1, b: 2 } }
 * 
 * @param obj - The object to modify
 * @param path - Dot-notation path (e.g., 'global.refreshIntervalMs')
 * @param value - The value to set
 * @returns A new object with the value set (does not mutate input)
 */
export function setAtPath<T extends Record<string, unknown>>(
  obj: T,
  path: string,
  value: unknown
): T {
  const keys = path.split('.');

  if (keys.length === 0) {
    return obj;
  }

  // Build nested partial object
  const partial: Record<string, unknown> = {};
  let current = partial;

  for (let i = 0; i < keys.length - 1; i++) {
    current[keys[i]] = {};
    current = current[keys[i]] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;

  return deepMerge(obj, partial as DeepPartial<T>);
}

/**
 * Get a value at a dot-notation path from an object
 * 
 * @example
 * getAtPath({ a: { b: { c: 5 } } }, 'a.b.c') // 5
 * getAtPath({ a: { b: 1 } }, 'a.x.y') // undefined
 * 
 * @param obj - The object to read from
 * @param path - Dot-notation path (e.g., 'global.refreshIntervalMs')
 * @returns The value at the path, or undefined if not found
 */
export function getAtPath<T = unknown>(
  obj: Record<string, unknown>,
  path: string
): T | undefined {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (!isPlainObject(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current as T | undefined;
}

/**
 * Parse a string value to appropriate type
 * 
 * @example
 * parseValue('123') // 123
 * parseValue('true') // true
 * parseValue('hello') // 'hello'
 * parseValue('{"a":1}') // { a: 1 }
 * 
 * @param value - The string value to parse
 * @returns The parsed value
 */
export function parseValue(value: string): unknown {
  // Try to parse as JSON (handles numbers, booleans, objects, arrays)
  try {
    return JSON.parse(value);
  } catch {
    // If JSON parse fails, return as string
    return value;
  }
}

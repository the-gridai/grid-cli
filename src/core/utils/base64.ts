/**
 * Lenient Base64 decoder that handles URL-safe and unpadded variants.
 *
 * Shared across the codebase to avoid duplication in auth, WebSocket,
 * and dashboard code.
 */
export function decodeBase64Lenient(input: string): Uint8Array {
  let s = (input || '').trim().replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/=]+$/.test(s)) {
    throw new Error('Invalid base64 characters');
  }
  if (s.includes('=') && !/^[A-Za-z0-9+/]+={0,2}$/.test(s)) {
    throw new Error('Invalid base64 padding');
  }
  const mod = s.length % 4;
  if (mod === 2) s += '==';
  else if (mod === 3) s += '=';
  else if (mod !== 0) throw new Error(`Invalid base64 length: ${s.length}`);
  return new Uint8Array(Buffer.from(s, 'base64'));
}

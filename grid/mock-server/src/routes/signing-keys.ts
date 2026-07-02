/**
 * Signing key routes for mock server
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// In-memory signing keys
const signingKeys: Array<{
  id: string;
  public_key: string;
  fingerprint: string;
  label?: string;
  status: string;
  created_at: string;
}> = [];

// Register a new signing key
router.post('/', (req: Request, res: Response) => {
  const { signing_key } = req.body;

  if (!signing_key || !signing_key.public_key) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Missing required field: signing_key.public_key',
      },
    });
  }

  const newKey = {
    id: `key-${uuidv4().slice(0, 8)}`,
    public_key: signing_key.public_key,
    fingerprint:
      signing_key.fingerprint || `fp-${uuidv4().slice(0, 16)}`,
    label: signing_key.label,
    status: 'active',
    created_at: new Date().toISOString(),
  };

  signingKeys.push(newKey);

  res.status(201).json({ data: newKey });
});

// List signing keys
router.get('/', (_req: Request, res: Response) => {
  res.json({ data: signingKeys });
});

// Revoke a signing key
router.delete('/:keyId', (req: Request, res: Response) => {
  const keyIndex = signingKeys.findIndex((k) => k.id === req.params.keyId);

  if (keyIndex === -1) {
    return res.status(404).json({
      error: {
        code: 'KEY_NOT_FOUND',
        message: 'Signing key not found',
      },
    });
  }

  signingKeys[keyIndex].status = 'revoked';
  res.status(204).send();
});

export default router;

# Key Management API

The Key Management API allows you to create and manage API keys and Ed25519 signing keys for authentication.

## Authentication

All key management endpoints require **Ed25519 signature authentication** or **session cookie authentication**. See [API Overview](./1-overview.md#authentication) for details.

## API Keys

API keys are used for simpler authentication scenarios like the Consumption API. Each API key has:
- A unique identifier
- A name/label
- An optional expiration date
- Active/inactive status
- A key prefix (for identification)

### List API Keys

**`GET /api/v1/api-keys`**

List all API keys for the current user.

**Response**:

```json
{
  "data": [
    {
      "id": "537fda13-3a1b-4bc7-9f89-706762e59f32",
      "name": "Production Key",
      "key_prefix": "GXqZyW6C",
      "key": null,
      "is_active": true,
      "expires_at": null
    },
    {
      "id": "6ccb605e-d67b-4fbb-b879-a579b6e995b9",
      "name": "Development Key",
      "key_prefix": "DYUdnu7i",
      "key": null,
      "is_active": true,
      "expires_at": "2025-12-31T23:59:59Z"
    }
  ]
}
```

**Note**: The `key` field is only populated when creating a new API key. Existing keys return `null` for security.

**Example**:

```javascript
import axios from 'axios';
import { SignatureAuth } from './auth';

async function listAPIKeys(auth) {
  const path = '/api/v1/api-keys';
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    { headers }
  );
  
  return response.data.data;
}

const keys = await listAPIKeys(auth);
console.log(`You have ${keys.length} API keys`);

keys.forEach(key => {
  const status = key.is_active ? '✓ Active' : '✗ Inactive';
  const expiry = key.expires_at ? `expires ${key.expires_at}` : 'never expires';
  console.log(`  ${key.name} (${key.key_prefix}...) - ${status}, ${expiry}`);
});
```

### Get API Key

**`GET /api/v1/api-keys/:id`**

Get details for a specific API key.

**Response**:

```json
{
  "data": {
    "id": "803108e7-7bb7-4d00-89e8-bd4a332685e7",
    "name": "My Test Key",
    "key_prefix": "lQ2Kt++x",
    "key": null,
    "is_active": true,
    "expires_at": null
  }
}
```

### Create API Key

**`POST /api/v1/api-keys`**

Create a new API key.

**Request Body**:

```json
{
  "api_key": {
    "name": "My New API Key",
    "expires_at": "2025-12-31T23:59:59Z"
  }
}
```

**Request Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Descriptive name for the key |
| `expires_at` | string | No | ISO 8601 expiration date (optional) |

**Response**:

```json
{
  "data": {
    "id": "8ff1bab4-795c-45b4-80e9-6cd4dc694e9a",
    "name": "My New API Key",
    "key": "WoqALXMfSU2l2yf+Z3W6MMa5XmQCpYQfZvXkD4gbv1c",
    "key_prefix": "WoqALXMf",
    "is_active": true,
    "expires_at": "2025-12-31T23:59:59Z"
  }
}
```

**⚠️ IMPORTANT**: The full `key` value is **only returned once** during creation. Store it securely - you cannot retrieve it later.

**Example**:

```javascript
async function createAPIKey(auth, name, expiresAt = null) {
  const path = '/api/v1/api-keys';
  const body = JSON.stringify({
    api_key: {
      name: name,
      expires_at: expiresAt
    }
  });
  const headers = auth.getHeaders('POST', path, body);
  
  const response = await axios.post(
    `https://trading.api.thegrid.ai${path}`,
    { api_key: { name, expires_at: expiresAt } },
    {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
  
  return response.data.data;
}

// Create API key that expires in 90 days
const expiryDate = new Date();
expiryDate.setDate(expiryDate.getDate() + 90);

const newKey = await createAPIKey(auth, 'Production API Key', expiryDate.toISOString());

console.log('⚠️  SAVE THIS KEY - It will not be shown again:');
console.log(`Key: ${newKey.key}`);
console.log(`Prefix: ${newKey.key_prefix}`);
console.log(`ID: ${newKey.id}`);

// Store the key securely
localStorage.setItem('grid_api_key', newKey.key); // Example - use secure storage in production
```

### Update API Key

**`PUT /api/v1/api-keys/:id`**

Update API key name or status.

**Request Body**:

```json
{
  "api_key": {
    "name": "Updated Name",
    "is_active": false
  }
}
```

**Response**: `204 No Content`

**Example**:

```javascript
async function updateAPIKey(auth, keyId, updates) {
  const path = `/api/v1/api-keys/${keyId}`;
  const body = JSON.stringify({ api_key: updates });
  const headers = auth.getHeaders('PUT', path, body);
  
  await axios.put(
    `https://trading.api.thegrid.ai${path}`,
    { api_key: updates },
    {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
  
  console.log('API key updated');
}

// Deactivate an API key
await updateAPIKey(auth, 'key_id_here', { is_active: false });

// Rename an API key
await updateAPIKey(auth, 'key_id_here', { name: 'New Key Name' });
```

### Delete API Key

**`DELETE /api/v1/api-keys/:id`**

Soft-delete an API key (marks as inactive).

**Response**: `204 No Content`

**Example**:

```javascript
async function deleteAPIKey(auth, keyId) {
  const path = `/api/v1/api-keys/${keyId}`;
  const headers = auth.getHeaders('DELETE', path, '');
  
  await axios.delete(
    `https://trading.api.thegrid.ai${path}`,
    { headers }
  );
  
  console.log('API key deleted');
}

await deleteAPIKey(auth, 'key_id_here');
```

## Signing Keys (Ed25519)

Signing keys are Ed25519 public/private key pairs used for signature-based authentication on Trading and Account APIs.

### Register Signing Key

**`POST /api/v1/signing-keys`**

Register a new Ed25519 public key.

**Request Body**:

```json
{
  "signing_key": {
    "label": "My Trading Key",
    "public_key": "ZTCP8582CQEW6CiKEcpKnF4DRbyjYWpPK7H74b/dwGA"
  }
}
```

**Request Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `label` | string | Yes | Descriptive label for the key |
| `public_key` | string | Yes | Base64-encoded Ed25519 public key (32 bytes) |

**Response**:

```json
{
  "data": {
    "id": "e776f6e2-06f8-48db-a3f6-97d6948723d2",
    "label": "My Trading Key",
    "public_key": "ZTCP8582CQEW6CiKEcpKnF4DRbyjYWpPK7H74b/dwGA"
  }
}
```

**Example**:

```javascript
import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

async function createSigningKey(auth, label) {
  // Generate Ed25519 key pair
  const keyPair = nacl.sign.keyPair();
  const publicKeyBase64 = util.encodeBase64(keyPair.publicKey);
  const privateKeyBase64 = util.encodeBase64(keyPair.secretKey);
  
  const path = '/api/v1/signing-keys';
  const body = JSON.stringify({
    signing_key: {
      label: label,
      public_key: publicKeyBase64
    }
  });
  const headers = auth.getHeaders('POST', path, body);
  
  const response = await axios.post(
    `https://trading.api.thegrid.ai${path}`,
    { signing_key: { label, public_key: publicKeyBase64 } },
    {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
  
  return {
    keyData: response.data.data,
    privateKey: privateKeyBase64,
    publicKey: publicKeyBase64
  };
}

// Create new signing key
const result = await createSigningKey(auth, 'Production Trading Key');

console.log('⚠️  SAVE THESE KEYS SECURELY:');
console.log(`Public Key: ${result.publicKey}`);
console.log(`Private Key: ${result.privateKey}`);
console.log(`Key ID: ${result.keyData.id}`);

// Store private key securely (example - use proper key management in production)
// NEVER commit private keys to version control
```

**Python Example**:

```python
from nacl.signing import SigningKey
from nacl.encoding import Base64Encoder
import requests
import json

def create_signing_key(auth, label):
    """Generate and register new Ed25519 signing key"""
    # Generate key pair
    private_key = SigningKey.generate()
    public_key = private_key.verify_key
    
    # Encode to Base64
    public_key_b64 = public_key.encode(Base64Encoder).decode('utf-8')
    private_key_b64 = bytes(private_key).hex()  # Or use Base64Encoder
    
    # Register public key
    path = '/api/v1/signing-keys'
    body = json.dumps({
        'signing_key': {
            'label': label,
            'public_key': public_key_b64
        }
    })
    headers = auth.get_headers('POST', path, body)
    headers['Content-Type'] = 'application/json'
    
    response = requests.post(
        f'https://trading.api.thegrid.ai{path}',
        json={'signing_key': {'label': label, 'public_key': public_key_b64}},
        headers=headers
    )
    response.raise_for_status()
    
    return {
        'key_data': response.json()['data'],
        'private_key': private_key_b64,
        'public_key': public_key_b64
    }

# Create signing key
result = create_signing_key(auth, 'My Trading Key')

print("⚠️  SAVE THESE KEYS SECURELY:")
print(f"Public Key: {result['public_key']}")
print(f"Private Key: {result['private_key']}")
print(f"Key ID: {result['key_data']['id']}")
```

### Revoke Signing Key

**`DELETE /api/v1/signing-keys/:id`**

Revoke a signing key (prevents further use).

**Response**:

```json
{
  "data": {
    "id": "dd3992af-0868-491e-aded-8bee8a907914",
    "label": "Test Key",
    "public_key": "iHrxWXNOEZmpYW51WCYLGswG8D+VVucBX3/v8JCUwEM"
  }
}
```

**Example**:

```javascript
async function revokeSigningKey(auth, keyId) {
  const path = `/api/v1/signing-keys/${keyId}`;
  const headers = auth.getHeaders('DELETE', path, '');
  
  const response = await axios.delete(
    `https://trading.api.thegrid.ai${path}`,
    { headers }
  );
  
  return response.data.data;
}

const revokedKey = await revokeSigningKey(auth, 'key_id_here');
console.log(`Revoked key: ${revokedKey.label}`);
```

## Key Rotation Best Practices

### API Key Rotation

```javascript
async function rotateAPIKey(auth, oldKeyId, newKeyName) {
  console.log('Starting API key rotation...');
  
  // Step 1: Create new key
  const newKey = await createAPIKey(auth, newKeyName);
  console.log(`✓ Created new key: ${newKey.key_prefix}...`);
  
  // Store new key securely
  const secureStorage = getSecureStorage();
  await secureStorage.save('grid_api_key', newKey.key);
  
  // Step 2: Test new key
  try {
    await testAPIKey(newKey.key);
    console.log('✓ New key verified');
  } catch (error) {
    console.error('✗ New key verification failed');
    throw error;
  }
  
  // Step 3: Update applications to use new key
  console.log('Update your applications to use the new key');
  console.log('Press Enter when ready to deactivate old key...');
  await waitForUserConfirmation();
  
  // Step 4: Deactivate old key
  await updateAPIKey(auth, oldKeyId, { is_active: false });
  console.log('✓ Old key deactivated');
  
  // Step 5: Wait grace period, then delete
  console.log('Waiting 24 hours before deleting old key...');
  setTimeout(async () => {
    await deleteAPIKey(auth, oldKeyId);
    console.log('✓ Old key deleted');
  }, 24 * 60 * 60 * 1000);
  
  return newKey;
}
```

### Signing Key Rotation

```javascript
import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

async function rotateSigningKey(auth, oldKeyId, newKeyLabel) {
  console.log('Starting signing key rotation...');
  
  // Step 1: Generate new key pair
  const keyPair = nacl.sign.keyPair();
  const publicKeyBase64 = util.encodeBase64(keyPair.publicKey);
  const privateKeyBase64 = util.encodeBase64(keyPair.secretKey);
  
  // Step 2: Register new public key
  const path = '/api/v1/signing-keys';
  const body = JSON.stringify({
    signing_key: {
      label: newKeyLabel,
      public_key: publicKeyBase64
    }
  });
  const headers = auth.getHeaders('POST', path, body);
  
  const response = await axios.post(
    `https://trading.api.thegrid.ai${path}`,
    { signing_key: { label: newKeyLabel, public_key: publicKeyBase64 } },
    {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
  
  console.log(`✓ New signing key registered: ${response.data.data.id}`);
  
  // Step 3: Test new key
  const newAuth = new SignatureAuth(privateKeyBase64, publicKeyBase64);
  try {
    await testSigningKey(newAuth);
    console.log('✓ New signing key verified');
  } catch (error) {
    console.error('✗ New signing key verification failed');
    throw error;
  }
  
  // Step 4: Update applications
  console.log('\n⚠️  SAVE THESE KEYS SECURELY:');
  console.log(`Private Key: ${privateKeyBase64}`);
  console.log(`Public Key: ${publicKeyBase64}`);
  console.log('\nUpdate your applications to use the new keys');
  
  // Step 5: Revoke old key after transition
  console.log('\nAfter updating all applications, revoke the old key:');
  console.log(`  DELETE /api/v1/signing-keys/${oldKeyId}`);
  
  return {
    keyId: response.data.data.id,
    privateKey: privateKeyBase64,
    publicKey: publicKeyBase64
  };
}

async function testSigningKey(auth) {
  // Test by making an authenticated request
  const path = '/api/v1/users/self';
  const headers = auth.getHeaders('GET', path, '');
  
  await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    { headers }
  );
}
```

## Key Management Dashboard

```javascript
class KeyManager {
  constructor(auth) {
    this.auth = auth;
    this.baseURL = 'https://trading.api.thegrid.ai';
  }
  
  async getAPIKeys() {
    const path = '/api/v1/api-keys';
    const headers = this.auth.getHeaders('GET', path, '');
    
    const response = await axios.get(`${this.baseURL}${path}`, { headers });
    return response.data.data;
  }
  
  async createAPIKey(name, expiresAt = null) {
    const path = '/api/v1/api-keys';
    const body = JSON.stringify({
      api_key: { name, expires_at: expiresAt }
    });
    const headers = this.auth.getHeaders('POST', path, body);
    
    const response = await axios.post(
      `${this.baseURL}${path}`,
      { api_key: { name, expires_at: expiresAt } },
      {
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      }
    );
    
    return response.data.data;
  }
  
  async deactivateAPIKey(keyId) {
    const path = `/api/v1/api-keys/${keyId}`;
    const body = JSON.stringify({ api_key: { is_active: false } });
    const headers = this.auth.getHeaders('PUT', path, body);
    
    await axios.put(
      `${this.baseURL}${path}`,
      { api_key: { is_active: false } },
      {
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      }
    );
  }
  
  async deleteAPIKey(keyId) {
    const path = `/api/v1/api-keys/${keyId}`;
    const headers = this.auth.getHeaders('DELETE', path, '');
    
    await axios.delete(`${this.baseURL}${path}`, { headers });
  }
  
  async listExpiringSoon(days = 30) {
    const keys = await this.getAPIKeys();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + days);
    
    return keys.filter(key => {
      if (!key.expires_at) return false;
      return new Date(key.expires_at) <= threshold;
    });
  }
  
  async dashboard() {
    const keys = await this.getAPIKeys();
    const active = keys.filter(k => k.is_active);
    const inactive = keys.filter(k => !k.is_active);
    const expiring = await this.listExpiringSoon(30);
    
    console.log('API Key Dashboard');
    console.log('=================');
    console.log(`Total keys: ${keys.length}`);
    console.log(`Active: ${active.length}`);
    console.log(`Inactive: ${inactive.length}`);
    console.log(`Expiring soon (30 days): ${expiring.length}`);
    
    if (expiring.length > 0) {
      console.log('\n⚠️  Keys expiring soon:');
      expiring.forEach(key => {
        const daysUntil = Math.ceil(
          (new Date(key.expires_at) - new Date()) / (1000 * 60 * 60 * 24)
        );
        console.log(`  ${key.name} - ${daysUntil} days until expiry`);
      });
    }
    
    return { total: keys.length, active: active.length, expiring: expiring.length };
  }
}

// Usage
const manager = new KeyManager(auth);
await manager.dashboard();
```

## Security Best Practices

1. **Rotate keys regularly** - Rotate API keys every 90 days, signing keys annually
2. **Use expiration dates** - Set expiration for temporary keys
3. **Deactivate before delete** - Test that services work without key before deleting
4. **Store keys securely** - Use environment variables or secret management services
5. **Never commit keys** - Add key files to .gitignore
6. **Use separate keys per environment** - Different keys for dev/staging/production
7. **Monitor key usage** - Track which keys are being used
8. **Implement key rotation** - Automate key rotation process
9. **Limit key permissions** - Use API keys for consumption, signing keys for trading
10. **Audit key access** - Regularly review active keys and revoke unused ones

## Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `INVALID_PUBLIC_KEY` | 422 | Public key format invalid or wrong size |
| `DUPLICATE_KEY` | 422 | Public key already registered |
| `KEY_NOT_FOUND` | 404 | Key ID not found |
| `FORBIDDEN` | 403 | Key belongs to different user |
| `INVALID_NAME` | 422 | Name is blank or too long |



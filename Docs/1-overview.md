# API Overview and Conventions

## Base URLs

The GRID API is available at the following base URLs:

| Environment | Base URL |
|------------|----------|
| **Production** | `https://trading.api.thegrid.ai/api/v1` |
| **Development** | `https://trading.api.thegrid.ai/v1` |
| **WebSocket** | `wss://trading.api.thegrid.ai/v1/` |

## Authentication

GRID API uses **Ed25519 signature-based authentication** for Trading and Accounts APIs. The Consumption API uses simple API key authentication.

### Ed25519 Signature Authentication

Each authenticated request must include three headers:

| Header | Description |
|--------|-------------|
| `x-thegrid-signature` | Base64-encoded Ed25519 signature |
| `x-thegrid-timestamp` | Unix timestamp (seconds since epoch) |
| `x-thegrid-fingerprint` | SHA256 hash of your public key (Base64-encoded) |

### Signature Generation Process

1. **Construct the message**: `timestamp + HTTP_METHOD + request_path + body`
2. **Sign the message** with your Ed25519 private key
3. **Base64 encode** the signature
4. **Include headers** in your request

### Key Format

- **Private Key**: 64 bytes, Base64-encoded Ed25519 private key
- **Public Key**: 32 bytes, Base64-encoded Ed25519 public key
- **Fingerprint**: SHA256 hash of the public key, Base64-encoded

### Example: JavaScript/TypeScript

```javascript
import nacl from 'tweetnacl';
import util from 'tweetnacl-util';
import crypto from 'crypto';

class SignatureAuth {
  constructor(privateKeyBase64, publicKeyBase64) {
    this.privateKey = util.decodeBase64(privateKeyBase64);
    
    // Calculate fingerprint (SHA256 of public key)
    const publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64');
    const hash = crypto.createHash('sha256').update(publicKeyBuffer).digest('base64');
    this.fingerprint = hash.replace(/=+$/, ''); // Remove padding
  }

  getHeaders(method, path, body = '') {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = `${timestamp}${method.toUpperCase()}${path}${body}`;
    
    const messageBytes = util.decodeUTF8(message);
    const signatureBytes = nacl.sign.detached(messageBytes, this.privateKey);
    const signature = util.encodeBase64(signatureBytes);

    return {
      'x-thegrid-signature': signature,
      'x-thegrid-timestamp': timestamp,
      'x-thegrid-fingerprint': this.fingerprint
    };
  }
}

// Usage
const auth = new SignatureAuth(
  'your_private_key_base64',
  'your_public_key_base64'
);

const headers = auth.getHeaders('GET', '/api/v1/trading/markets', '');
```

### Example: Python

```python
import time
import hashlib
import base64
from nacl.signing import SigningKey
from nacl.encoding import Base64Encoder

class SignatureAuth:
    def __init__(self, private_key_b64, public_key_b64):
        self.private_key = SigningKey(base64.b64decode(private_key_b64))
        
        # Calculate fingerprint (SHA256 of public key)
        public_key_bytes = base64.b64decode(public_key_b64)
        hash_digest = hashlib.sha256(public_key_bytes).digest()
        self.fingerprint = base64.b64encode(hash_digest).decode().rstrip('=')
    
    def get_headers(self, method, path, body=''):
        timestamp = str(int(time.time()))
        message = f"{timestamp}{method.upper()}{path}{body}"
        
        signature = self.private_key.sign(message.encode()).signature
        signature_b64 = base64.b64encode(signature).decode()
        
        return {
            'x-thegrid-signature': signature_b64,
            'x-thegrid-timestamp': timestamp,
            'x-thegrid-fingerprint': self.fingerprint
        }

# Usage
auth = SignatureAuth(
    'your_private_key_base64',
    'your_public_key_base64'
)

headers = auth.get_headers('GET', '/api/v1/trading/markets', '')
```

### Example: Go

```go
package main

import (
    "crypto/ed25519"
    "crypto/sha256"
    "encoding/base64"
    "fmt"
    "strconv"
    "time"
)

type SignatureAuth struct {
    privateKey  ed25519.PrivateKey
    fingerprint string
}

func NewSignatureAuth(privateKeyB64, publicKeyB64 string) (*SignatureAuth, error) {
    privateKeyBytes, _ := base64.StdEncoding.DecodeString(privateKeyB64)
    privateKey := ed25519.PrivateKey(privateKeyBytes)
    
    publicKeyBytes, _ := base64.StdEncoding.DecodeString(publicKeyB64)
    hash := sha256.Sum256(publicKeyBytes)
    fingerprint := base64.StdEncoding.EncodeToString(hash[:])
    
    return &SignatureAuth{
        privateKey:  privateKey,
        fingerprint: fingerprint,
    }, nil
}

func (sa *SignatureAuth) GetHeaders(method, path, body string) map[string]string {
    timestamp := strconv.FormatInt(time.Now().Unix(), 10)
    message := timestamp + method + path + body
    
    signature := ed25519.Sign(sa.privateKey, []byte(message))
    signatureB64 := base64.StdEncoding.EncodeToString(signature)
    
    return map[string]string{
        "x-thegrid-signature":   signatureB64,
        "x-thegrid-timestamp":   timestamp,
        "x-thegrid-fingerprint": sa.fingerprint,
    }
}

// Usage
auth, _ := NewSignatureAuth(privateKey, publicKey)
headers := auth.GetHeaders("GET", "/api/v1/trading/markets", "")
```

### Example: cURL

```bash
# First, generate the signature using a script
TIMESTAMP=$(date +%s)
METHOD="GET"
PATH="/api/v1/trading/markets"
BODY=""

# Use a signing script to generate SIGNATURE and FINGERPRINT
# (Ed25519 signing requires a library, not available in pure bash)

curl -X GET \
  "https://trading.api.thegrid.ai/v1/trading/markets" \
  -H "Content-Type: application/json" \
  -H "x-thegrid-signature: ${SIGNATURE}" \
  -H "x-thegrid-timestamp: ${TIMESTAMP}" \
  -H "x-thegrid-fingerprint: ${FINGERPRINT}"
```

## Request and Response Conventions

### Request Format

- **Content-Type**: `application/json`
- **Body**: JSON-encoded request body for POST/PUT requests
- **Query Parameters**: URL-encoded for GET requests

### Standard Response Format

All successful responses follow this structure:

```json
{
  "data": {
    // Response data here
  },
  "error": null,
  "meta": {
    "timestamp": "2025-01-01T00:00:00Z"
  }
}
```

### Error Response Format

Error responses include an error object with details:

```json
{
  "data": null,
  "error": {
    "code": "INVALID_ORDER",
    "message": "Insufficient balance to place order",
    "details": {
      "required": "1000.00",
      "available": "500.00"
    }
  },
  "meta": {
    "timestamp": "2025-01-01T00:00:00Z"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_SIGNATURE` | 401 | Authentication signature is invalid |
| `EXPIRED_TIMESTAMP` | 401 | Request timestamp is too old (>30s) |
| `INSUFFICIENT_BALANCE` | 400 | Not enough funds for operation |
| `INVALID_MARKET` | 404 | Market ID not found |
| `INVALID_ORDER` | 400 | Order parameters are invalid |
| `ORDER_NOT_FOUND` | 404 | Order ID not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Pagination Conventions

List endpoints support pagination using query parameters:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | integer | 50 | 100 | Number of results per page |
| `offset` | integer | 0 | - | Number of results to skip |
| `cursor` | string | - | - | Cursor for next page (if supported) |

### Example: Paginated Request

```javascript
// Get second page of 25 orders
const response = await axios.get('/api/v1/trading/orders', {
  params: {
    limit: 25,
    offset: 25,
    status: 'open'
  },
  headers: authHeaders
});
```

### Pagination Response

Paginated responses include metadata:

```json
{
  "data": [...],
  "meta": {
    "pagination": {
      "limit": 25,
      "offset": 25,
      "total": 150,
      "has_more": true
    }
  }
}
```

## Rate Limit Conventions

Rate limits are enforced per API key/account:

| API | Rate Limit |
|-----|------------|
| **Trading API** | 100 requests/minute |
| **Market Data API** | 300 requests/minute |
| **Accounts API** | 60 requests/minute |
| **Consumption API** | 60 requests/minute |
| **Order Placement** | 50 orders/minute |

### Rate Limit Headers

Every response includes rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### Rate Limit Response

When rate limited, you'll receive:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 30 seconds.",
    "details": {
      "retry_after": 30
    }
  }
}
```

**Status Code**: `429 Too Many Requests`

### Handling Rate Limits

```javascript
async function makeRequest(url, options) {
  try {
    const response = await axios.get(url, options);
    return response.data;
  } catch (error) {
    if (error.response?.status === 429) {
      const retryAfter = error.response.data.error.details?.retry_after || 60;
      console.log(`Rate limited. Waiting ${retryAfter} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return makeRequest(url, options); // Retry
    }
    throw error;
  }
}
```

## Versioning

The API version is specified in the base URL: `/api/v1`

### Version Policy

- **Current version**: v1
- **Breaking changes**: Will result in a new version (v2, v3, etc.)
- **Non-breaking changes**: Added to current version with changelog entries
- **Deprecation notice**: At least 6 months before removal

### Detecting API Version

Check the `X-Api-Version` response header:

```http
X-Api-Version: v1
```

## Idempotency

POST requests support idempotency using the `Idempotency-Key` header:

```javascript
const response = await axios.post(
  '/api/v1/trading/orders',
  orderData,
  {
    headers: {
      ...authHeaders,
      'Idempotency-Key': 'unique-order-id-12345'
    }
  }
);
```

- Idempotency keys are valid for 24 hours
- Retrying with the same key returns the original response
- Useful for preventing duplicate orders on network failures

## Timestamps

All timestamps in the API use **ISO 8601 format** with UTC timezone:

```
2025-01-01T12:34:56.789Z
```

For authentication, use **Unix timestamps** (seconds since epoch):

```
1704110096
```

## Testing

### Sandbox Environment

Use the development base URL for testing:

```
https://trading.api.thegrid.ai/v1
```

### Test Credentials

Contact support to obtain test API credentials.

## Best Practices

1. **Cache authentication objects** - Don't recreate signature generators for each request
2. **Implement exponential backoff** - For retries and rate limit handling
3. **Validate timestamps** - Ensure your system clock is synchronized
4. **Store keys securely** - Never commit keys to version control
5. **Use WebSockets for market data** - More efficient than polling REST endpoints
6. **Handle errors gracefully** - Check both HTTP status and error codes
7. **Monitor rate limits** - Track remaining quota in response headers

## Support

For API support and questions:

- **Email**: support@thegrid.ai
- **Documentation**: https://docs.grid.xyz
- **Status**: https://status.grid.xyz


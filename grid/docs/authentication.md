# Authentication

For the full agent onboarding path (login → keys → inference → trade), see [`Docs/CLI-PROGRAMMATIC-ONBOARDING.md`](../Docs/CLI-PROGRAMMATIC-ONBOARDING.md).

Grid supports two authentication methods:

1. **OAuth 2.0 Device Flow** (recommended) — browser-based login, like `gh auth login`
2. **Ed25519 Signing Keys** (legacy) — request-level digital signatures

## Quick Start: OAuth Login

The fastest way to authenticate is with the interactive device flow:

```bash
# Start the device login flow (opens browser)
grid auth login

# Optionally specify a profile name and exchange URL
grid auth login --profile prod --hostname https://exchange.thegrid.ai

# Check your auth status
grid auth status

# Verify Trading API reachability, credentials, mode, balances, and markets
grid verify

# Log out (revokes tokens)
grid auth logout
```

When you run `grid auth login`:

1. The CLI requests a device code from the exchange
2. A browser window opens to the authorization page
3. You sign in and approve the CLI's access
4. The CLI receives OAuth tokens and stores them in your profile

Tokens are automatically refreshed before they expire. The access token has a 1-hour TTL; the refresh token lasts 30 days.

### Scopes

By default, `grid auth login` requests all available scopes:

| Scope | Description |
|-------|-------------|
| `account:read` | View account info and balances |
| `account:write` | Modify account settings |
| `trade:read` | View orders and trades |
| `trade:write` | Place and cancel orders |
| `supply:read` | View supply issuances |
| `supply:write` | Issue and transfer supply |
| `keys:manage` | Manage signing keys |

Request specific scopes with `--scopes "trade:read trade:write"`.

Verify the authorized account matches your intent:

```bash
grid auth login --email you@company.com
```

After login, manage programmatic credentials (requires `keys:manage`):

```bash
grid consumption keys list
grid consumption keys create --name "my-agent"
grid trading keys create --label "my-bot"
grid account settings
```

Consumption inference uses `Authorization: Bearer` (profile API key when set, else OAuth access token, else `GRID_CLI_CONSUMPTION_KEY`) — not `x-consumption-key`. Hybrid `oauth-dev` profiles from `mix grid_cli.oauth_dev_profile` include both OAuth and the seeded consumption API key.

### Legacy Login Instructions

To see the manual credential setup instructions (Ed25519 signing keys):

```bash
grid auth login --legacy
```

---

## Ed25519 Signing Keys (Legacy)

Ed25519 digital signatures provide:

- **Security**: Signatures cannot be forged without the private key
- **Non-repudiation**: Only the key owner could have made the request
- **Freshness**: Timestamps prevent replay attacks

### Overview

Every authenticated request includes three headers:

| Header | Description |
|--------|-------------|
| `x-thegrid-signature` | Ed25519 signature of the request |
| `x-thegrid-timestamp` | Unix timestamp (seconds) |
| `x-thegrid-fingerprint` | SHA256 hash of your public key |

## Signature Format

The signature is created by signing a message with the following format:

```
{timestamp}{METHOD}{path}{body}
```

For example:

```
1706500000GET/v1/orders
1706500000POST/v1/orders{"market_id":"market_abc","type":"limit","side":"buy","price":"0.68","quantity":1}
```

Sign the path component only. Do not include the query string in the signed message; for `GET /v1/orders?status=filled`, sign `/v1/orders`.

Trading private keys are base64-encoded raw Ed25519 seed or secret-key bytes, not PEM blocks. If you are using another language, decode the base64 bytes directly before signing.

## Key Generation

### Using the SDK

```typescript
import { generateKeyPair, calculateFingerprint } from '@the-gridai/grid-sdk';

// Generate new key pair
const { signingKey, publicKey } = generateKeyPair();

// Calculate fingerprint (SHA256 of public key, base64 without padding)
const fingerprint = await calculateFingerprint(publicKey);

console.log('Store securely:');
console.log('  Signing Key:', signingKey);

console.log('\nRegister with Grid:');
console.log('  Public Key:', publicKey);
console.log('  Fingerprint:', fingerprint);
```

### Using OpenSSL

```bash
# Generate Ed25519 private key
openssl genpkey -algorithm ed25519 -outform DER | \
  tail -c 32 | \
  base64

# Extract public key (from private key file)
openssl pkey -in private.pem -pubout -outform DER | \
  tail -c 32 | \
  base64

# Calculate fingerprint (SHA256 of public key)
echo -n "YOUR_PUBLIC_KEY" | \
  base64 -d | \
  openssl dgst -sha256 -binary | \
  base64 | \
  tr -d '='
```

## Using with the SDK

The SDK handles signature generation automatically:

```typescript
import { GridClient } from '@the-gridai/grid-sdk';

const client = new GridClient({
  apiUrl: 'https://api.thegrid.ai',
  signingKey: process.env.GRID_SIGNING_KEY!,
  fingerprint: process.env.GRID_FINGERPRINT!,
});

// All requests are automatically signed
const orders = await client.orders.list();
```

## Manual Signature Generation

If you need to generate signatures manually (e.g., for a different language):

```typescript
import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

function signRequest(
  method: string,
  path: string,
  body: string,
  signingKey: string
): { signature: string; timestamp: string } {
  // Current timestamp
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Construct message
  const message = `${timestamp}${method.toUpperCase()}${path}${body}`;
  
  // Decode signing key
  const keyBytes = util.decodeBase64(signingKey);
  
  // Get full keypair from seed (if 32 bytes)
  const keypair = keyBytes.length === 32
    ? nacl.sign.keyPair.fromSeed(keyBytes)
    : { secretKey: keyBytes };
  
  // Sign message
  const messageBytes = util.decodeUTF8(message);
  const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signature = util.encodeBase64(signatureBytes);
  
  return { signature, timestamp };
}
```

## Security Best Practices

### Do

- Store signing keys securely (environment variables, secret managers)
- Rotate keys periodically
- Use HTTPS for all requests
- Keep system clocks synchronized; Trading API signatures use a 30-second timestamp window

### Don't

- Commit signing keys to version control
- Share signing keys between environments
- Store signing keys in client-side code
- Disable signature verification

## Timestamp Validation

The server validates request timestamps to prevent replay attacks:

- Requests more than 30 seconds away from server time are rejected

If you receive timestamp errors:

1. Ensure your system clock is synchronized (NTP)
2. Check for timezone issues
3. Verify timestamp is in seconds (not milliseconds)

## Key Registration

To use the API, register your public key:

1. Log in to [Grid](https://thegrid.ai)
2. Go to Settings → API Keys
3. Click "Add Signing Key"
4. Enter your public key and a label
5. Save the generated fingerprint

## Troubleshooting

### Invalid Signature

- Verify the message format is exactly `{timestamp}{METHOD}{path}{body}`
- Check that the body is the exact JSON string sent (no whitespace changes)
- Ensure the path includes the leading slash and excludes query strings
- Verify the method is uppercase

### First-run Trading verifier

Run this before placing live orders:

```bash
grid verify
```

The verifier checks `GET /v1/health`, signed `GET /v1/me`, signed `GET /v1/trading-accounts`, and `GET /v1/markets`. It reports Auto/Easy mode as a warning because reads still work, but order create/update/cancel returns `auto_mode_trading_restricted` after onboarding until the account is switched to Advanced mode.

### Invalid Timestamp

- Synchronize your system clock
- Check timestamp is in seconds, not milliseconds
- Ensure timestamp is within 30 seconds of server time

### Invalid Fingerprint

- Verify the fingerprint matches your registered public key
- Check for base64 padding (should not have trailing `=`)
- Ensure you're using the correct key for this environment

## Example: Complete Request

```bash
# Variables
SIGNING_KEY="your-base64-signing-key"
FINGERPRINT="your-fingerprint"
TIMESTAMP=$(date +%s)
METHOD="GET"
PATH="/trading/orders"
BODY=""

# Create message
MESSAGE="${TIMESTAMP}${METHOD}${PATH}${BODY}"

# Sign (using Node.js)
SIGNATURE=$(node -e "
  const nacl = require('tweetnacl');
  const util = require('tweetnacl-util');
  const keyBytes = util.decodeBase64('$SIGNING_KEY');
  const keypair = nacl.sign.keyPair.fromSeed(keyBytes);
  const messageBytes = util.decodeUTF8('$MESSAGE');
  const sig = nacl.sign.detached(messageBytes, keypair.secretKey);
  console.log(util.encodeBase64(sig));
")

# Make request
curl -X GET "https://api.thegrid.ai${PATH}" \
  -H "Content-Type: application/json" \
  -H "x-thegrid-signature: ${SIGNATURE}" \
  -H "x-thegrid-timestamp: ${TIMESTAMP}" \
  -H "x-thegrid-fingerprint: ${FINGERPRINT}"
```

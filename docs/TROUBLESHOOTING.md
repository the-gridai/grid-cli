# Troubleshooting Guide

This guide helps you diagnose and fix common issues with GRID CLI.

## Table of Contents

- [Authentication Issues](#authentication-issues)
- [Network Connectivity](#network-connectivity)
- [Rate Limiting](#rate-limiting)
- [WebSocket Issues](#websocket-issues)
- [Order Placement Errors](#order-placement-errors)
- [Balance and Account Issues](#balance-and-account-issues)
- [TypeScript Compilation Errors](#typescript-compilation-errors)
- [General Debugging](#general-debugging)

---

## Authentication Issues

### Error: "Authentication failed"

**Symptom:** API requests fail with 401 or 403 status codes.

**Causes & Solutions:**

1. **Missing or invalid keys**
   ```bash
   # Check if key files exist
   ls -la ed25519.key ed25519_pub.der
   
   # Verify file permissions
   chmod 600 ed25519.key
   chmod 644 ed25519_pub.der
   ```

2. **Keys not registered with API**
   - Go to the GRID web interface
   - Navigate to Settings > API Keys
   - Register your public key (ed25519_pub.der)

3. **Incorrect environment variables**
   ```bash
   # Check .env file
   cat .env
   
   # Ensure paths are correct
   TRADING_PRIVATE_KEY_PATH=./ed25519.key
   TRADING_PUBLIC_KEY_PATH=./ed25519_pub.der
   ```

4. **Key format issues**
   - Keys must be Base64 encoded
   - Private key: 64 bytes (96 characters Base64)
   - Public key: 32 bytes (44 characters Base64)

**Test your authentication:**
```typescript
import { ApiClient } from './src/sdk/http/client';

const client = ApiClient.getInstance();
const accounts = await client.getTradingAccounts();
console.log('Authentication successful!', accounts);
```

---

## Network Connectivity

### Error: "Network error occurred" or "ECONNREFUSED"

**Symptom:** Cannot connect to API or WebSocket.

**Solutions:**

1. **Check API URL**
   ```bash
   # Verify in .env
   API_URL=https://trading.api.thegrid.ai/v1
   WS_URL=wss://trading.api.thegrid.ai/v1/
   ```

2. **Test connectivity**
   ```bash
   # Test HTTP connectivity
   curl https://trading.api.thegrid.ai/v1/instruments
   
   # Test WebSocket connectivity (requires wscat)
   wscat -c wss://trading.api.thegrid.ai/v1/
   ```

3. **Check firewall/proxy**
   - Ensure outbound HTTPS (443) is allowed
   - Check corporate proxy settings
   - Try from a different network

4. **DNS issues**
   ```bash
   # Verify DNS resolution
   nslookup trading.api.thegrid.ai
   ```

### Error: "Request timeout"

**Symptom:** Requests hang and eventually timeout.

**Solutions:**

1. **Increase timeout**
   ```env
   # In .env
   SDK_REQUEST_TIMEOUT=60000  # 60 seconds
   ```

2. **Check network latency**
   ```bash
   ping trading.api.thegrid.ai
   ```

3. **Retry configuration**
   - The SDK automatically retries transient failures
   - Check logs for retry attempts

---

## Rate Limiting

### Error: "Rate limit exceeded"

**Symptom:** Requests fail with 429 status code.

**Solutions:**

1. **Adjust rate limiter config**
   ```env
   # In .env - reduce concurrent requests
   SDK_RATE_LIMIT_CONCURRENT=5
   
   # Increase interval between requests
   SDK_RATE_LIMIT_INTERVAL=200
   ```

2. **The SDK handles rate limits automatically**
   - Waits for retry-after header
   - Uses exponential backoff
   - Check logs for retry messages

3. **Reduce request frequency**
   ```typescript
   // Instead of continuous polling
   setInterval(async () => {
     const ticker = await client.getTicker(marketId);
   }, 1000); // Too frequent!
   
   // Use WebSocket for real-time data
   const ws = WebSocketClient.getInstance();
   ws.connect();
   ws.subscribe('ticker', { market_id: marketId });
   ```

4. **Check rate limiter status**
   ```typescript
   const status = client.getRateLimiterStatus();
   console.log('Rate limiter:', status);
   ```

---

## WebSocket Issues

### WebSocket won't connect

**Symptom:** WebSocket connection fails or immediately disconnects.

**Solutions:**

1. **Check WebSocket URL**
   ```env
   # In .env
   WS_URL=wss://trading.api.thegrid.ai/v1/
   ```

2. **Test WebSocket manually**
   ```bash
   npm install -g wscat
   wscat -c wss://trading.api.thegrid.ai/v1/
   ```

3. **Check logs**
   ```typescript
   import { WebSocketClient } from './src/sdk/ws/client';
   
   const ws = WebSocketClient.getInstance();
   
   ws.on('error', (error) => {
     console.error('WebSocket error:', error);
   });
   
   ws.on('connected', () => {
     console.log('WebSocket connected!');
   });
   
   ws.connect();
   ```

### WebSocket keeps reconnecting

**Symptom:** Continuous reconnection attempts.

**Possible Causes:**

1. **Heartbeat timeout** - Server not responding to pings
2. **Network instability** - Intermittent connection
3. **Authentication issues** - If WebSocket requires auth

**Solutions:**

1. **Check connection state**
   ```typescript
   const stats = ws.getStats();
   console.log('WebSocket stats:', stats);
   ```

2. **Adjust heartbeat settings**
   ```typescript
   ws.updateConfig({
     heartbeatInterval: 60000, // 60 seconds
     heartbeatTimeout: 10000   // 10 seconds
   });
   ```

3. **Check for errors in logs**
   - Look for "WebSocket error" messages
   - Check "heartbeat timeout" warnings

---

## Order Placement Errors

### Error: "Insufficient balance"

**Symptom:** Orders fail with "INSUFFICIENT_BALANCE" error.

**Solutions:**

1. **Check your balances**
   ```typescript
   const accounts = await client.getTradingAccounts();
   accounts.forEach(account => {
     console.log(`${account.instrument_symbol}: ${account.available_balance}`);
   });
   ```

2. **Account for reserved balance**
   - Available balance = Total balance - Reserved balance
   - Reserved balance includes open orders

3. **Cancel unnecessary orders**
   ```typescript
   await client.cancelAllOrders();
   ```

### Error: "Validation failed"

**Symptom:** Order rejected with validation error.

**Common Issues:**

1. **Limit orders missing price**
   ```typescript
   // ❌ Wrong
   await client.placeOrder({
     market_id: 'market_123',
     side: 'buy',
     type: 'limit',
     quantity: '10'
     // Missing price!
   });
   
   // ✅ Correct
   await client.placeOrder({
     market_id: 'market_123',
     side: 'buy',
     type: 'limit',
     quantity: '10',
     price: '100.50'
   });
   ```

2. **Invalid quantity**
   - Must be positive
   - Must be a string (not number)
   - Must meet market minimum/maximum

3. **Invalid market ID**
   - Get valid markets: `await client.getMarkets()`

4. **The SDK validates inputs**
   - Check error.validationErrors for details
   - Fix the parameters and retry

---

## Balance and Account Issues

### Can't see my balance

**Symptom:** getTradingAccounts() returns empty or missing accounts.

**Solutions:**

1. **Check authentication** - See [Authentication Issues](#authentication-issues)

2. **Verify account type**
   ```typescript
   // Trading accounts
   const trading = await client.getTradingAccounts();
   
   // Currency accounts
   const currency = await client.getCurrencyTradingAccounts();
   
   // Consumption accounts
   const consumption = await client.getConsumptionInstruments();
   ```

3. **Account may need initialization**
   - Make a small deposit
   - Trade to create the account

---

## TypeScript Compilation Errors

### Error: "Cannot find module" or type errors

**Solutions:**

1. **Reinstall dependencies**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Rebuild**
   ```bash
   npm run build
   ```

3. **Check TypeScript version**
   ```bash
   npx tsc --version
   # Should be >= 5.2
   ```

4. **Clear TypeScript cache**
   ```bash
   rm -rf dist/
   npm run build
   ```

---

## General Debugging

### Enable debug logging

**In your code:**
```env
# In .env
LOG_LEVEL=debug
```

**Check logs:**
```bash
# Error logs
tail -f error.log

# All logs
tail -f combined.log
```

### Get detailed error information

```typescript
import { ApiError, NetworkError } from './src/core/errors';

try {
  await client.placeOrder(order);
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API Error:', {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      details: error.details
    });
  } else if (error instanceof NetworkError) {
    console.error('Network Error:', {
      message: error.message,
      originalError: error.originalError
    });
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Test individual components

**Test API client:**
```bash
npx ts-node scripts/test-auth.ts
```

**Test order placement:**
```bash
npx ts-node scripts/test-order.ts
```

**Check SDK status:**
```typescript
// Rate limiter
const rateLimiterStatus = client.getRateLimiterStatus();
console.log('Rate limiter:', rateLimiterStatus);

// WebSocket
const wsStats = ws.getStats();
console.log('WebSocket:', wsStats);
```

---

## Getting Help

If you're still experiencing issues:

1. **Check the logs** - Look in `error.log` and `combined.log`
2. **Enable debug mode** - Set `LOG_LEVEL=debug` in `.env`
3. **Review the documentation** - See `Docs/` directory
4. **Check the example** - Run `examples/simple-bot.ts`
5. **Contact support** - Provide:
   - Error message and stack trace
   - Relevant log entries
   - SDK version: `cat package.json | grep version`
   - Node version: `node --version`
   - TypeScript version: `npx tsc --version`

---

## Common Error Messages Reference

| Error | Cause | Solution |
|-------|-------|----------|
| `Authentication failed` | Invalid or missing keys | Check [Authentication Issues](#authentication-issues) |
| `Network error occurred` | Cannot reach API | Check [Network Connectivity](#network-connectivity) |
| `Rate limit exceeded` | Too many requests | Reduce request frequency or adjust rate limiter |
| `Insufficient balance` | Not enough funds | Check balances and cancel open orders |
| `Validation failed` | Invalid order parameters | Check error.validationErrors for details |
| `Order not found` | Invalid order ID | Verify order ID exists |
| `Market not found` | Invalid market ID | Get valid markets with getMarkets() |
| `Request timeout` | Slow network or overloaded API | Increase timeout or check connectivity |
| `WebSocket disconnected` | Connection lost | SDK auto-reconnects, check network |


/**
 * Unit tests for input validators
 */

import { describe, it, expect } from '@jest/globals';
import { ValidationError } from '../../../../src/core/errors';
import {
  PlaceOrderRequestSchema,
  UpdateOrderRequestSchema,
  TransferFromIssuanceRequestSchema,
  ChatCompletionRequestSchema,
  RegisterUserRequestSchema,
  CreateApiKeyRequestSchema,
  validatePlaceOrderRequest,
  validateUpdateOrderRequest,
  validateTransferFromIssuanceRequest,
  validateChatCompletionRequest
} from '../../../../src/sdk/validators/inputs';

describe('PlaceOrderRequest validation', () => {
  it('should validate valid limit order', () => {
    const validOrder = {
      market_id: 'market_123',
      side: 'buy' as const,
      type: 'limit' as const,
      quantity: '10',
      price: '100.50',
      time_in_force: 'gtc' as const
    };

    const result = validatePlaceOrderRequest(validOrder);
    expect(result).toEqual(validOrder);
  });

  it('should validate valid market order', () => {
    const validOrder = {
      market_id: 'market_123',
      side: 'sell' as const,
      type: 'market' as const,
      quantity: '5'
    };

    const result = validatePlaceOrderRequest(validOrder);
    expect(result).toEqual(validOrder);
  });

  it('should fail with missing market_id', () => {
    const invalidOrder = {
      side: 'buy',
      type: 'limit',
      quantity: '10',
      price: '100.50'
    };

    expect(() => validatePlaceOrderRequest(invalidOrder)).toThrow(ValidationError);
  });

  it('should fail with empty market_id', () => {
    const invalidOrder = {
      market_id: '',
      side: 'buy',
      type: 'limit',
      quantity: '10',
      price: '100.50'
    };

    expect(() => validatePlaceOrderRequest(invalidOrder)).toThrow();
  });

  it('should fail with invalid side', () => {
    const invalidOrder = {
      market_id: 'market_123',
      side: 'invalid',
      type: 'limit',
      quantity: '10',
      price: '100.50'
    };

    expect(() => validatePlaceOrderRequest(invalidOrder)).toThrow(ValidationError);
  });

  it('should fail with invalid type', () => {
    const invalidOrder = {
      market_id: 'market_123',
      side: 'buy',
      type: 'invalid',
      quantity: '10',
      price: '100.50'
    };

    expect(() => validatePlaceOrderRequest(invalidOrder)).toThrow(ValidationError);
  });

  it('should fail with negative quantity', () => {
    const invalidOrder = {
      market_id: 'market_123',
      side: 'buy',
      type: 'limit',
      quantity: '-10',
      price: '100.50'
    };

    expect(() => validatePlaceOrderRequest(invalidOrder)).toThrow(ValidationError);
  });

  it('should fail with zero quantity', () => {
    const invalidOrder = {
      market_id: 'market_123',
      side: 'buy',
      type: 'limit',
      quantity: '0',
      price: '100.50'
    };

    expect(() => validatePlaceOrderRequest(invalidOrder)).toThrow(ValidationError);
  });

  it('should fail with non-numeric quantity', () => {
    const invalidOrder = {
      market_id: 'market_123',
      side: 'buy',
      type: 'limit',
      quantity: 'abc',
      price: '100.50'
    };

    expect(() => validatePlaceOrderRequest(invalidOrder)).toThrow(ValidationError);
  });

  it('should fail limit order without price', () => {
    const invalidOrder = {
      market_id: 'market_123',
      side: 'buy',
      type: 'limit',
      quantity: '10'
    };

    expect(() => validatePlaceOrderRequest(invalidOrder)).toThrow(ValidationError);
  });

  it('should fail stop_limit order without price', () => {
    const invalidOrder = {
      market_id: 'market_123',
      side: 'buy',
      type: 'stop_limit',
      quantity: '10',
      stop_price: '95.00'
    };

    expect(() => validatePlaceOrderRequest(invalidOrder)).toThrow(ValidationError);
  });

  it('should fail stop order without stop_price', () => {
    const invalidOrder = {
      market_id: 'market_123',
      side: 'buy',
      type: 'stop',
      quantity: '10'
    };

    expect(() => validatePlaceOrderRequest(invalidOrder)).toThrow(ValidationError);
  });

  it('should fail stop_limit order without stop_price', () => {
    const invalidOrder = {
      market_id: 'market_123',
      side: 'buy',
      type: 'stop_limit',
      quantity: '10',
      price: '100.00'
    };

    expect(() => validatePlaceOrderRequest(invalidOrder)).toThrow(ValidationError);
  });

  it('should accept optional fields', () => {
    const validOrder = {
      market_id: 'market_123',
      side: 'buy' as const,
      type: 'limit' as const,
      quantity: '10',
      price: '100.50',
      client_order_id: 'my_order_123',
      post_only: true,
      reduce_only: false
    };

    const result = validatePlaceOrderRequest(validOrder);
    expect(result).toEqual(validOrder);
  });
});

describe('UpdateOrderRequest validation', () => {
  it('should validate valid update with price', () => {
    const validUpdate = {
      price: '105.00'
    };

    const result = UpdateOrderRequestSchema.parse(validUpdate);
    expect(result).toEqual(validUpdate);
  });

  it('should validate valid update with quantity', () => {
    const validUpdate = {
      quantity: '15'
    };

    const result = UpdateOrderRequestSchema.parse(validUpdate);
    expect(result).toEqual(validUpdate);
  });

  it('should validate update with multiple fields', () => {
    const validUpdate = {
      price: '105.00',
      quantity: '15',
      time_in_force: 'ioc' as const
    };

    const result = UpdateOrderRequestSchema.parse(validUpdate);
    expect(result).toEqual(validUpdate);
  });

  it('should fail with no fields', () => {
    const invalidUpdate = {};

    expect(() => UpdateOrderRequestSchema.parse(invalidUpdate)).toThrow();
  });

  it('should fail with negative price', () => {
    const invalidUpdate = {
      price: '-10.00'
    };

    expect(() => UpdateOrderRequestSchema.parse(invalidUpdate)).toThrow();
  });

  it('should fail with non-numeric quantity', () => {
    const invalidUpdate = {
      quantity: 'invalid'
    };

    expect(() => UpdateOrderRequestSchema.parse(invalidUpdate)).toThrow();
  });
});

describe('TransferFromIssuanceRequest validation', () => {
  it('should validate valid transfer', () => {
    const validTransfer = {
      instrument_id: 'instr_123',
      quantity: 100,
      trading_account_id: 'acct_456'
    };

    const result = validateTransferFromIssuanceRequest(validTransfer);
    expect(result).toEqual(validTransfer);
  });

  it('should fail with missing instrument_id', () => {
    const invalidTransfer = {
      quantity: 100,
      trading_account_id: 'acct_456'
    };

    expect(() => validateTransferFromIssuanceRequest(invalidTransfer)).toThrow(ValidationError);
  });

  it('should fail with empty instrument_id', () => {
    const invalidTransfer = {
      instrument_id: '',
      quantity: 100,
      trading_account_id: 'acct_456'
    };

    expect(() => validateTransferFromIssuanceRequest(invalidTransfer)).toThrow(ValidationError);
  });

  it('should fail with negative quantity', () => {
    const invalidTransfer = {
      instrument_id: 'instr_123',
      quantity: -100,
      trading_account_id: 'acct_456'
    };

    expect(() => validateTransferFromIssuanceRequest(invalidTransfer)).toThrow(ValidationError);
  });

  it('should fail with zero quantity', () => {
    const invalidTransfer = {
      instrument_id: 'instr_123',
      quantity: 0,
      trading_account_id: 'acct_456'
    };

    expect(() => validateTransferFromIssuanceRequest(invalidTransfer)).toThrow(ValidationError);
  });

  it('should fail with non-integer quantity', () => {
    const invalidTransfer = {
      instrument_id: 'instr_123',
      quantity: 100.5,
      trading_account_id: 'acct_456'
    };

    expect(() => validateTransferFromIssuanceRequest(invalidTransfer)).toThrow(ValidationError);
  });

  it('should fail with missing trading_account_id', () => {
    const invalidTransfer = {
      instrument_id: 'instr_123',
      quantity: 100
    };

    expect(() => validateTransferFromIssuanceRequest(invalidTransfer)).toThrow(ValidationError);
  });
});

describe('ChatCompletionRequest validation', () => {
  it('should validate valid chat request', () => {
    const validRequest = {
      model: 'gpt-4',
      messages: [
        { role: 'user' as const, content: 'Hello' }
      ]
    };

    const result = validateChatCompletionRequest(validRequest);
    expect(result).toEqual(validRequest);
  });

  it('should validate request with all options', () => {
    const validRequest = {
      model: 'gpt-4',
      messages: [
        { role: 'system' as const, content: 'You are helpful' },
        { role: 'user' as const, content: 'Hello' }
      ],
      temperature: 0.7,
      max_tokens: 100,
      top_p: 0.9,
      frequency_penalty: 0.5,
      presence_penalty: 0.3,
      stop: ['END'],
      stream: false,
      n: 1
    };

    const result = validateChatCompletionRequest(validRequest);
    expect(result).toEqual(validRequest);
  });

  it('should strip unknown properties', () => {
    const requestWithExtra = {
      model: 'gpt-4',
      messages: [{ role: 'user' as const, content: 'Hello' }],
      custom_field: 'value'
    };

    const result = validateChatCompletionRequest(requestWithExtra);
    expect(result).not.toHaveProperty('custom_field');
  });

  it('should fail with missing model', () => {
    const invalidRequest = {
      messages: [{ role: 'user', content: 'Hello' }]
    };

    expect(() => validateChatCompletionRequest(invalidRequest)).toThrow(ValidationError);
  });

  it('should fail with empty model', () => {
    const invalidRequest = {
      model: '',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    expect(() => validateChatCompletionRequest(invalidRequest)).toThrow(ValidationError);
  });

  it('should fail with missing messages', () => {
    const invalidRequest = {
      model: 'gpt-4'
    };

    expect(() => validateChatCompletionRequest(invalidRequest)).toThrow(ValidationError);
  });

  it('should fail with empty messages array', () => {
    const invalidRequest = {
      model: 'gpt-4',
      messages: []
    };

    expect(() => validateChatCompletionRequest(invalidRequest)).toThrow(ValidationError);
  });

  it('should fail with temperature out of range', () => {
    const invalidRequest = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 3.0
    };

    expect(() => validateChatCompletionRequest(invalidRequest)).toThrow(ValidationError);
  });

  it('should fail with negative temperature', () => {
    const invalidRequest = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: -0.5
    };

    expect(() => validateChatCompletionRequest(invalidRequest)).toThrow(ValidationError);
  });

  it('should fail with top_p out of range', () => {
    const invalidRequest = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      top_p: 1.5
    };

    expect(() => validateChatCompletionRequest(invalidRequest)).toThrow(ValidationError);
  });

  it('should fail with negative max_tokens', () => {
    const invalidRequest = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: -100
    };

    expect(() => validateChatCompletionRequest(invalidRequest)).toThrow(ValidationError);
  });
});

describe('RegisterUserRequest validation', () => {
  it('should validate valid registration', () => {
    const validRequest = {
      email: 'user@example.com',
      password: 'password123',
      password_confirmation: 'password123'
    };

    const result = RegisterUserRequestSchema.parse(validRequest);
    expect(result).toEqual(validRequest);
  });

  it('should fail with invalid email', () => {
    const invalidRequest = {
      email: 'invalid-email',
      password: 'password123',
      password_confirmation: 'password123'
    };

    expect(() => RegisterUserRequestSchema.parse(invalidRequest)).toThrow();
  });

  it('should fail with short password', () => {
    const invalidRequest = {
      email: 'user@example.com',
      password: 'short',
      password_confirmation: 'short'
    };

    expect(() => RegisterUserRequestSchema.parse(invalidRequest)).toThrow();
  });

  it('should fail with mismatched passwords', () => {
    const invalidRequest = {
      email: 'user@example.com',
      password: 'password123',
      password_confirmation: 'different'
    };

    expect(() => RegisterUserRequestSchema.parse(invalidRequest)).toThrow();
  });
});

describe('CreateApiKeyRequest validation', () => {
  it('should validate valid request', () => {
    const validRequest = {
      name: 'My API Key'
    };

    const result = CreateApiKeyRequestSchema.parse(validRequest);
    expect(result).toEqual(validRequest);
  });

  it('should validate with expiry', () => {
    const validRequest = {
      name: 'My API Key',
      expires_at: '2025-12-31T23:59:59Z'
    };

    const result = CreateApiKeyRequestSchema.parse(validRequest);
    expect(result).toEqual(validRequest);
  });

  it('should fail with empty name', () => {
    const invalidRequest = {
      name: ''
    };

    expect(() => CreateApiKeyRequestSchema.parse(invalidRequest)).toThrow();
  });
});


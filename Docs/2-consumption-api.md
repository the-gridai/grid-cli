# Consumption API

The Consumption API allows you to consume purchased AI inference credits from the GRID exchange.

## Authentication

The Consumption API uses **API key authentication** via the `Authorization` header (Bearer token):

```http
Authorization: Bearer your_consumption_api_key_here
```

Create keys with `grid consumption keys create` (OAuth `keys:manage` on Exchange) or the Exchange `POST /api/v1/api-keys` endpoint. This is simpler than the Ed25519 signature authentication used by the Trading API.

> **Note:** Older docs referenced `x-consumption-key`; the Consumption API and grid-cli now use Bearer only.

## Chat Endpoint

### `POST /consumption/chat`

Generate AI completions using your purchased compute credits.

**Endpoint**: `POST /api/v1/consumption/chat`

**Request Body**:

```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "What is the capital of France?"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 150,
  "stream": false
}
```

**Request Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `model` | string | Yes | - | Model identifier (e.g., "gpt-4", "gpt-3.5-turbo") |
| `messages` | array | Yes | - | Array of message objects with `role` and `content` |
| `temperature` | float | No | 0.7 | Sampling temperature (0.0 to 2.0) |
| `max_tokens` | integer | No | 150 | Maximum tokens to generate |
| `top_p` | float | No | 1.0 | Nucleus sampling parameter |
| `frequency_penalty` | float | No | 0.0 | Frequency penalty (-2.0 to 2.0) |
| `presence_penalty` | float | No | 0.0 | Presence penalty (-2.0 to 2.0) |
| `stream` | boolean | No | false | Enable streaming responses |

**Response**:

```json
{
  "data": {
    "id": "chatcmpl-abc123",
    "object": "chat.completion",
    "created": 1704110096,
    "model": "gpt-4",
    "choices": [
      {
        "index": 0,
        "message": {
          "role": "assistant",
          "content": "The capital of France is Paris."
        },
        "finish_reason": "stop"
      }
    ],
    "usage": {
      "prompt_tokens": 20,
      "completion_tokens": 7,
      "total_tokens": 27
    }
  },
  "meta": {
    "timestamp": "2025-01-01T00:00:00Z",
    "credits_used": "0.0027"
  }
}
```

### Example: JavaScript/TypeScript

```javascript
import axios from 'axios';

async function chatCompletion(apiKey, messages, options = {}) {
  const response = await axios.post(
    'https://trading.api.thegrid.ai/v1/consumption/chat',
    {
      model: options.model || 'gpt-4',
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 150,
      stream: false
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      }
    }
  );
  
  return response.data.data;
}

// Usage
const result = await chatCompletion('your_api_key', [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Explain quantum computing in one sentence.' }
]);

console.log(result.choices[0].message.content);
console.log(`Credits used: ${result.usage.total_tokens * 0.0001}`);
```

### Example: Python

```python
import requests

def chat_completion(api_key, messages, model='gpt-4', temperature=0.7, max_tokens=150):
    """
    Generate a chat completion using the GRID Consumption API
    
    Args:
        api_key: Your consumption API key
        messages: List of message dicts with 'role' and 'content'
        model: Model identifier
        temperature: Sampling temperature
        max_tokens: Maximum tokens to generate
    
    Returns:
        Completion response dict
    """
    response = requests.post(
        'https://trading.api.thegrid.ai/v1/consumption/chat',
        json={
            'model': model,
            'messages': messages,
            'temperature': temperature,
            'max_tokens': max_tokens,
            'stream': False
        },
        headers={
            'Content-Type': 'application/json',
            Authorization: f'Bearer {api_key}'
        }
    )
    
    response.raise_for_status()
    return response.json()['data']

# Usage
result = chat_completion('your_api_key', [
    {'role': 'system', 'content': 'You are a helpful assistant.'},
    {'role': 'user', 'content': 'What is machine learning?'}
])

print(result['choices'][0]['message']['content'])
print(f"Tokens used: {result['usage']['total_tokens']}")
```

### Example: cURL

```bash
curl -X POST \
  "https://trading.api.thegrid.ai/v1/consumption/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key_here" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ],
    "temperature": 0.7,
    "max_tokens": 150
  }'
```

## Streaming Responses

Enable real-time streaming of generated tokens by setting `"stream": true`.

### Streaming Request

```json
{
  "model": "gpt-4",
  "messages": [...],
  "stream": true
}
```

### Streaming Response Format

Streaming responses use Server-Sent Events (SSE) format:

```
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1704110096,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1704110096,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"The"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1704110096,"model":"gpt-4","choices":[{"index":0,"delta":{"content":" capital"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1704110096,"model":"gpt-4","choices":[{"index":0,"delta":{"content":" of"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1704110096,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

### Example: JavaScript/TypeScript (Streaming)

```javascript
async function streamingChatCompletion(apiKey, messages) {
  const response = await fetch(
    'https://trading.api.thegrid.ai/v1/consumption/chat',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: messages,
        stream: true
      })
    }
  );

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim() !== '');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          console.log('\n\nStream complete!');
          return fullContent;
        }
        
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content;
          if (content) {
            process.stdout.write(content);
            fullContent += content;
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }
  
  return fullContent;
}

// Usage
const fullResponse = await streamingChatCompletion('your_api_key', [
  { role: 'user', content: 'Write a haiku about coding.' }
]);
```

### Example: Python (Streaming)

```python
import requests
import json

def streaming_chat_completion(api_key, messages):
    """
    Stream a chat completion response
    """
    response = requests.post(
        'https://trading.api.thegrid.ai/v1/consumption/chat',
        json={
            'model': 'gpt-4',
            'messages': messages,
            'stream': True
        },
        headers={
            'Content-Type': 'application/json',
            Authorization: f'Bearer {api_key}'
        },
        stream=True
    )
    
    response.raise_for_status()
    full_content = ''
    
    for line in response.iter_lines():
        if line:
            line_str = line.decode('utf-8')
            if line_str.startswith('data: '):
                data = line_str[6:]
                if data == '[DONE]':
                    print('\n\nStream complete!')
                    break
                
                try:
                    parsed = json.loads(data)
                    content = parsed['choices'][0]['delta'].get('content', '')
                    if content:
                        print(content, end='', flush=True)
                        full_content += content
                except json.JSONDecodeError:
                    pass
    
    return full_content

# Usage
result = streaming_chat_completion('your_api_key', [
    {'role': 'user', 'content': 'Tell me a joke about AI.'}
])
```

## Tool Calling and Structured Outputs

*(Note: This feature may not be available yet. Check with engineering.)*

### Function Calling

Define tools/functions that the model can call:

```json
{
  "model": "gpt-4",
  "messages": [...],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_current_weather",
        "description": "Get the current weather in a location",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "City and state, e.g. San Francisco, CA"
            },
            "unit": {
              "type": "string",
              "enum": ["celsius", "fahrenheit"]
            }
          },
          "required": ["location"]
        }
      }
    }
  ]
}
```

### Structured Output

Force the model to return JSON in a specific schema:

```json
{
  "model": "gpt-4",
  "messages": [...],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "trade_analysis",
      "schema": {
        "type": "object",
        "properties": {
          "sentiment": {
            "type": "string",
            "enum": ["bullish", "bearish", "neutral"]
          },
          "confidence": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "reasoning": {
            "type": "string"
          }
        },
        "required": ["sentiment", "confidence", "reasoning"]
      }
    }
  }
}
```

## Errors and Rate Limits

### Common Errors

| Error Code | Description |
|------------|-------------|
| `INVALID_API_KEY` | The consumption API key is invalid or missing |
| `INSUFFICIENT_CREDITS` | Not enough compute credits available |
| `INVALID_MODEL` | The requested model is not available |
| `INVALID_PARAMETERS` | Request parameters are invalid |
| `CONTEXT_LENGTH_EXCEEDED` | Input exceeds model's context window |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

### Error Response Example

```json
{
  "data": null,
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Not enough credits to complete this request. Required: 0.05, Available: 0.02",
    "details": {
      "required_credits": "0.05",
      "available_credits": "0.02"
    }
  }
}
```

### Rate Limits

- **Requests**: 60 requests per minute per API key
- **Streaming**: 10 concurrent streaming connections
- **Tokens**: Model-dependent (check documentation)

### Rate Limit Headers

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1704110156
```

## Credit Usage and Billing

Credits are consumed based on token usage:

- **Input tokens**: Charged at model's input rate
- **Output tokens**: Charged at model's output rate
- **Credits expire**: Based on lot purchase date (see Accounts API)

Check the `usage` field in the response to track consumption:

```json
"usage": {
  "prompt_tokens": 20,
  "completion_tokens": 50,
  "total_tokens": 70
}
```

## Best Practices

1. **Monitor credit usage** - Track the `usage` field in responses
2. **Use appropriate models** - Balance cost and performance
3. **Set max_tokens** - Prevent unexpected high costs
4. **Cache responses** - Don't regenerate identical completions
5. **Handle streaming errors** - Implement reconnection logic
6. **Use system messages** - Guide model behavior efficiently
7. **Validate before sending** - Check message format and limits

## Models Available

| Model | Context Window | Cost Multiplier |
|-------|----------------|-----------------|
| gpt-4 | 8,192 tokens | 1.0x |
| gpt-4-32k | 32,768 tokens | 2.0x |
| gpt-3.5-turbo | 16,385 tokens | 0.1x |

*(Contact support for current model availability and pricing)*


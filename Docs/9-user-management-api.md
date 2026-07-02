# User Management API

The User Management API handles user registration, authentication, profile management, and account settings.

## User Registration

### Register New User

**`POST /api/v1/users/register`**

Create a new user account with email and password.

**Request Body**:

```json
{
  "user": {
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "password_confirmation": "SecurePassword123!",
    "accepted_terms": true
  }
}
```

**Request Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | Yes | Valid email address |
| `password` | string | Yes | Password meeting requirements |
| `password_confirmation` | string | Yes | Must match password |
| `accepted_terms` | boolean | No | Accept terms and privacy policy |

**Password Requirements**:
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number or special character

**Response**:

```json
{
  "message": "User created successfully. Please check your email to verify your account."
}
```

**Status Code**: `200 OK`

**Example**:

```javascript
async function registerUser(email, password) {
  const response = await axios.post(
    'https://trading.api.thegrid.ai/v1/users/register',
    {
      user: {
        email: email,
        password: password,
        password_confirmation: password,
        accepted_terms: true
      }
    }
  );
  
  return response.data;
}

const result = await registerUser('trader@example.com', 'MySecurePass123!');
console.log(result.message);
```

### Resend Verification Email

**`POST /api/v1/users/resend-verification`**

Resend email verification link.

**Authentication**: Required (cookie-based session)

**Response**:

```json
{
  "message": "Verification email sent. Please check your inbox."
}
```

**Rate Limited**: Max 1 request per 5 minutes per user

**Example**:

```javascript
async function resendVerification() {
  const response = await axios.post(
    'https://trading.api.thegrid.ai/v1/users/resend-verification',
    {},
    { withCredentials: true }
  );
  
  return response.data;
}
```

### Verify Email

**`GET /api/v1/users/verify-email/:token`**

Verify email address using token from email.

**Response**:

```json
{
  "message": "Email verified successfully"
}
```

## User Authentication

### Login

**`POST /api/v1/users/log-in`**

Authenticate user with email and password.

**Request Body**:

```json
{
  "user": {
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "remember_me": "true"
  }
}
```

**Response**:

```json
{
  "data": {
    "id": "f9939450-c966-44e8-8b10-9a05654608f6",
    "email": "user@example.com",
    "name": null,
    "verification_status": "verified",
    "kyc_status": "not_started",
    "aml_status": "not_checked",
    "has_password": true,
    "has_accepted_legal_documents": true
  }
}
```

**Sets Cookie**: `_exchange_key` for session authentication

**Example**:

```javascript
async function login(email, password, rememberMe = false) {
  const response = await axios.post(
    'https://trading.api.thegrid.ai/v1/users/log-in',
    {
      user: {
        email: email,
        password: password,
        remember_me: rememberMe.toString()
      }
    },
    { withCredentials: true }
  );
  
  return response.data.data;
}

const user = await login('trader@example.com', 'MySecurePass123!', true);
console.log(`Logged in as: ${user.email}`);
console.log(`User ID: ${user.id}`);
console.log(`Email verified: ${user.verification_status === 'verified'}`);
```

### Logout

**`DELETE /api/v1/users/log-out`**

Log out current user and clear session.

**Response**: `204 No Content`

**Example**:

```javascript
async function logout() {
  await axios.delete(
    'https://trading.api.thegrid.ai/v1/users/log-out',
    { withCredentials: true }
  );
  
  console.log('Logged out successfully');
}
```

## OAuth Authentication

### Initiate OAuth Flow

**`GET /api/v1/auth/:provider`**

Start OAuth authentication flow with supported providers.

**Supported Providers**:
- `github`
- `google`

**Response**: Redirects to provider's OAuth authorization page

**Example**:

```javascript
// Redirect user to GitHub OAuth
window.location.href = 'https://trading.api.thegrid.ai/v1/auth/github';

// Or Google OAuth
window.location.href = 'https://trading.api.thegrid.ai/v1/auth/google';
```

### OAuth Callback

**`GET /api/v1/auth/:provider/callback`**

Handle OAuth callback and create/login user.

**Response**: Redirects to frontend with status

**Redirect Patterns**:
- Success (new user): `http://grid-frontend.xyz`
- Success (connect): `http://grid-frontend.xyz?provider=github&status=connected`
- Error: `http://grid-frontend.xyz?error=auth_failed`
- Email mismatch: `http://grid-frontend.xyz?error=email_mismatch`
- Already connected: `http://grid-frontend.xyz?error=already_connected`

## User Profile

### Get Current User

**`GET /api/v1/users/self`**

Get authenticated user's profile information.

**Authentication**: Required (Ed25519 signature or session cookie)

**Response**:

```json
{
  "data": {
    "id": "eb429d91-0218-4a0c-ab35-73b37df07b7e",
    "email": "user@example.com",
    "name": "John Doe",
    "verification_status": "verified",
    "kyc_status": "not_started",
    "aml_status": "not_checked",
    "has_password": true,
    "has_accepted_legal_documents": true,
    "connected_providers": ["google", "github"]
  }
}
```

**Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | User unique identifier |
| `email` | string | User email address |
| `name` | string | Display name (nullable) |
| `verification_status` | string | `pending`, `verified` |
| `kyc_status` | string | KYC verification status |
| `aml_status` | string | AML check status |
| `has_password` | boolean | Whether user has password set |
| `has_accepted_legal_documents` | boolean | ToS/Privacy acceptance |
| `connected_providers` | array | OAuth providers connected |

**Example**:

```javascript
import { SignatureAuth } from './auth';

async function getCurrentUser(auth) {
  const path = '/api/v1/users/self';
  const headers = auth.getHeaders('GET', path, '');
  
  const response = await axios.get(
    `https://trading.api.thegrid.ai${path}`,
    { headers }
  );
  
  return response.data.data;
}

const user = await getCurrentUser(auth);
console.log(`Logged in as: ${user.email}`);
console.log(`Display name: ${user.name || 'Not set'}`);
console.log(`Email verified: ${user.verification_status === 'verified'}`);
console.log(`Connected providers: ${user.connected_providers.join(', ')}`);
```

### Update User Name

**`PUT /api/v1/users/settings/name`**

Update user's display name.

**Authentication**: Required

**Request Body**:

```json
{
  "name": "Jane Doe"
}
```

**Response**:

```json
{
  "data": {
    "id": "c2a2a227-5d39-4f0e-904a-cd1c97a72320",
    "email": "user@example.com",
    "name": "Jane Doe",
    "verification_status": "verified",
    "kyc_status": "not_started",
    "aml_status": "not_checked",
    "has_password": false,
    "has_accepted_legal_documents": true
  }
}
```

**Example**:

```javascript
async function updateUserName(auth, name) {
  const path = '/api/v1/users/settings/name';
  const body = JSON.stringify({ name });
  const headers = auth.getHeaders('PUT', path, body);
  
  const response = await axios.put(
    `https://trading.api.thegrid.ai${path}`,
    { name },
    {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
  
  return response.data.data;
}

const updatedUser = await updateUserName(auth, 'John Smith');
console.log(`Name updated to: ${updatedUser.name}`);
```

## Password Management

### Set Password (OAuth Users)

**`PUT /api/v1/users/settings/password`**

Set password for users who registered via OAuth and don't have a password yet.

**Authentication**: Required

**Request Body**:

```json
{
  "user": {
    "password": "NewValidPassword123!",
    "password_confirmation": "NewValidPassword123!"
  }
}
```

**Response**:

```json
{
  "data": {
    "id": "78f62a4c-2776-46ba-8b97-f892c505d836",
    "email": "user@example.com",
    "has_password": true,
    "verification_status": "pending"
  }
}
```

**Example**:

```javascript
async function setPassword(auth, password) {
  const path = '/api/v1/users/settings/password';
  const body = JSON.stringify({
    user: {
      password: password,
      password_confirmation: password
    }
  });
  const headers = auth.getHeaders('PUT', path, body);
  
  const response = await axios.put(
    `https://trading.api.thegrid.ai${path}`,
    { user: { password, password_confirmation: password } },
    {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
  
  return response.data.data;
}
```

### Change Password (Existing Users)

**`PUT /api/v1/users/settings`**

Change password for users who already have a password.

**Authentication**: Required

**Request Body**:

```json
{
  "action": "update_password",
  "user": {
    "password": "NewValidPassword123!",
    "password_confirmation": "NewValidPassword123!"
  }
}
```

**Response**: Returns updated user data

### Reset Password (Forgot Password)

**Step 1: Request Reset**

**`POST /api/v1/users/reset-password`**

Request password reset email.

**Request Body**:

```json
{
  "email": "user@example.com"
}
```

**Response**:

```json
{
  "message": "If that email exists, we've sent password reset instructions"
}
```

**Note**: Always returns success to prevent email enumeration attacks.

**Step 2: Verify Reset Token**

**`POST /api/v1/users/reset-password/verify`**

Verify that a reset token is valid.

**Request Body**:

```json
{
  "token": "reset_token_from_email"
}
```

**Response (Valid)**:

```json
{
  "valid": true,
  "email": "user@example.com"
}
```

**Response (Invalid)**:

```json
{
  "errors": {
    "detail": "Token is invalid or has expired"
  }
}
```

**Status Code**: `401 Unauthorized`

**Step 3: Complete Reset**

**`PUT /api/v1/users/reset-password`**

Reset password using valid token.

**Request Body**:

```json
{
  "token": "reset_token_from_email",
  "password": "NewSecurePass123!"
}
```

**Response**:

```json
{
  "message": "Password has been reset successfully"
}
```

### Complete Password Reset Flow (JavaScript)

```javascript
class PasswordResetFlow {
  constructor(baseURL) {
    this.baseURL = baseURL || 'https://trading.api.thegrid.ai';
  }
  
  async requestReset(email) {
    const response = await axios.post(`${this.baseURL}/api/v1/users/reset-password`, {
      email: email
    });
    
    console.log(response.data.message);
    return true;
  }
  
  async verifyToken(token) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/v1/users/reset-password/verify`,
        { token }
      );
      
      if (response.data.valid) {
        console.log(`Token valid for: ${response.data.email}`);
        return true;
      }
    } catch (error) {
      if (error.response?.status === 401) {
        console.error('Token is invalid or expired');
      }
      return false;
    }
  }
  
  async resetPassword(token, newPassword) {
    try {
      const response = await axios.put(
        `${this.baseURL}/api/v1/users/reset-password`,
        {
          token: token,
          password: newPassword
        }
      );
      
      console.log(response.data.message);
      return true;
    } catch (error) {
      if (error.response?.status === 422) {
        console.error('Password validation errors:', error.response.data.errors);
      } else if (error.response?.status === 401) {
        console.error('Token is invalid or expired');
      }
      return false;
    }
  }
}

// Usage
const resetFlow = new PasswordResetFlow();

// Step 1: User requests reset
await resetFlow.requestReset('user@example.com');

// Step 2: User receives email with token, verifies it
const token = 'token_from_email';
const isValid = await resetFlow.verifyToken(token);

// Step 3: If valid, user sets new password
if (isValid) {
  await resetFlow.resetPassword(token, 'MyNewSecurePass123!');
}
```

### Complete Password Reset Flow (Python)

```python
import requests

class PasswordResetFlow:
    def __init__(self, base_url=None):
        self.base_url = base_url or 'https://trading.api.thegrid.ai'
    
    def request_reset(self, email):
        """Request password reset email"""
        response = requests.post(
            f'{self.base_url}/api/v1/users/reset-password',
            json={'email': email}
        )
        response.raise_for_status()
        print(response.json()['message'])
        return True
    
    def verify_token(self, token):
        """Verify reset token is valid"""
        try:
            response = requests.post(
                f'{self.base_url}/api/v1/users/reset-password/verify',
                json={'token': token}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data['valid']:
                    print(f"Token valid for: {data['email']}")
                    return True
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 401:
                print('Token is invalid or expired')
        
        return False
    
    def reset_password(self, token, new_password):
        """Reset password with token"""
        try:
            response = requests.put(
                f'{self.base_url}/api/v1/users/reset-password',
                json={
                    'token': token,
                    'password': new_password
                }
            )
            response.raise_for_status()
            print(response.json()['message'])
            return True
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 422:
                print('Password validation errors:', e.response.json())
            elif e.response.status_code == 401:
                print('Token is invalid or expired')
            return False

# Usage
reset_flow = PasswordResetFlow()

# Step 1: Request reset
reset_flow.request_reset('user@example.com')

# Step 2: Verify token from email
token = 'token_from_email'
if reset_flow.verify_token(token):
    # Step 3: Set new password
    reset_flow.reset_password(token, 'MyNewSecurePass123!')
```

## User Profile Management

### Accept Terms and Privacy Policy

**`POST /api/v1/users/accept-terms-and-privacy`**

Accept Terms of Service and Privacy Policy.

**Authentication**: Required

**Response**:

```json
{
  "message": "Terms of Service and Privacy Policy accepted successfully"
}
```

**Example**:

```javascript
async function acceptLegalDocs(auth) {
  const path = '/api/v1/users/accept-terms-and-privacy';
  const headers = auth.getHeaders('POST', path, '');
  
  const response = await axios.post(
    `https://trading.api.thegrid.ai${path}`,
    {},
    {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
  
  return response.data;
}

await acceptLegalDocs(auth);
console.log('Legal documents accepted');
```

## Error Handling

### Registration Errors

```json
{
  "errors": {
    "detail": {
      "email": ["must have the @ sign and no spaces"],
      "password": [
        "should be at least 12 character(s)",
        "must contain at least one uppercase letter"
      ]
    }
  }
}
```

**Status Code**: `422 Unprocessable Entity`

### Authentication Errors

```json
{
  "error": "Invalid email or password"
}
```

**Status Code**: `401 Unauthorized`

### Rate Limit Errors

```json
{
  "error": "Please wait before requesting another verification email"
}
```

**Status Code**: `429 Too Many Requests`

## Best Practices

1. **Validate passwords client-side** - Check requirements before submitting
2. **Handle OAuth redirects** - Store state for post-login navigation
3. **Secure password storage** - Never log or store passwords
4. **Use remember_me wisely** - Only on trusted devices
5. **Handle verification flow** - Guide users to verify email
6. **Implement password strength meter** - Help users create strong passwords
7. **Support password managers** - Don't block paste in password fields

## Complete Registration Flow (React Example)

```javascript
import { useState } from 'react';
import axios from 'axios';

function RegistrationForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  
  const validatePassword = (pwd) => {
    const errors = [];
    if (pwd.length < 12) errors.push('Must be at least 12 characters');
    if (!/[A-Z]/.test(pwd)) errors.push('Must contain uppercase letter');
    if (!/[a-z]/.test(pwd)) errors.push('Must contain lowercase letter');
    if (!/[0-9!@#$%^&*]/.test(pwd)) errors.push('Must contain number or special character');
    return errors;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    
    // Client-side validation
    const pwdErrors = validatePassword(password);
    if (pwdErrors.length > 0) {
      setErrors({ password: pwdErrors });
      return;
    }
    
    if (password !== passwordConfirm) {
      setErrors({ password_confirmation: ['Passwords do not match'] });
      return;
    }
    
    if (!termsAccepted) {
      setErrors({ terms: ['You must accept the terms and privacy policy'] });
      return;
    }
    
    try {
      const response = await axios.post(
        'https://trading.api.thegrid.ai/v1/users/register',
        {
          user: {
            email,
            password,
            password_confirmation: passwordConfirm,
            accepted_terms: termsAccepted
          }
        }
      );
      
      setSuccess(true);
      console.log(response.data.message);
    } catch (error) {
      if (error.response?.status === 422) {
        setErrors(error.response.data.errors.detail || {});
      } else {
        setErrors({ general: ['Registration failed. Please try again.'] });
      }
    }
  };
  
  if (success) {
    return (
      <div className="success-message">
        <h2>Registration Successful!</h2>
        <p>Please check your email to verify your account.</p>
      </div>
    );
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Email:</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {errors.email && <span className="error">{errors.email.join(', ')}</span>}
      </div>
      
      <div>
        <label>Password:</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {errors.password && (
          <ul className="error">
            {errors.password.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        )}
      </div>
      
      <div>
        <label>Confirm Password:</label>
        <input
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          required
        />
        {errors.password_confirmation && (
          <span className="error">{errors.password_confirmation.join(', ')}</span>
        )}
      </div>
      
      <div>
        <label>
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
          />
          I accept the Terms of Service and Privacy Policy
        </label>
        {errors.terms && <span className="error">{errors.terms.join(', ')}</span>}
      </div>
      
      <button type="submit">Register</button>
      
      {errors.general && <div className="error">{errors.general.join(', ')}</div>}
    </form>
  );
}
```



"""
GRID API Authentication Helper (Python)

Ed25519 signature-based authentication for Trading and Accounts APIs
"""

import time
import hashlib
import base64
from nacl.signing import SigningKey


class SignatureAuth:
    """
    Ed25519 signature-based authentication for GRID API
    """
    
    def __init__(self, private_key_b64: str, public_key_b64: str):
        """
        Initialize authentication with Ed25519 keys
        
        Args:
            private_key_b64: Base64-encoded private key (64 bytes)
            public_key_b64: Base64-encoded public key (32 bytes)
        """
        try:
            private_key_bytes = base64.b64decode(private_key_b64)
            self.private_key = SigningKey(private_key_bytes)
        except Exception as e:
            raise ValueError(f"Invalid private key format: {e}")
        
        # Calculate fingerprint (SHA256 of public key)
        public_key_bytes = base64.b64decode(public_key_b64)
        hash_digest = hashlib.sha256(public_key_bytes).digest()
        self.fingerprint = base64.b64encode(hash_digest).decode().rstrip('=')
    
    @classmethod
    def from_files(cls, private_key_path: str, public_key_path: str):
        """
        Load keys from files
        
        Args:
            private_key_path: Path to private key file
            public_key_path: Path to public key file
        
        Returns:
            SignatureAuth instance
        """
        with open(private_key_path, 'r') as f:
            private_key = f.read().strip()
        
        with open(public_key_path, 'r') as f:
            public_key = f.read().strip()
        
        return cls(private_key, public_key)
    
    def get_headers(self, method: str, path: str, body: str = '') -> dict:
        """
        Generate authentication headers for an API request
        
        Args:
            method: HTTP method (GET, POST, DELETE, etc.)
            path: Request path (e.g., '/api/v1/trading/markets')
            body: Request body as JSON string (empty for GET)
        
        Returns:
            Dictionary with signature, timestamp, and fingerprint headers
        """
        timestamp = str(int(time.time()))
        message = f"{timestamp}{method.upper()}{path}{body}"
        
        signature = self.private_key.sign(message.encode()).signature
        signature_b64 = base64.b64encode(signature).decode()
        
        return {
            'x-thegrid-signature': signature_b64,
            'x-thegrid-timestamp': timestamp,
            'x-thegrid-fingerprint': self.fingerprint
        }
    
    def get_fingerprint(self) -> str:
        """
        Get the public key fingerprint
        
        Returns:
            Base64-encoded SHA256 hash of public key
        """
        return self.fingerprint


# Example usage
if __name__ == '__main__':
    # Load from files
    auth = SignatureAuth.from_files('./ed25519.key', './ed25519_pub.der')
    
    # Generate headers for a GET request
    headers = auth.get_headers('GET', '/api/v1/trading/markets', '')
    
    print("Authentication headers:")
    print(f"  Signature: {headers['x-thegrid-signature'][:20]}...")
    print(f"  Timestamp: {headers['x-thegrid-timestamp']}")
    print(f"  Fingerprint: {headers['x-thegrid-fingerprint'][:20]}...")


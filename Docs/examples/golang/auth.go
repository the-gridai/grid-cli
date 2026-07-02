// Package grid provides authentication helpers for the GRID API
//
// Ed25519 signature-based authentication for Trading and Accounts APIs
package grid

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// SignatureAuth handles Ed25519 signature-based authentication for GRID API
type SignatureAuth struct {
	privateKey  ed25519.PrivateKey
	fingerprint string
}

// NewSignatureAuth creates a new authentication instance with Ed25519 keys
//
// privateKeyB64: Base64-encoded private key (64 bytes)
// publicKeyB64: Base64-encoded public key (32 bytes)
func NewSignatureAuth(privateKeyB64, publicKeyB64 string) (*SignatureAuth, error) {
	// Decode private key
	privateKeyBytes, err := base64.StdEncoding.DecodeString(strings.TrimSpace(privateKeyB64))
	if err != nil {
		return nil, fmt.Errorf("invalid private key format: %w", err)
	}

	if len(privateKeyBytes) != ed25519.PrivateKeySize {
		return nil, fmt.Errorf("invalid private key size: expected %d bytes, got %d", ed25519.PrivateKeySize, len(privateKeyBytes))
	}

	privateKey := ed25519.PrivateKey(privateKeyBytes)

	// Calculate fingerprint (SHA256 of public key)
	publicKeyBytes, err := base64.StdEncoding.DecodeString(strings.TrimSpace(publicKeyB64))
	if err != nil {
		return nil, fmt.Errorf("invalid public key format: %w", err)
	}

	hash := sha256.Sum256(publicKeyBytes)
	fingerprint := base64.StdEncoding.EncodeToString(hash[:])
	fingerprint = strings.TrimRight(fingerprint, "=") // Remove padding

	return &SignatureAuth{
		privateKey:  privateKey,
		fingerprint: fingerprint,
	}, nil
}

// NewSignatureAuthFromFiles loads keys from files
//
// privateKeyPath: Path to private key file
// publicKeyPath: Path to public key file
func NewSignatureAuthFromFiles(privateKeyPath, publicKeyPath string) (*SignatureAuth, error) {
	// Read private key
	privateKeyBytes, err := os.ReadFile(privateKeyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read private key: %w", err)
	}

	// Read public key
	publicKeyBytes, err := os.ReadFile(publicKeyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read public key: %w", err)
	}

	return NewSignatureAuth(
		string(privateKeyBytes),
		string(publicKeyBytes),
	)
}

// GetHeaders generates authentication headers for an API request
//
// method: HTTP method (GET, POST, DELETE, etc.)
// path: Request path (e.g., "/api/v1/trading/markets")
// body: Request body as string (empty string for GET requests)
//
// Returns a map of headers to include in the request
func (sa *SignatureAuth) GetHeaders(method, path, body string) map[string]string {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	message := timestamp + strings.ToUpper(method) + path + body

	// Sign the message
	signature := ed25519.Sign(sa.privateKey, []byte(message))
	signatureB64 := base64.StdEncoding.EncodeToString(signature)

	return map[string]string{
		"x-thegrid-signature":   signatureB64,
		"x-thegrid-timestamp":   timestamp,
		"x-thegrid-fingerprint": sa.fingerprint,
	}
}

// GetFingerprint returns the public key fingerprint
func (sa *SignatureAuth) GetFingerprint() string {
	return sa.fingerprint
}


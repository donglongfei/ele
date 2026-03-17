/**
 * Crypto utilities for Device Pairing with OpenClaw Gateway.
 * Uses Node.js crypto module (available in Obsidian/Electron environment).
 */

import crypto from 'crypto';

/**
 * Ed25519 SPKI prefix for public key encoding.
 */
const ED25519_SPKI_PREFIX = Buffer.from([
	0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);

/**
 * Generate an Ed25519 keypair for device pairing.
 */
export function generateEd25519Keypair(): {
	publicKey: Buffer;
	privateKey: Buffer;
} {
	const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

	// Export to raw format
	const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
	const privateKeyPkcs8 = privateKey.export({ type: 'pkcs8', format: 'der' });

	// Extract raw keys
	const publicKeyRaw = Buffer.from(publicKeyDer).slice(
		ED25519_SPKI_PREFIX.length
	);
	const privateKeyRaw = Buffer.from(privateKeyPkcs8).slice(-32); // Last 32 bytes

	return {
		publicKey: publicKeyRaw,
		privateKey: privateKeyRaw,
	};
}

/**
 * Export public key to raw bytes (32 bytes for Ed25519).
 */
export function exportPublicKeyRaw(publicKey: Buffer): Buffer {
	if (publicKey.length === 32) {
		return publicKey;
	}
	throw new Error('Invalid Ed25519 public key format');
}

/**
 * Import public key from raw bytes.
 */
export function importPublicKeyRaw(rawKey: Buffer): Buffer {
	if (rawKey.length !== 32) {
		throw new Error('Ed25519 public key must be 32 bytes');
	}
	return rawKey;
}

/**
 * Export private key to hex string for storage.
 */
export function exportPrivateKeyHex(privateKey: Buffer): string {
	return privateKey.toString('hex');
}

/**
 * Import private key from hex string.
 */
export function importPrivateKeyHex(hex: string): Buffer {
	return Buffer.from(hex, 'hex');
}

/**
 * Sign a message with Ed25519 private key.
 */
export function signMessage(privateKey: Buffer, message: string): Buffer {
	// Reconstruct private key in PKCS8 format for signing
	const pkcs8Prefix = Buffer.from([
		0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
		0x04, 0x22, 0x04, 0x20,
	]);
	const pkcs8 = Buffer.concat([pkcs8Prefix, privateKey]);

	const key = crypto.createPrivateKey({
		key: pkcs8,
		type: 'pkcs8',
		format: 'der',
	});

	const messageBuffer = Buffer.from(message, 'utf8');
	const signature = crypto.sign(null, messageBuffer, key);

	return signature;
}

/**
 * Derive deviceId from public key (SHA-256 hash).
 */
export function deriveDeviceId(publicKeyRaw: Buffer): string {
	const hash = crypto.createHash('sha256').update(publicKeyRaw).digest('hex');
	return hash;
}

/**
 * Encode bytes to base64url format.
 */
export function toBase64Url(bytes: Buffer): string {
	return bytes
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '');
}

/**
 * Decode base64url to bytes.
 */
export function fromBase64Url(base64url: string): Buffer {
	const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
	const padding = '='.repeat((4 - (base64.length % 4)) % 4);
	return Buffer.from(base64 + padding, 'base64');
}

/**
 * Build Device Auth Payload V3 for signature.
 * Format: v3|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce|platform|deviceFamily
 */
export function buildDeviceAuthPayloadV3(params: {
	deviceId: string;
	clientId: string;
	clientMode: string;
	role: string;
	scopes: string[];
	signedAtMs: number;
	token: string;
	nonce: string;
	platform: string;
	deviceFamily: string;
}): string {
	return [
		'v3',
		params.deviceId,
		params.clientId,
		params.clientMode,
		params.role,
		params.scopes.join(','),
		String(params.signedAtMs),
		params.token,
		params.nonce,
		params.platform.toLowerCase(), // Must be lowercase
		params.deviceFamily.toLowerCase(), // Must be lowercase
	].join('|');
}

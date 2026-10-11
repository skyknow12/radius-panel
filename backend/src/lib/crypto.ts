import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard IV length for AES-GCM
const SALT = 'sky_radius_olt_credentials_salt_v1';

// Key derived from JWT_SECRET, ENCRYPTION_KEY or stable system secret
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'sky_radius_secure_key_fallback_32b!';
  return crypto.scryptSync(secret, SALT, 32);
}

/**
 * Encrypt sensitive credential strings (OLT telnet/ssh passwords, SNMP community strings)
 * Returns format: aes256gcm:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `aes256gcm:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt sensitive credential strings
 */
export function decryptSecret(encryptedPayload: string): string {
  if (!encryptedPayload) return '';
  // Check if it matches our encrypted format
  if (!encryptedPayload.startsWith('aes256gcm:')) {
    // If plaintext (e.g. legacy or unencrypted during migration test), return as-is
    return encryptedPayload;
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted payload format');
  }

  const [, ivHex, tagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Return masked credential placeholder for UI display
 */
export function maskSecret(secret?: string): string {
  if (!secret) return '';
  return '••••••••';
}

/**
 * Sanitize text to remove passwords and secrets before writing to audit logs or database history
 */
export function sanitizeLogOutput(text: string, knownSecrets: (string | undefined | null)[] = []): string {
  if (!text) return '';
  let sanitized = text;

  // Mask known passwords passed in
  for (const s of knownSecrets) {
    if (s && s.length >= 3) {
      sanitized = sanitized.split(s).join('[REDACTED]');
    }
  }

  // Regex sanitization for passwords in CLI/Telnet exchanges
  sanitized = sanitized
    .replace(/(?:password|community|secret)\s*[:=]\s*\S+/gi, (match) => {
      const parts = match.split(/[:=]/);
      return `${parts[0]}: [REDACTED]`;
    })
    .replace(/(?:ont add \d+ [^\n]+sn-auth \S+ [^\n]+password) \S+/gi, '$1 [REDACTED]');

  return sanitized;
}

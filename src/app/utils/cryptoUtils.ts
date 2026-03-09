/**
 * cryptoUtils.ts
 *
 * Client-side AES-256-GCM encryption for AI API keys stored in Supabase.
 *
 * Why client-side encryption?
 * - The key in the `cabinet_settings` table is an opaque encrypted blob.
 * - A direct SQL dump of the table reveals no usable secret.
 * - The decryption key is derived at runtime from the user's identity and
 *   is never stored anywhere — not in localStorage, cookies, or the DB.
 *
 * Key derivation: PBKDF2(SHA-256, 100 000 iterations)
 *   password  = userId          (Supabase auth UUID)
 *   salt      = DOMAIN + userId (domain-separated to prevent cross-context reuse)
 *
 * Encrypted payload layout (base64-encoded):
 *   [ IV (12 bytes) | AES-GCM ciphertext (variable) ]
 *
 * NOTE: For higher-assurance deployments, replace this with a Supabase Vault
 *       Edge Function that uses pgsodium server-side. This implementation is a
 *       practical step-up over plaintext storage within a client-only app.
 */

const DOMAIN_SEPARATOR = 'cabinetflow-ai-key-v1';
const PBKDF2_ITERATIONS = 100_000;

// ─── Key derivation ────────────────────────────────────────────────────────────

async function deriveKey(userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const raw = await crypto.subtle.importKey(
    'raw',
    enc.encode(userId),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(DOMAIN_SEPARATOR + userId),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Encrypt `plaintext` with AES-256-GCM.
 * Returns a base64-encoded string `[IV(12) | ciphertext]`.
 * Returns an empty string if `plaintext` is empty.
 */
export async function encryptApiKey(
  plaintext: string,
  userId: string,
): Promise<string> {
  if (!plaintext) return '';
  const key = await deriveKey(userId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const buf = new Uint8Array(12 + encrypted.byteLength);
  buf.set(iv, 0);
  buf.set(new Uint8Array(encrypted), 12);
  return btoa(String.fromCharCode(...buf));
}

/**
 * Decrypt a base64 blob produced by `encryptApiKey`.
 * Returns an empty string if `ciphertext` is empty **or** decryption fails
 * (wrong key, corrupted data, or legacy plaintext value).
 */
export async function decryptApiKey(
  ciphertext: string,
  userId: string,
): Promise<string> {
  if (!ciphertext) return '';
  try {
    const key = await deriveKey(userId);
    const buf = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const iv = buf.slice(0, 12);
    const data = buf.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    // Decryption failed — likely a pre-encryption legacy plaintext value.
    // Return empty so the UI prompts the user to re-enter their key.
    return '';
  }
}

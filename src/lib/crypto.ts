/**
 * AES-256-GCM string encryption used at the cloud-sync boundary. Built on
 * WebCrypto only, so the exact same code runs in the browser (encrypting
 * snippets before upload), on the Cloudflare Worker (wrapping per-user DEKs
 * with the master key) and in Node (tests).
 *
 * Version-1 payload format: base64( iv[12 bytes] ‖ ciphertext+GCM tag ).
 * `crypto_version` on the cloud rows says how each row's fields are encoded;
 * bump CURRENT_CRYPTO_VERSION (and branch on it when decrypting) if this
 * format ever changes — never reinterpret existing payloads.
 */

export const CRYPTO_VERSION_PLAINTEXT = 0;
export const CURRENT_CRYPTO_VERSION = 1;

export const DEK_BYTES = 32;
const IV_BYTES = 12;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// btoa/atob work on binary strings; convert in chunks because building the
// binary string via spread would overflow the argument limit on large snippets.
const BASE64_CHUNK = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(payload: string): Uint8Array<ArrayBuffer> {
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Fresh random key material for a per-user data-encryption key (DEK). */
export function generateDekBytes(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(DEK_BYTES));
}

/**
 * Identifier for a new folder/snippet row. `crypto.randomUUID` is restricted to
 * secure contexts, so it is simply absent when the app is served over plain
 * HTTP on a LAN address — the normal way to open a dev server from another
 * device on the network. Every local write starts by minting an id, so without
 * this fallback the whole app throws there. `getRandomValues` has no such
 * restriction, so build the v4 UUID by hand instead.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function importAesKey(rawKey: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  if (rawKey.length !== DEK_BYTES) {
    throw new Error(`AES-256 key must be ${DEK_BYTES} bytes, got ${rawKey.length}`);
  }
  return crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptString(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  const payload = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ciphertext), IV_BYTES);
  return bytesToBase64(payload);
}

/** Throws on a malformed payload or a wrong key (GCM authentication failure). */
export async function decryptString(key: CryptoKey, payload: string): Promise<string> {
  const bytes = base64ToBytes(payload);
  if (bytes.length < IV_BYTES) {
    throw new Error("Encrypted payload is too short");
  }

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.subarray(0, IV_BYTES) },
    key,
    bytes.subarray(IV_BYTES)
  );
  return decoder.decode(plaintext);
}

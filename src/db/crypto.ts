/**
 * 安全加密模組 - 基於 Web Crypto API
 * 使用 PBKDF2 衍生金鑰，並利用 AES-GCM (256-bit) 進行資料加解密
 */

// 將 ArrayBuffer 轉換為 Base64 字串
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// 將 Base64 字串轉換為 Uint8Array
export function base64ToBuffer(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// 產生隨機 Salt (16 bytes)
export function generateSalt(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(16));
}

// 產生隨機 IV (12 bytes, AES-GCM 標準長度)
export function generateIV(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(12));
}

/**
 * 依據用戶輸入的密碼與 Salt，透過 PBKDF2 衍生出 AES-GCM 256 位元金鑰
 */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // 1. 匯入原始密碼作為基礎金鑰原料
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // 2. 透過 PBKDF2 衍生出 256-bit AES-GCM 金鑰
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000, // 業界標準迭代次數，保障防破譯強度
      hash: 'SHA-256'
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false, // 金鑰不可導出，保障安全性
    ['encrypt', 'decrypt']
  );
}

/**
 * 使用 AES-GCM 加密明文字串
 * 回傳加密後的 Base64 密文與 IV
 */
export async function encryptData(
  plainText: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(plainText);
  const iv = generateIV();

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource
    },
    key,
    dataBuffer
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv.buffer as ArrayBuffer)
  };
}

/**
 * 使用 AES-GCM 解密密文字串
 */
export async function decryptData(
  ciphertextBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<string> {
  const encryptedBuffer = base64ToBuffer(ciphertextBase64);
  const iv = base64ToBuffer(ivBase64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource
    },
    key,
    encryptedBuffer as BufferSource
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * 用於驗證密碼是否正確的輔助方法
 * 利用密碼加密一個固定字串，並確認是否能被正確解密
 */
export async function generateVerificationPayload(key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  return encryptData("KEY_VERIFICATION_TOKEN", key);
}

export async function verifyKey(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<boolean> {
  try {
    const decrypted = await decryptData(ciphertext, iv, key);
    return decrypted === "KEY_VERIFICATION_TOKEN";
  } catch (e) {
    return false;
  }
}

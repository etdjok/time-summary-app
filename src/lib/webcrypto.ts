import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { gcm } from '@noble/ciphers/aes.js';

/**
 * WebCrypto 安全上下文兼容层
 *
 * crypto.subtle 仅在 HTTPS 或 localhost（安全上下文）中可用。
 * 通过局域网 IP（如 http://192.168.3.3:3001）访问时浏览器会将页面判定为
 * 非安全上下文，此时 crypto.subtle 为 undefined，导致加密功能报错。
 * 这里在原生不可用时自动降级为纯 JS 实现（@noble），算法与原生完全兼容：
 * - PBKDF2-SHA256 密钥派生（100000 轮）
 * - AES-256-GCM 加解密（12 字节 IV，16 字节认证标签，标签附在密文尾部）
 * - SHA-256 摘要
 */

interface PolyfillKey {
  type: string;
  algorithm: { name: string };
  extractable: boolean;
  usages: string[];
  _bytes: Uint8Array;
}

function toBytes(data: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data).slice();
  const view = data as ArrayBufferView;
  return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
}

const polyfillSubtle = {
  async importKey(
    _format: string,
    keyData: ArrayBuffer | ArrayBufferView,
    algorithm: { name: string },
    _extractable: boolean,
    usages: string[],
  ): Promise<PolyfillKey> {
    return { type: 'secret', algorithm: { name: algorithm.name }, extractable: true, usages: [...usages], _bytes: toBytes(keyData) };
  },

  async deriveKey(
    algorithm: { name: string; salt: ArrayBuffer | ArrayBufferView; iterations: number },
    baseKey: PolyfillKey,
    derivedKeyType: { name: string; length?: number },
    _extractable: boolean,
    usages: string[],
  ): Promise<PolyfillKey> {
    const dkLen = (derivedKeyType.length ?? 256) / 8;
    const dk = pbkdf2(sha256, baseKey._bytes, toBytes(algorithm.salt), { c: algorithm.iterations, dkLen });
    return { type: 'secret', algorithm: { name: derivedKeyType.name }, extractable: true, usages: [...usages], _bytes: dk };
  },

  async exportKey(_format: string, key: PolyfillKey): Promise<ArrayBuffer> {
    return key._bytes.slice().buffer as ArrayBuffer;
  },

  async encrypt(
    algorithm: { name: string; iv: ArrayBuffer | ArrayBufferView },
    key: PolyfillKey,
    data: ArrayBuffer | ArrayBufferView,
  ): Promise<ArrayBuffer> {
    const cipher = gcm(key._bytes, toBytes(algorithm.iv));
    return cipher.encrypt(toBytes(data)).buffer as ArrayBuffer;
  },

  async decrypt(
    algorithm: { name: string; iv: ArrayBuffer | ArrayBufferView },
    key: PolyfillKey,
    data: ArrayBuffer | ArrayBufferView,
  ): Promise<ArrayBuffer> {
    try {
      const cipher = gcm(key._bytes, toBytes(algorithm.iv));
      return cipher.decrypt(toBytes(data)).buffer as ArrayBuffer;
    } catch {
      throw new Error('解密失败：密钥错误或文件已被篡改');
    }
  },

  async digest(algorithm: string, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer> {
    return sha256(toBytes(data)).buffer as ArrayBuffer;
  },
};

const nativeCrypto: Crypto | undefined =
  typeof globalThis !== 'undefined' && typeof (globalThis as { crypto?: Crypto }).crypto !== 'undefined'
    ? (globalThis as { crypto: Crypto }).crypto
    : undefined;

export const webCrypto: Crypto = (() => {
  if (nativeCrypto && typeof nativeCrypto.subtle !== 'undefined') return nativeCrypto;
  const getRandomValues: Crypto['getRandomValues'] = nativeCrypto && typeof nativeCrypto.getRandomValues === 'function'
    ? nativeCrypto.getRandomValues.bind(nativeCrypto)
    : (() => { throw new Error('Web Crypto getRandomValues 不可用'); }) as unknown as Crypto['getRandomValues'];
  return {
    subtle: polyfillSubtle as unknown as SubtleCrypto,
    getRandomValues,
  } as unknown as Crypto;
})();
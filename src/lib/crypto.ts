/**
 * 心光端到端加密 - 主密钥架构 v2
 *
 * 架构说明：
 * - 随机生成 256 位主密钥 (MK)，所有文件加密使用 MK
 * - 密码不落盘：PBKDF2 派生密钥加密 MK，仅存哈希用于验证
 * - 恢复码：24 位 alphanumeric，独立解密通路
 * - 会话密钥：MK 仅存内存，页面关闭即清除
 */

// 在非安全上下文（HTTP 非 localhost）中原生 crypto.subtle 不可用，
// 通过 webCrypto 兼容层自动降级为纯 JS 实现，保证局域网部署可用
import { webCrypto as crypto } from './webcrypto';
import { apiFetch } from './auth';

// ========== 常量 ==========

const ENC_MAGIC_OLD = '[XG_ENC]';
const ENC_MAGIC_NEW = '[XG2]';
export { ENC_MAGIC_OLD, ENC_MAGIC_NEW };

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_SALT_LEN = 16;
const MK_LEN = 32;
const GCM_IV_LEN = 12;
const GCM_TAG_LEN = 128;
const RECOVERY_CODE_LEN = 24;
const RECOVERY_GROUP_LEN = 6;

// ========== 存储键名 ==========

const ENC_SETTINGS_KEY = 'xinguang_enc_settings';
const MK_PW_KEY = 'xinguang_mk_pw';
const MK_RECOVERY_KEY = 'xinguang_mk_recovery';
const RECOVERY_HASH_KEY = 'xinguang_recovery_hash';
const LOGIN_SALT_KEY = 'xinguang_login_salt';
const LOGIN_HASH_KEY = 'xinguang_login_hash';

// 云端恢复备份文件名与本地标记（提前声明供快照回滚使用）
export const RECOVERY_BACKUP_FILENAME = '.xinguang_recovery.json';
export const RECOVERY_BACKUP_KEY = 'xinguang_recovery_cloud';

// ========== 会话主密钥（仅存内存） ==========

let _sessionMK: Uint8Array | null = null;

export function setSessionMK(mk: Uint8Array): void { _sessionMK = mk; }
export function getSessionMK(): Uint8Array | null { return _sessionMK; }
export function clearSessionMK(): void { _sessionMK = null; }
export function hasSessionMK(): boolean { return _sessionMK !== null; }

// 登出：清除会话主密钥（凭据若为加密格式，将恢复到"未解锁"状态）
export function logout(): void {
  clearSessionMK();
}

// 本地是否已有一套完整密钥（可能 enc_settings 因旧版丢失/清缓存后存在，但密钥仍在）
export function hasLocalEncryptionKeys(): boolean {
  return localStorage.getItem(MK_PW_KEY) !== null && localStorage.getItem(MK_RECOVERY_KEY) !== null;
}

// ========== 工具函数 ==========

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}

function randomBytes(len: number): Uint8Array {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return buf;
}

// ========== PBKDF2 密钥派生 ==========

async function deriveAESKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const passwordBytes = new TextEncoder().encode(password);
  const baseKey = await crypto.subtle.importKey('raw', passwordBytes, { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'],
  );
}

async function deriveRawKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await deriveAESKey(password, salt);
  const exported = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(exported);
}

// ========== 加密设置（enabled + recoveryShown） ==========

export interface EncryptSettings { enabled: boolean; recoveryShown?: boolean; }

export function getEncryptSettings(): EncryptSettings {
  try {
    const raw = localStorage.getItem(ENC_SETTINGS_KEY);
    if (!raw) return { enabled: false };
    const parsed = JSON.parse(raw);
    return { enabled: !!parsed.enabled, recoveryShown: !!parsed.recoveryShown };
  } catch { return { enabled: false }; }
}

export function saveEncryptSettings(settings: EncryptSettings): void {
  localStorage.setItem(ENC_SETTINGS_KEY, JSON.stringify(settings));
}

export function markRecoveryShown(): void {
  const s = getEncryptSettings();
  s.recoveryShown = true;
  saveEncryptSettings(s);
}

export function isRecoveryShown(): boolean {
  return getEncryptSettings().recoveryShown === true;
}

export function clearEncryptSettings(): void {
  localStorage.removeItem(ENC_SETTINGS_KEY);
  localStorage.removeItem(MK_PW_KEY);
  localStorage.removeItem(MK_RECOVERY_KEY);
  localStorage.removeItem(RECOVERY_HASH_KEY);
  localStorage.removeItem(LOGIN_SALT_KEY);
  localStorage.removeItem(LOGIN_HASH_KEY);
  localStorage.removeItem(RECOVERY_BACKUP_KEY);
}

export function hasCloudRecoveryBackup(): boolean {
  return localStorage.getItem(RECOVERY_BACKUP_KEY) === '1';
}

// ========== 登录密码管理 ==========

export function saveLoginSalt(): string {
  const salt = randomBytes(PBKDF2_SALT_LEN);
  const saltB64 = bytesToBase64(salt);
  localStorage.setItem(LOGIN_SALT_KEY, saltB64);
  return saltB64;
}

export async function computeAndSaveLoginHash(password: string): Promise<string> {
  const saltB64 = localStorage.getItem(LOGIN_SALT_KEY);
  if (!saltB64) throw new Error('未设置登录盐值');
  const salt = base64ToBytes(saltB64);
  const rawKey = await deriveRawKey(password, salt);
  const hashBuf = await crypto.subtle.digest('SHA-256', rawKey);
  const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(LOGIN_HASH_KEY, hashHex);
  return hashHex;
}

export function getStoredLoginHash(): string | null { return localStorage.getItem(LOGIN_HASH_KEY); }
export function getStoredLoginSalt(): string | null { return localStorage.getItem(LOGIN_SALT_KEY); }

export async function verifyLoginPassword(password: string): Promise<boolean> {
  const storedHash = getStoredLoginHash();
  const saltB64 = getStoredLoginSalt();
  if (!storedHash || !saltB64) return false;
  const salt = base64ToBytes(saltB64);
  const rawKey = await deriveRawKey(password, salt);
  const hashBuf = await crypto.subtle.digest('SHA-256', rawKey);
  const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === storedHash;
}

// ========== 主密钥管理 ==========

export function generateMasterKey(): Uint8Array { return randomBytes(MK_LEN); }

export async function wrapMasterKey(mk: Uint8Array, password: string): Promise<{ salt: string; ciphertext: string }> {
  const salt = randomBytes(PBKDF2_SALT_LEN);
  const iv = randomBytes(GCM_IV_LEN);
  const key = await deriveAESKey(password, salt);
  const cipherBytes = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: GCM_TAG_LEN }, key, mk));
  return { salt: bytesToBase64(salt), ciphertext: bytesToBase64(concatBytes(iv, cipherBytes)) };
}

export async function unwrapMasterKey(wrapped: { salt: string; ciphertext: string }, password: string): Promise<Uint8Array | null> {
  try {
    const salt = base64ToBytes(wrapped.salt);
    const payload = base64ToBytes(wrapped.ciphertext);
    const iv = payload.slice(0, GCM_IV_LEN);
    const cipherBytes = payload.slice(GCM_IV_LEN);
    const key = await deriveAESKey(password, salt);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: GCM_TAG_LEN }, key, cipherBytes));
  } catch { return null; }
}

export function getWrappedMK(): { salt: string; ciphertext: string } | null {
  try { const raw = localStorage.getItem(MK_PW_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function saveWrappedMK(wrapped: { salt: string; ciphertext: string }): void {
  localStorage.setItem(MK_PW_KEY, JSON.stringify(wrapped));
}

// ========== 恢复码管理 ==========

const RECOVERY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRecoveryCode(): string {
  const bytes = randomBytes(RECOVERY_CODE_LEN);
  let code = '';
  for (let i = 0; i < RECOVERY_CODE_LEN; i++) code += RECOVERY_CHARS[bytes[i] % RECOVERY_CHARS.length];
  const groups: string[] = [];
  for (let i = 0; i < code.length; i += RECOVERY_GROUP_LEN) groups.push(code.slice(i, i + RECOVERY_GROUP_LEN));
  return groups.join('-');
}

export function normalizeRecoveryCode(input: string): string {
  return input.replace(/[-\s]/g, '').toUpperCase();
}

export async function hashRecoveryCode(code: string): Promise<string> {
  const normalized = normalizeRecoveryCode(code);
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getStoredRecoveryHash(): string | null { return localStorage.getItem(RECOVERY_HASH_KEY); }
export function saveRecoveryHash(hash: string): void { localStorage.setItem(RECOVERY_HASH_KEY, hash); }

export async function verifyRecoveryCode(code: string): Promise<boolean> {
  const storedHash = getStoredRecoveryHash();
  if (!storedHash) return false;
  return (await hashRecoveryCode(code)) === storedHash;
}

export async function wrapMKWithRecovery(mk: Uint8Array, recoveryCode: string): Promise<{ salt: string; ciphertext: string }> {
  const normalized = normalizeRecoveryCode(recoveryCode);
  const salt = randomBytes(PBKDF2_SALT_LEN);
  const iv = randomBytes(GCM_IV_LEN);
  const key = await deriveAESKey(normalized, salt);
  const cipherBytes = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: GCM_TAG_LEN }, key, mk));
  return { salt: bytesToBase64(salt), ciphertext: bytesToBase64(concatBytes(iv, cipherBytes)) };
}

export async function unwrapMKWithRecovery(wrapped: { salt: string; ciphertext: string }, recoveryCode: string): Promise<Uint8Array | null> {
  try {
    const normalized = normalizeRecoveryCode(recoveryCode);
    const salt = base64ToBytes(wrapped.salt);
    const payload = base64ToBytes(wrapped.ciphertext);
    const iv = payload.slice(0, GCM_IV_LEN);
    const cipherBytes = payload.slice(GCM_IV_LEN);
    const key = await deriveAESKey(normalized, salt);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: GCM_TAG_LEN }, key, cipherBytes));
  } catch { return null; }
}

export function getWrappedMKRecovery(): { salt: string; ciphertext: string } | null {
  try { const raw = localStorage.getItem(MK_RECOVERY_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function saveWrappedMKRecovery(wrapped: { salt: string; ciphertext: string }): void {
  localStorage.setItem(MK_RECOVERY_KEY, JSON.stringify(wrapped));
}

// ========== 文件加密/解密 ==========

export async function encryptContent(plaintext: string, mk: Uint8Array): Promise<string> {
  const iv = randomBytes(GCM_IV_LEN);
  const key = await crypto.subtle.importKey('raw', mk, { name: 'AES-GCM' }, false, ['encrypt']);
  const cipherBytes = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: GCM_TAG_LEN }, key, new TextEncoder().encode(plaintext)));
  return ENC_MAGIC_NEW + bytesToBase64(concatBytes(iv, cipherBytes));
}

async function decryptContentNew(content: string, mk: Uint8Array): Promise<string> {
  const payload = base64ToBytes(content.slice(ENC_MAGIC_NEW.length));
  if (payload.length < GCM_IV_LEN + 1) throw new Error('加密文件内容过短');
  const iv = payload.slice(0, GCM_IV_LEN);
  const cipherBytes = payload.slice(GCM_IV_LEN);
  const key = await crypto.subtle.importKey('raw', mk, { name: 'AES-GCM' }, false, ['decrypt']);
  try {
    return new TextDecoder().decode(new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: GCM_TAG_LEN }, key, cipherBytes)));
  } catch { throw new Error('解密失败：主密钥错误或文件已被篡改'); }
}

async function decryptContentOld(content: string, password: string): Promise<string> {
  const payload = base64ToBytes(content.slice(ENC_MAGIC_OLD.length));
  if (payload.length < PBKDF2_SALT_LEN + GCM_IV_LEN + 1) throw new Error('加密文件内容过短');
  const salt = payload.slice(0, PBKDF2_SALT_LEN);
  const iv = payload.slice(PBKDF2_SALT_LEN, PBKDF2_SALT_LEN + GCM_IV_LEN);
  const cipherBytes = payload.slice(PBKDF2_SALT_LEN + GCM_IV_LEN);
  const key = await deriveAESKey(password, salt);
  try {
    return new TextDecoder().decode(new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: GCM_TAG_LEN }, key, cipherBytes)));
  } catch { throw new Error('解密失败：密码错误或文件已被篡改'); }
}

export async function decryptContent(content: string, mk?: Uint8Array, password?: string): Promise<string> {
  if (content.startsWith(ENC_MAGIC_NEW)) {
    if (!mk) throw new Error('需要登录才能解密此文件');
    return decryptContentNew(content, mk);
  }
  if (content.startsWith(ENC_MAGIC_OLD)) {
    if (!password) throw new Error('需要加密密码才能解密此文件');
    return decryptContentOld(content, password);
  }
  return content;
}

export function isEncryptedContent(content: string | null | undefined): boolean {
  if (!content) return false;
  return content.startsWith(ENC_MAGIC_NEW) || content.startsWith(ENC_MAGIC_OLD);
}

export function isNewFormatEncrypted(content: string | null | undefined): boolean {
  return !!content && content.startsWith(ENC_MAGIC_NEW);
}

export function isOldFormatEncrypted(content: string | null | undefined): boolean {
  return !!content && content.startsWith(ENC_MAGIC_OLD);
}

// ========== maybeEncrypt / maybeDecrypt ==========

export async function maybeEncrypt(plaintext: string): Promise<string> {
  const settings = getEncryptSettings();
  if (!settings.enabled) return plaintext;
  const mk = getSessionMK();
  if (!mk) throw new Error('未登录，无法加密。请先输入密码登录。');
  return encryptContent(plaintext, mk);
}

export async function maybeDecrypt(content: string): Promise<string> {
  if (!isEncryptedContent(content)) return content;
  const mk = getSessionMK();
  if (!mk) throw new Error('文件为加密格式，请先输入密码登录');
  return decryptContent(content, mk);
}

// ========== 坚果云凭据加密（使用会话 MK） ==========

export async function encryptCredentials(username: string, password: string): Promise<string> {
  const mk = getSessionMK();
  if (!mk) throw new Error('未登录，无法加密凭据');
  const iv = randomBytes(GCM_IV_LEN);
  const key = await crypto.subtle.importKey('raw', mk, { name: 'AES-GCM' }, false, ['encrypt']);
  const cipherBytes = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: GCM_TAG_LEN }, key, new TextEncoder().encode(password)));
  return JSON.stringify({ username, passwordEnc: bytesToBase64(concatBytes(iv, cipherBytes)), v: 2 });
}

export async function decryptCredentials(encrypted: string): Promise<{ username: string; password: string } | null> {
  try {
    const parsed = JSON.parse(encrypted);
    if (!parsed.passwordEnc || !parsed.username) return null;
    const mk = getSessionMK();
    if (!mk) return null;
    const payload = base64ToBytes(parsed.passwordEnc);
    const iv = payload.slice(0, GCM_IV_LEN);
    const cipherBytes = payload.slice(GCM_IV_LEN);
    const key = await crypto.subtle.importKey('raw', mk, { name: 'AES-GCM' }, false, ['decrypt']);
    return { username: parsed.username, password: new TextDecoder().decode(new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: GCM_TAG_LEN }, key, cipherBytes))) };
  } catch { return null; }
}

export function isEncryptedCredentials(raw: string | null): boolean {
  if (!raw) return false;
  try { const p = JSON.parse(raw); return (p.v === 2 || p.v === 1) && !!p.passwordEnc; } catch { return false; }
}

// ========== 迁移旧格式文件 ==========

const API_BASE_URL = '/api/nutstore';

export async function migrateOldToNewFormat(
  basePath: string, oldPassword: string,
  onProgress?: (current: number, total: number) => void,
): Promise<{ success: boolean; migrated?: number; error?: string }> {
  const mk = getSessionMK();
  if (!mk) return { success: false, error: '未登录' };
  const raw = localStorage.getItem('nutstore_credentials');
  if (!raw) return { success: false, error: '未配置坚果云账号' };
  let creds: { username: string; password: string };
  if (isEncryptedCredentials(raw)) {
    const dec = await decryptCredentials(raw);
    if (!dec) return { success: false, error: '凭据解密失败，请先解锁加密会话' };
    creds = dec;
  } else {
    try { creds = JSON.parse(raw); } catch { return { success: false, error: '凭据格式错误' }; }
    if (!creds.username || !creds.password) return { success: false, error: '凭据格式错误' };
  }

  const listRes = await apiFetch(`${API_BASE_URL}/list`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: creds.username, password: creds.password, dirPath: basePath }),
  });
  if (!listRes.ok) return { success: false, error: '无法列出文件' };
  const files: string[] = ((await listRes.json()).files || []).filter((f: string) => f.endsWith('.md') || f.endsWith('.json'));

  let migrated = 0;
  for (let i = 0; i < files.length; i++) {
    const filePath = `${basePath}/${files[i]}`;
    onProgress?.(i + 1, files.length);
    try {
      const readRes = await apiFetch(`${API_BASE_URL}/read`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: creds.username, password: creds.password, filePath }),
      });
      if (!readRes.ok) continue;
      const rawContent = (await readRes.json()).content || '';
      if (!isOldFormatEncrypted(rawContent)) continue;
      const decrypted = await decryptContentOld(rawContent, oldPassword);
      const reEncrypted = await encryptContent(decrypted, mk);
      const writeRes = await apiFetch(`${API_BASE_URL}/write`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: creds.username, password: creds.password, filePath, content: reEncrypted }),
      });
      if (writeRes.ok) migrated++;
    } catch (e) { console.error(`迁移失败 ${filePath}:`, e); }
  }
  return { success: true, migrated };
}

// ========== 完整加密设置流程 ==========

const ALL_ENC_STORAGE_KEYS = [
  ENC_SETTINGS_KEY, MK_PW_KEY, MK_RECOVERY_KEY, RECOVERY_HASH_KEY,
  LOGIN_SALT_KEY, LOGIN_HASH_KEY, RECOVERY_BACKUP_KEY,
] as const;

function snapshotEncStorage(): Record<string, string | null> {
  const snap: Record<string, string | null> = {};
  for (const k of ALL_ENC_STORAGE_KEYS) snap[k] = localStorage.getItem(k);
  return snap;
}

function restoreEncStorage(snap: Record<string, string | null>): void {
  for (const [k, v] of Object.entries(snap)) {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  }
}

export async function setupEncryption(
  password: string, onProgress?: (msg: string) => void,
): Promise<{ success: boolean; recoveryCode?: string; error?: string }> {
  // v2.2 失败回滚：快照进入前状态，中途失败时恢复，避免留下半成品加密配置
  const snapshot = snapshotEncStorage();
  const prevMK = getSessionMK();
  try {
    onProgress?.('生成主密钥...');
    const mk = generateMasterKey();
    onProgress?.('保存登录验证...');
    saveLoginSalt();
    await computeAndSaveLoginHash(password);
    onProgress?.('加密主密钥...');
    saveWrappedMK(await wrapMasterKey(mk, password));
    onProgress?.('生成恢复码...');
    const recoveryCode = generateRecoveryCode();
    saveRecoveryHash(await hashRecoveryCode(recoveryCode));
    saveWrappedMKRecovery(await wrapMKWithRecovery(mk, recoveryCode));
    saveEncryptSettings({ enabled: true });
    setSessionMK(mk);
    return { success: true, recoveryCode };
  } catch (e: any) {
    restoreEncStorage(snapshot);
    if (prevMK) setSessionMK(prevMK); else clearSessionMK();
    return { success: false, error: e.message || '设置失败' };
  }
}

// ========== 登录流程 ==========

export async function loginWithPassword(
  password: string, basePath?: string, onProgress?: (msg: string) => void,
): Promise<{ success: boolean; migrated?: boolean; migrationCount?: number; error?: string }> {
  try {
    onProgress?.('验证密码...');
    if (!(await verifyLoginPassword(password))) return { success: false, error: '密码错误' };
    onProgress?.('解密主密钥...');
    const wrappedMK = getWrappedMK();
    if (!wrappedMK) return { success: false, error: '未找到加密配置' };
    const mk = await unwrapMasterKey(wrappedMK, password);
    if (!mk) return { success: false, error: '主密钥解密失败' };
    setSessionMK(mk);
    let migrated = false, migrationCount = 0;
    if (basePath) {
      onProgress?.('检查旧格式文件...');
      const r = await migrateOldToNewFormat(basePath, password, (c, t) => onProgress?.(`迁移 ${c}/${t}...`));
      if (r.success && r.migrated && r.migrated > 0) { migrated = true; migrationCount = r.migrated; }
    }
    return { success: true, migrated, migrationCount };
  } catch (e: any) { clearSessionMK(); return { success: false, error: e.message || '登录失败' }; }
}

// ========== 修改加密密码（旧密码验证 → 新密码重新包裹 MK，MK 不变） ==========

export async function changeEncryptionPassword(
  currentPassword: string, newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (newPassword.length < 6) return { success: false, error: '新密码至少 6 位' };
    if (newPassword === currentPassword) return { success: false, error: '新密码不能与当前密码相同' };
    let mk = getSessionMK();
    if (!mk) {
      if (!(await verifyLoginPassword(currentPassword))) return { success: false, error: '当前密码错误' };
      const wrappedMK = getWrappedMK();
      if (!wrappedMK) return { success: false, error: '未找到加密配置' };
      mk = await unwrapMasterKey(wrappedMK, currentPassword);
      if (!mk) return { success: false, error: '当前密码错误' };
    }
    saveWrappedMK(await wrapMasterKey(mk, newPassword));
    saveLoginSalt();
    await computeAndSaveLoginHash(newPassword);
    setSessionMK(mk);
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message || '修改失败' }; }
}

// ========== 忘记密码：恢复码重置（支持从云端拉取恢复备份） ==========

export async function resetPasswordWithRecovery(
  recoveryCode: string, newPassword: string,
  getCloudBackup?: () => Promise<{ salt: string; ciphertext: string } | null>,
): Promise<{ success: boolean; error?: string }> {
  try {
    let wrappedRecovery = getWrappedMKRecovery();
    if (!wrappedRecovery && getCloudBackup) {
      const cloud = await getCloudBackup();
      if (cloud) wrappedRecovery = cloud;
    }
    if (!wrappedRecovery) return { success: false, error: '未找到恢复配置（本地与云端均无备份）' };
    const mk = await unwrapMKWithRecovery(wrappedRecovery, recoveryCode);
    if (!mk) return { success: false, error: '恢复码错误或恢复配置与恢复码不匹配' };
    saveWrappedMKRecovery(wrappedRecovery);
    saveRecoveryHash(await hashRecoveryCode(recoveryCode));
    localStorage.setItem(RECOVERY_BACKUP_KEY, '1');
    saveWrappedMK(await wrapMasterKey(mk, newPassword));
    saveLoginSalt();
    await computeAndSaveLoginHash(newPassword);
    saveEncryptSettings({ enabled: true, recoveryShown: true });
    setSessionMK(mk);
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message || '重置失败' }; }
}

// ========== v1.19 迁移 ==========

export async function migrateFromV19(
  oldPassword: string, basePath?: string, onProgress?: (msg: string) => void,
): Promise<{ success: boolean; recoveryCode?: string; error?: string }> {
  try {
    onProgress?.('生成新主密钥...');
    const mk = generateMasterKey();
    onProgress?.('保存登录验证...');
    saveLoginSalt();
    await computeAndSaveLoginHash(oldPassword);
    onProgress?.('加密主密钥...');
    saveWrappedMK(await wrapMasterKey(mk, oldPassword));
    onProgress?.('生成恢复码...');
    const recoveryCode = generateRecoveryCode();
    saveRecoveryHash(await hashRecoveryCode(recoveryCode));
    saveWrappedMKRecovery(await wrapMKWithRecovery(mk, recoveryCode));
    saveEncryptSettings({ enabled: true });
    setSessionMK(mk);
    if (basePath) {
      onProgress?.('迁移旧文件...');
      await migrateOldToNewFormat(basePath, oldPassword, (c, t) => onProgress?.(`迁移 ${c}/${t}...`));
    }
    return { success: true, recoveryCode };
  } catch (e: any) { return { success: false, error: e.message || '迁移失败' }; }
}

// ========== v2.2：开启加密时迁移云端已有明文文件 ==========

export interface MigrationStats {
  total: number;
  migrated: number;
  alreadyEncrypted: number;
  oldFormat: number;
  failed: { file: string; error: string }[];
}

const MIGRATE_SUBDIRS = ['', 'journal', 'brain'];

async function getNutstoreCredsForMigration(): Promise<{ username: string; password: string } | { error: string }> {
  const raw = localStorage.getItem('nutstore_credentials');
  if (!raw) return { error: '未配置坚果云账号' };
  if (isEncryptedCredentials(raw)) {
    const dec = await decryptCredentials(raw);
    if (!dec) return { error: '凭据解密失败，请先解锁加密会话' };
    return dec;
  }
  try {
    const creds = JSON.parse(raw);
    if (creds.username && creds.password) return creds;
    return { error: '凭据格式错误' };
  } catch { return { error: '凭据格式错误' }; }
}

export async function encryptExistingFiles(
  basePath: string,
  onProgress?: (current: number, total: number, file: string) => void,
): Promise<{ success: boolean; stats?: MigrationStats; error?: string }> {
  const mk = getSessionMK();
  if (!mk) return { success: false, error: '加密会话未解锁，无法迁移' };
  const creds = await getNutstoreCredsForMigration();
  if ('error' in creds) return { success: false, error: creds.error };

  // 1. 收集根目录与子目录的全部 .md 文件
  const filePaths: string[] = [];
  for (const sub of MIGRATE_SUBDIRS) {
    const dirPath = sub ? `${basePath.replace(/\/+$/, '')}/${sub}` : basePath;
    try {
      const listRes = await apiFetch(`${API_BASE_URL}/list`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: creds.username, password: creds.password, dirPath }),
      });
      if (!listRes.ok) continue;
      const files: string[] = (await listRes.json()).files || [];
      for (const f of files) filePaths.push(sub ? `${dirPath}/${f}` : `${basePath.replace(/\/+$/, '')}/${f}`);
    } catch { /* 目录不存在（如 journal/brain）属正常，跳过 */ }
  }

  // 2. 逐个读取：明文 → 加密回写；密文/旧格式跳过并计数
  const stats: MigrationStats = { total: filePaths.length, migrated: 0, alreadyEncrypted: 0, oldFormat: 0, failed: [] };
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    onProgress?.(i + 1, stats.total, filePath);
    try {
      const readRes = await apiFetch(`${API_BASE_URL}/read`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: creds.username, password: creds.password, filePath }),
      });
      if (!readRes.ok) { stats.failed.push({ file: filePath, error: `读取失败(${readRes.status})` }); continue; }
      const rawContent = (await readRes.json()).content || '';
      if (isNewFormatEncrypted(rawContent)) { stats.alreadyEncrypted++; continue; }
      if (isOldFormatEncrypted(rawContent)) { stats.oldFormat++; continue; }
      if (!rawContent.trim()) continue; // 空文件无需加密
      const encrypted = await encryptContent(rawContent, mk);
      const writeRes = await apiFetch(`${API_BASE_URL}/write`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: creds.username, password: creds.password, filePath, content: encrypted }),
      });
      if (writeRes.ok) stats.migrated++;
      else stats.failed.push({ file: filePath, error: `写入失败(${writeRes.status})` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      stats.failed.push({ file: filePath, error: msg || '未知错误' });
    }
  }
  return { success: true, stats };
}

// ========== v2.2：云端恢复备份双通道（恢复码 + 密码） ==========

export interface CloudBackupPayload {
  v: 2;
  recovery: { salt: string; ciphertext: string };
  pw: { salt: string; ciphertext: string };
}

export function buildCloudBackupPayload(): CloudBackupPayload | null {
  const recovery = getWrappedMKRecovery();
  const pw = getWrappedMK();
  if (!recovery || !pw) return null;
  return { v: 2, recovery, pw };
}

export function parseCloudBackup(raw: string): { recovery: { salt: string; ciphertext: string } | null; pw: { salt: string; ciphertext: string } | null } | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.salt === 'string' && typeof parsed.ciphertext === 'string') {
      return { recovery: { salt: parsed.salt, ciphertext: parsed.ciphertext }, pw: null }; // 旧格式：仅恢复码通道
    }
    if (parsed && parsed.v === 2 && parsed.recovery && parsed.pw
      && typeof parsed.recovery.salt === 'string' && typeof parsed.pw.salt === 'string') {
      return { recovery: parsed.recovery, pw: parsed.pw };
    }
    return null;
  } catch { return null; }
}

// 清缓存/换设备后：用密码直接从云端备份恢复（旧格式备份无密码通道，需提示改用恢复码）
export async function unlockWithCloudBackup(
  password: string,
  fetchBackupRaw: () => Promise<string | null>,
): Promise<{ success: boolean; error?: string }> {
  const raw = await fetchBackupRaw();
  if (!raw) return { success: false, error: '云端未找到恢复备份' };
  const parsed = parseCloudBackup(raw);
  if (!parsed) return { success: false, error: '云端恢复备份格式无效' };
  if (!parsed.pw) return { success: false, error: '云端备份为旧格式（无密码通道），请使用恢复码重置' };
  const mk = await unwrapMasterKey(parsed.pw, password);
  if (!mk) return { success: false, error: '密码错误' };
  saveWrappedMK(parsed.pw);
  if (parsed.recovery) saveWrappedMKRecovery(parsed.recovery);
  saveLoginSalt();
  await computeAndSaveLoginHash(password);
  saveEncryptSettings({ enabled: true, recoveryShown: true });
  localStorage.setItem(RECOVERY_BACKUP_KEY, '1');
  setSessionMK(mk);
  return { success: true };
}
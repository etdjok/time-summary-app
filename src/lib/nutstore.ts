import { MarkdownEntry } from '../types';
import { parseMarkdownFile } from './filesmdParser';
import { apiFetch } from './auth';
import { maybeEncrypt, maybeDecrypt, encryptCredentials, decryptCredentials, isEncryptedCredentials, getWrappedMKRecovery, RECOVERY_BACKUP_FILENAME, RECOVERY_BACKUP_KEY, hasSessionMK, buildCloudBackupPayload, parseCloudBackup } from './crypto';

const STORAGE_KEY = 'nutstore_credentials';
const LOCAL_CACHE_KEY = 'filesmd_cache';
const API_BASE_URL = '/api/nutstore';

interface NutstoreCredentials {
  username: string;
  password: string;
}

export function getCredentials(): NutstoreCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // 如果是加密格式，返回 null（需要异步解密）
    if (isEncryptedCredentials(raw)) return null;
    const parsed = JSON.parse(raw);
    if (parsed.username && parsed.password) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getCredentialsAsync(): Promise<NutstoreCredentials | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // 如果是加密格式，需要解密
    if (isEncryptedCredentials(raw)) {
      return await decryptCredentials(raw);
    }
    const parsed = JSON.parse(raw);
    if (parsed.username && parsed.password) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveCredentials(username: string, password: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ username, password }));
}

export async function saveCredentialsEncrypted(username: string, password: string): Promise<void> {
  const encrypted = await encryptCredentials(username, password);
  localStorage.setItem(STORAGE_KEY, encrypted);
}

// 是否已以加密格式存储凭据（配合会话密钥，替代历史明文存储）
export function hasEncryptedCredentials(): boolean {
  const raw = localStorage.getItem(STORAGE_KEY);
  return isEncryptedCredentials(raw);
}

// 读取凭据用户名（加密/明文格式统一，用于 UI 回填，密码需解密）
export function getCredentialUsername(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.username || null;
  } catch {
    return null;
  }
}

// 智能保存：加密会话已解锁 → 凭据加密落盘；否则保持明文（兼容未启用加密的既有流程）
export async function saveCredentialsSmart(username: string, password: string): Promise<void> {
  if (hasSessionMK()) {
    try {
      await saveCredentialsEncrypted(username, password);
      return;
    } catch { /* 加密失败时回退明文，避免锁定自己 */ }
  }
  saveCredentials(username, password);
}

export function clearCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LOCAL_CACHE_KEY);
}

export function hasCredentials(): boolean {
  if (getCredentials() !== null) return true;
  const raw = localStorage.getItem(STORAGE_KEY);
  return isEncryptedCredentials(raw);
}

export async function testConnectionWithDetails(basePath: string): Promise<{ 
  success: boolean; 
  status?: number; 
  error?: string;
  rootFolders?: string[];
  basePathFiles?: string[];
  basePathFolders?: string[];
  pathResults?: { path: string; status: number; files: string[]; folders: string[] }[];
}> {
  const creds = await getCredentialsAsync();
  if (!creds) {
    return { success: false, error: '未配置坚果云账号' };
  }

  try {
    const response = await apiFetch(`${API_BASE_URL}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password, basePath }),
    });
    return await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : '连接失败';
    return { success: false, error: message };
  }
}

export async function listRootFolders(): Promise<{ 
  success: boolean; 
  folders?: string[];
  error?: string;
}> {
  const creds = await getCredentialsAsync();
  if (!creds) {
    return { success: false, error: '未配置坚果云账号' };
  }

  try {
    const response = await apiFetch(`${API_BASE_URL}/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password, dirPath: '/' }),
    });
    const data = await response.json();
    return response.ok ? { success: true, folders: data.folders || [] } : { success: false, error: data.error };
  } catch (error) {
    const message = error instanceof Error ? error.message : '连接失败';
    return { success: false, error: message };
  }
}

export async function fetchFilesMdEntries(basePath: string): Promise<MarkdownEntry[]> {
  return loadEntries(basePath);
}

export async function appendToChatMd(basePath: string, content: string): Promise<boolean> {
  return appendToFile(basePath, content, 'chat');
}

export async function appendToTodoMd(basePath: string, content: string): Promise<boolean> {
  return appendToFile(basePath, content, 'todo');
}

export async function appendToJournalMd(basePath: string, content: string): Promise<boolean> {
  return appendToFile(basePath, content, 'journal');
}

export async function appendToIdeaMd(basePath: string, content: string): Promise<boolean> {
  return appendToFile(basePath, content, 'idea');
}

export async function appendToNoteMd(basePath: string, content: string): Promise<boolean> {
  return appendToFile(basePath, content, 'note');
}

export async function testConnection(username: string, password: string, basePath: string): Promise<{ 
  success: boolean; 
  status?: number; 
  error?: string;
  rootFolders?: string[];
  basePathFiles?: string[];
  basePathFolders?: string[];
}> {
  try {
    const response = await apiFetch(`${API_BASE_URL}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, basePath }),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '连接失败' };
  }
}

export async function listFilesmdFiles(basePath: string): Promise<{ 
  success: boolean; 
  files?: string[]; 
  folders?: string[];
  error?: string;
}> {
  const creds = await getCredentialsAsync();
  if (!creds) {
    return { success: false, error: '未配置坚果云账号' };
  }

  try {
    const response = await apiFetch(`${API_BASE_URL}/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password, dirPath: basePath }),
    });
    const data = await response.json();
    return response.ok ? { success: true, files: data.files || [], folders: data.folders || [] } : { success: false, error: data.error };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '未知错误' };
  }
}

export async function readFile(path: string): Promise<{ 
  success: boolean; 
  content?: string;
  error?: string;
}> {
  const creds = await getCredentialsAsync();
  if (!creds) {
    return { success: false, error: '未配置坚果云账号' };
  }

  try {
    const response = await apiFetch(`${API_BASE_URL}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password, filePath: path }),
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error };
    }
    const rawContent = data.content || '';
    const decrypted = await maybeDecrypt(rawContent);
    return { success: true, content: decrypted };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '未知错误' };
  }
}

export async function writeFile(path: string, content: string): Promise<{ 
  success: boolean; 
  error?: string;
}> {
  const creds = await getCredentialsAsync();
  if (!creds) {
    return { success: false, error: '未配置坚果云账号' };
  }

  try {
    const encryptedContent = await maybeEncrypt(content);
    const response = await apiFetch(`${API_BASE_URL}/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password, filePath: path, content: encryptedContent }),
    });
    const data = await response.json();
    return response.ok ? { success: true } : { success: false, error: data.error };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '未知错误' };
  }
}

export async function loadEntries(basePath: string): Promise<MarkdownEntry[]> {
  const creds = await getCredentialsAsync();
  if (!creds) {
    return [];
  }

  try {
    const response = await apiFetch(`${API_BASE_URL}/filesmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password, basePath }),
    });

    if (!response.ok) {
      const data = await response.json();
      console.error('加载条目失败:', data.error);
      // 网络失败时回退到本地缓存
      const cached = localStorage.getItem(LOCAL_CACHE_KEY);
      if (cached) {
        try { return JSON.parse(cached); } catch { /* ignore */ }
      }
      return [];
    }

    const data = await response.json();
    const allEntries: MarkdownEntry[] = [];

    for (const { fileName, content } of data.entries || []) {
      const plainContent = await maybeDecrypt(content);
      const entries = parseMarkdownFile(plainContent, fileName);
      allEntries.push(...entries);
    }

    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(allEntries));
    return allEntries;
  } catch (error) {
    console.error('加载条目失败:', error);
    // 网络失败时回退到本地缓存
    const cached = localStorage.getItem(LOCAL_CACHE_KEY);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* ignore */ }
    }
    return [];
  }
}

export async function deleteFile(path: string): Promise<{ 
  success: boolean;
  error?: string;
}> {
  const creds = await getCredentialsAsync();
  if (!creds) {
    return { success: false, error: '未配置坚果云账号' };
  }

  try {
    const response = await apiFetch(`${API_BASE_URL}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password, filePath: path }),
    });
    const data = await response.json();
    return response.ok ? { success: true } : { success: false, error: data.error };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '删除失败' };
  }
}

export async function appendToFile(basePath: string, content: string, type: string): Promise<boolean> {
  const creds = await getCredentialsAsync();
  if (!creds) {
    return false;
  }

  try {
    let filePath = '';

    if (type === 'chat') {
      filePath = `${basePath}/Chat.md`;
    } else if (type === 'todo') {
      filePath = `${basePath}/Later.md`;
    } else if (type === 'journal') {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      filePath = `${basePath}/journal/${year}.${month}.md`;
    } else if (type === 'idea') {
      filePath = `${basePath}/Idea.md`;
    } else if (type === 'note') {
      filePath = `${basePath}/Note.md`;
    } else {
      // 自定义分类：用 target 名作为文件名
      filePath = `${basePath}/${type}.md`;
    }

    const readResponse = await apiFetch(`${API_BASE_URL}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password, filePath }),
    });

    let existingContent = '';
    if (readResponse.ok) {
      const data = await readResponse.json();
      existingContent = await maybeDecrypt(data.content || '');
    } else if (readResponse.status !== 404) {
      return false;
    }

    // 自动添加日期头 ## YYYY-MM-DD（如果文件中不存在今天的日期头）
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dateHeader = `## ${dateStr}`;
    
    let contentToAdd = content;
    if (type !== 'journal') {
      // 检查文件中是否已有今天的日期头
      if (!existingContent.includes(dateHeader)) {
        contentToAdd = `${dateHeader}\n${content}`;
      }
    } else if (type === 'journal') {
      // 日记文件使用 ### DD日 格式
      const dayHeader = `### ${now.getDate()}日`;
      if (!existingContent.includes(dayHeader)) {
        contentToAdd = `${dayHeader}\n${content}`;
      }
    }

    const newContent = existingContent.trimEnd() + '\n' + contentToAdd;
    const encryptedNewContent = await maybeEncrypt(newContent);

    const writeResponse = await apiFetch(`${API_BASE_URL}/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password, filePath, content: encryptedNewContent }),
    });

    if (writeResponse.ok) {
      localStorage.removeItem(LOCAL_CACHE_KEY);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// ========== 恢复码云端备份（绕过文件级加解密，原始读写） ==========

export async function readFileRaw(path: string): Promise<{
  success: boolean;
  content?: string;
  status?: number;
  error?: string;
}> {
  const creds = await getCredentialsAsync();
  if (!creds) return { success: false, error: '未配置坚果云账号' };
  try {
    const response = await apiFetch(`${API_BASE_URL}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password, filePath: path }),
    });
    if (response.status === 404) return { success: false, status: 404, error: '文件不存在' };
    if (!response.ok) return { success: false, error: `读取失败(${response.status})` };
    const data = await response.json();
    return { success: true, content: data.content || '' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '未知错误' };
  }
}

export async function writeFileRaw(path: string, content: string): Promise<{
  success: boolean;
  status?: number;
  error?: string;
}> {
  const creds = await getCredentialsAsync();
  if (!creds) return { success: false, error: '未配置坚果云账号' };
  try {
    const response = await apiFetch(`${API_BASE_URL}/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password, filePath: path, content }),
    });
    if (!response.ok) {
      const data = await response.json();
      return { success: false, status: response.status, error: data.error || `写入失败(${response.status})` };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '未知错误' };
  }
}

export async function backupRecoveryToCloud(basePath: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const recovery = getWrappedMKRecovery();
  if (!recovery) return { success: false, error: '本地未找到恢复密钥' };
  const dir = basePath || '/我的坚果云/笔记';
  const filePath = `${dir.replace(/\/+$/, '')}/${RECOVERY_BACKUP_FILENAME}`;
  // v2.2 双通道备份：恢复码通道 + 密码通道（清缓存后凭密码即可找回，无需恢复码）
  const payload = buildCloudBackupPayload();
  const content = payload ? JSON.stringify(payload) : JSON.stringify(recovery);
  const r = await writeFileRaw(filePath, content);
  if (r.success) localStorage.setItem(RECOVERY_BACKUP_KEY, '1');
  return r;
}

export async function fetchRecoveryBackupFromCloud(basePath: string): Promise<{
  success: boolean;
  wrapped?: { salt: string; ciphertext: string };
  backup?: { recovery: { salt: string; ciphertext: string } | null; pw: { salt: string; ciphertext: string } | null };
  raw?: string;
  error?: string;
}> {
  const dir = basePath || '/我的坚果云/笔记';
  const filePath = `${dir.replace(/\/+$/, '')}/${RECOVERY_BACKUP_FILENAME}`;
  const r = await readFileRaw(filePath);
  if (!r.success) return { success: false, error: r.error };
  const parsed = parseCloudBackup(r.content || '');
  if (!parsed) return { success: false, error: '云端恢复备份格式无效' };
  return { success: true, wrapped: parsed.recovery || undefined, backup: parsed, raw: r.content };
}

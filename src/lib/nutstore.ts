import { MarkdownEntry } from '../types';
import { parseMarkdownFile } from './filesmdParser';

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

export function clearCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LOCAL_CACHE_KEY);
}

export function hasCredentials(): boolean {
  return getCredentials() !== null;
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
  const creds = getCredentials();
  if (!creds) {
    return { success: false, error: '未配置坚果云账号' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/test`, {
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
  const creds = getCredentials();
  if (!creds) {
    return { success: false, error: '未配置坚果云账号' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/list`, {
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

export async function testConnection(username: string, password: string, basePath: string): Promise<{ 
  success: boolean; 
  status?: number; 
  error?: string;
  rootFolders?: string[];
  basePathFiles?: string[];
  basePathFolders?: string[];
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/test`, {
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
  const creds = getCredentials();
  if (!creds) {
    return { success: false, error: '未配置坚果云账号' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/list`, {
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
  const creds = getCredentials();
  if (!creds) {
    return { success: false, error: '未配置坚果云账号' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password, filePath: path }),
    });
    const data = await response.json();
    return response.ok ? { success: true, content: data.content } : { success: false, error: data.error };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '未知错误' };
  }
}

export async function writeFile(path: string, content: string): Promise<{ 
  success: boolean; 
  error?: string;
}> {
  const creds = getCredentials();
  if (!creds) {
    return { success: false, error: '未配置坚果云账号' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password, filePath: path, content }),
    });
    const data = await response.json();
    return response.ok ? { success: true } : { success: false, error: data.error };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '未知错误' };
  }
}

export async function loadEntries(basePath: string): Promise<MarkdownEntry[]> {
  const creds = getCredentials();
  if (!creds) {
    return [];
  }

  try {
    const response = await fetch(`${API_BASE_URL}/filesmd`, {
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
      const entries = parseMarkdownFile(content, fileName);
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
  const creds = getCredentials();
  if (!creds) {
    return { success: false, error: '未配置坚果云账号' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/delete`, {
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

export async function appendToFile(basePath: string, content: string, type: 'chat' | 'todo' | 'journal'): Promise<boolean> {
  const creds = getCredentials();
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
    }

    const readResponse = await fetch(`${API_BASE_URL}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password, filePath }),
    });

    let existingContent = '';
    if (readResponse.ok) {
      const data = await readResponse.json();
      existingContent = data.content || '';
    } else if (readResponse.status !== 404) {
      return false;
    }

    const newContent = existingContent.trimEnd() + '\n' + content;

    const writeResponse = await fetch(`${API_BASE_URL}/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password, filePath, content: newContent }),
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

const DEFAULT_PASSWORD = 'xinguang2026';

export { DEFAULT_PASSWORD };

const AUTH_TOKEN_KEY = 'heartlight_auth_token';

// 登录会话有效期（小时）
const SESSION_HOURS = 24;
const AUTH_KEY = 'heartlight_auth';
const AUTH_TIME_KEY = 'heartlight_auth_time';

// 判断本地登录会话是否仍有效（过期自动清除）
export function isAuthenticated(): boolean {
  let auth: string | null = null;
  let authTime: string | null = null;
  try {
    auth = localStorage.getItem(AUTH_KEY);
    authTime = localStorage.getItem(AUTH_TIME_KEY);
  } catch {
    // iOS 隐私模式等场景 localStorage 不可用：视为未登录
    return false;
  }
  if (!auth || !authTime) return false;
  const hoursSinceAuth = (Date.now() - parseInt(authTime)) / (1000 * 60 * 60);
  if (hoursSinceAuth > SESSION_HOURS) {
    try {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(AUTH_TIME_KEY);
    } catch { /* 忽略 */ }
    return false;
  }
  return true;
}

// 登录成功后写入本地会话标记
export function markAuthenticated(): void {
  try {
    localStorage.setItem(AUTH_KEY, 'true');
    localStorage.setItem(AUTH_TIME_KEY, Date.now().toString());
  } catch {
    // iOS 隐私模式等场景 localStorage 不可用：会话状态无法持久化，
    // 但本次登录仍可继续（刷新后需重新输入密码）
  }
}

// v2.2 登录结果区分网络错误与密码错误，避免误导排障方向
export interface VerifyResult {
  success: boolean;
  error?: 'network' | 'server' | 'auth' | 'rate_limited';
  message?: string;
}

export function getAuthToken(): string | null {
  try { return localStorage.getItem(AUTH_TOKEN_KEY); } catch { return null; }
}

export function clearAuthToken(): void {
  try { localStorage.removeItem(AUTH_TOKEN_KEY); } catch { /* 忽略 */ }
}

// v2.2 统一 API 请求包装：自动附带登录令牌。
// 服务端鉴权默认关闭时附带无副作用；开启后未登录请求将被服务端 401 拒绝。
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  if (!token) return fetch(url, init);
  const headers = new Headers(init.headers || {});
  headers.set('x-auth-token', token);
  return fetch(url, { ...init, headers });
}

export async function verifyPassword(password: string): Promise<VerifyResult> {
  try {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: 'rate_limited', message: data.error || '尝试过于频繁，请稍后再试' };
    }
    if (!res.ok) return { success: false, error: 'server', message: `服务器响应异常(${res.status})` };
    const data = await res.json();
    if (data.success === true) {
      // v2.2 保存服务端下发的 API 令牌（服务端鉴权开启时，apiFetch 会自动附带）
      if (typeof data.token === 'string' && data.token) {
        try { localStorage.setItem(AUTH_TOKEN_KEY, data.token); } catch { /* iOS 隐私模式等场景忽略 */ }
      }
      return { success: true };
    }
    return { success: false, error: 'auth', message: '密码错误，请重试' };
  } catch {
    return { success: false, error: 'network', message: '无法连接服务器，请检查网络或服务器是否运行' };
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    return data;
  } catch {
    return { success: false, error: '网络错误' };
  }
}

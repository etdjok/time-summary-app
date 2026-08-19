// 简单的加密存储工具 - 前端本地加密
// 注意：这不是强加密，只是防止简单的明文暴露

const CRYPTO_SECRET = "XINGUANG_AI_SECRET_2026";
const AI_CONFIG_KEY = "ai_config_encrypted";
const AI_CHAT_HISTORY_KEY = "ai_chat_history_encrypted";
const AI_SESSIONS_KEY = "ai_sessions_encrypted";
const ACTIVE_SESSION_KEY = "ai_active_session";

export function encryptData(data: string): string {
  try {
    const encrypted = Array.from(data)
      .map((char, i) => {
        const code = char.charCodeAt(0);
        const keyCode = CRYPTO_SECRET.charCodeAt(i % CRYPTO_SECRET.length);
        return String.fromCharCode(code ^ keyCode);
      })
      .join("");
    return btoa(unescape(encodeURIComponent(encrypted)));
  } catch {
    return "";
  }
}

export function decryptData(encrypted: string): string {
  try {
    const decoded = decodeURIComponent(escape(atob(encrypted)));
    return Array.from(decoded)
      .map((char, i) => {
        const code = char.charCodeAt(0);
        const keyCode = CRYPTO_SECRET.charCodeAt(i % CRYPTO_SECRET.length);
        return String.fromCharCode(code ^ keyCode);
      })
      .join("");
  } catch {
    return "";
  }
}

export interface AIConfig {
  apiKey: string;
  endpoint: string;
  model: string;
  provider: string;
  createdAt: string;
  enabled: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  contextType?: string;
}

const SENSITIVE_PATTERNS = [
  /密码|password|secret/i,
  /身份证|id.?card|id.?number/i,
  /银行卡|bank.?card|账号|account/i,
  /家庭住址|address|地址/i,
  /手机号|phone.?number|mobile/i,
  /邮箱|email/i,
  /token|api.?key/i,
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, // 信用卡号
  /\b1[3-9]\d{9}\b/, // 手机号格式
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/, // 邮箱格式
];

export function containsSensitiveWords(content: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(content));
}

export function filterSensitiveContent(content: string): string {
  let filtered = content;
  
  // 正则替换列表
  const regexReplacements: Array<{ pattern: RegExp; replacement: string }> = [
    { pattern: /密码|password|secret/gi, replacement: "[敏感信息已脱敏]" },
    { pattern: /身份证|id.?card|id.?number/gi, replacement: "[敏感信息已脱敏]" },
    { pattern: /银行卡|bank.?card|账号|account/gi, replacement: "[敏感信息已脱敏]" },
    { pattern: /家庭住址|address|地址/gi, replacement: "[敏感信息已脱敏]" },
    { pattern: /手机号|phone.?number|mobile/gi, replacement: "[敏感信息已脱敏]" },
    { pattern: /邮箱|email/gi, replacement: "[敏感信息已脱敏]" },
    { pattern: /token|api.?key/gi, replacement: "[敏感信息已脱敏]" },
    { pattern: /\b1[3-9]\d{9}\b/g, replacement: "[手机号已脱敏]" },
    { pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, replacement: "[邮箱已脱敏]" },
  ];
  
  for (const { pattern, replacement } of regexReplacements) {
    filtered = filtered.replace(pattern, replacement);
  }
  
  return filtered;
}

export function truncateContent(content: string, maxLength: number = 500): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + "...";
}

export interface SafeEntry {
  id: string;
  date: string;
  type: string;
  content: string;
  hasSensitive: boolean;
}

export function sanitizeEntriesForAI(entries: Array<{
  id: string;
  date: string;
  type: string;
  content: string;
}>): SafeEntry[] {
  return entries.map(entry => ({
    id: entry.id,
    date: entry.date,
    type: entry.type,
    content: truncateContent(entry.content, 500),
    hasSensitive: containsSensitiveWords(entry.content),
  }));
}

export function saveAIConfig(config: AIConfig): void {
  const safeConfig = {
    ...config,
    apiKey: encryptData(config.apiKey),
  };
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(safeConfig));
}

export function getAIConfig(): AIConfig | null {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    return {
      ...stored,
      apiKey: decryptData(stored.apiKey),
    };
  } catch {
    return null;
  }
}

export function clearAIConfig(): void {
  localStorage.removeItem(AI_CONFIG_KEY);
  localStorage.removeItem(AI_CHAT_HISTORY_KEY);
  localStorage.removeItem(AI_SESSIONS_KEY);
  localStorage.removeItem(ACTIVE_SESSION_KEY);
}

export function hasAIConfig(): boolean {
  const config = getAIConfig();
  return !!(config && config.enabled && config.apiKey && config.endpoint);
}

// ========== 会话管理功能 ==========

export function createSession(title?: string, contextType?: string): ChatSession {
  const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();
  const session: ChatSession = {
    id,
    title: title || `新对话 ${new Date().toLocaleString('zh-CN')}`,
    messages: [],
    createdAt: now,
    updatedAt: now,
    contextType,
  };
  saveSession(session);
  setActiveSession(id);
  return session;
}

export function getSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(AI_SESSIONS_KEY);
    if (!raw) return [];
    const sessions: ChatSession[] = JSON.parse(raw);
    return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

export function getSession(sessionId: string): ChatSession | null {
  const sessions = getSessions();
  return sessions.find(s => s.id === sessionId) || null;
}

export function saveSession(session: ChatSession): void {
  const sessions = getSessions();
  const index = sessions.findIndex(s => s.id === session.id);
  
  if (index >= 0) {
    sessions[index] = { ...session, updatedAt: new Date().toISOString() };
  } else {
    sessions.push(session);
  }
  
  localStorage.setItem(AI_SESSIONS_KEY, JSON.stringify(sessions));
}

export function updateSession(sessionId: string, updates: Partial<ChatSession>): ChatSession | null {
  const session = getSession(sessionId);
  if (!session) return null;
  
  const updated: ChatSession = {
    ...session,
    ...updates,
    id: session.id,
    updatedAt: new Date().toISOString(),
  };
  
  saveSession(updated);
  return updated;
}

export function deleteSession(sessionId: string): void {
  const sessions = getSessions();
  const filtered = sessions.filter(s => s.id !== sessionId);
  localStorage.setItem(AI_SESSIONS_KEY, JSON.stringify(filtered));
  
  // 如果删除的是活跃会话，切换到第一个
  const activeId = getActiveSessionId();
  if (activeId === sessionId) {
    if (filtered.length > 0) {
      setActiveSession(filtered[0].id);
    } else {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  }
}

export function setActiveSession(sessionId: string): void {
  localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
}

export function getActiveSessionId(): string | null {
  return localStorage.getItem(ACTIVE_SESSION_KEY);
}

export function getActiveSession(): ChatSession | null {
  const activeId = getActiveSessionId();
  if (!activeId) {
    const sessions = getSessions();
    return sessions.length > 0 ? sessions[0] : null;
  }
  return getSession(activeId);
}

export function addMessageToSession(sessionId: string, message: ChatMessage): ChatSession | null {
  const session = getSession(sessionId);
  if (!session) return null;
  
  const updatedSession: ChatSession = {
    ...session,
    messages: [...session.messages, message],
    updatedAt: new Date().toISOString(),
    // 如果是第一条用户消息，自动生成标题
    title: session.messages.length === 0 && message.role === 'user'
      ? message.content.substring(0, 30) || session.title
      : session.title,
  };
  
  saveSession(updatedSession);
  return updatedSession;
}

export function clearSessionMessages(sessionId: string): void {
  updateSession(sessionId, { messages: [] });
}

export function clearAllSessions(): void {
  localStorage.removeItem(AI_SESSIONS_KEY);
  localStorage.removeItem(ACTIVE_SESSION_KEY);
  localStorage.removeItem(AI_CHAT_HISTORY_KEY);
}

// ========== 向后兼容的旧函数 ==========

export function saveChatHistory(sessionId: string, messages: ChatMessage[]): void {
  const session = getSession(sessionId);
  if (session) {
    updateSession(sessionId, { messages });
  } else {
    const newSession: ChatSession = {
      id: sessionId,
      title: `对话 ${new Date().toLocaleString('zh-CN')}`,
      messages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveSession(newSession);
  }
}

export function getChatHistory(): Record<string, { messages: ChatMessage[]; updatedAt: string }> {
  const sessions = getSessions();
  const history: Record<string, { messages: ChatMessage[]; updatedAt: string }> = {};
  for (const session of sessions) {
    history[session.id] = {
      messages: session.messages,
      updatedAt: session.updatedAt,
    };
  }
  return history;
}

export function clearChatHistory(sessionId: string): void {
  deleteSession(sessionId);
}

export function clearAllChatHistory(): void {
  clearAllSessions();
}

export function limitChatHistory(messages: ChatMessage[], maxLength: number = 20): ChatMessage[] {
  const systemMessages = messages.filter(m => m.role === "system");
  const otherMessages = messages.filter(m => m.role !== "system");
  
  if (otherMessages.length <= maxLength) {
    return messages;
  }
  
  const limited = otherMessages.slice(-maxLength);
  return [...systemMessages, ...limited];
}

// 格式化时间显示
export function formatSessionTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return '昨天';
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }
}


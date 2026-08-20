import type { ChatMessage, AIConfig } from "./aiSecurity";
import { sendStreamRequest, createAbortController } from "./streamClient";
import { apiFetch } from "./auth";

const API_BASE = "/api/ai";

export interface ChatRequest {
  messages: ChatMessage[];
  context?: unknown;
  sessionId?: string;
}

export interface ChatResponse {
  reply: string;
  sessionId?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamCallbacks {
  onStart?: () => void;
  onChunk: (content: string) => void;
  onComplete: (fullContent: string) => void;
  onError: (error: Error) => void;
}

// 发送对话请求（非流式）
export async function sendChatMessage(
  messages: ChatMessage[],
  context?: unknown,
  sessionId?: string
): Promise<ChatResponse> {
  const response = await apiFetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context, sessionId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `请求失败 (${response.status})`);
  }

  return response.json();
}

// 发送流式对话请求（优化版本）
export function sendChatMessageStream(
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  config: AIConfig,
  context?: unknown,
  sessionId?: string
): AbortController {
  const controller = createAbortController();
  
  // 构建配置头
  const configHeader = Buffer.from(JSON.stringify(config)).toString("base64");
  
  const body = {
    messages,
    context,
    sessionId,
  };
  
  const headers = {
    "Content-Type": "application/json",
    "x-ai-config": configHeader,
  };
  
  sendStreamRequest(
    `${API_BASE}/chat/stream`,
    body,
    headers,
    {
      onStart: callbacks.onStart,
      onChunk: callbacks.onChunk,
      onComplete: callbacks.onComplete,
      onError: callbacks.onError,
    },
    {
      signal: controller.signal,
      maxRetries: 1, // 流式请求只重试一次
      timeout: 120000, // 2分钟超时
    }
  );
  
  return controller;
}

// 测试 AI 连接
export async function testAIConnection(config: AIConfig): Promise<{
  success: boolean;
  message: string;
}> {
  const response = await apiFetch(`${API_BASE}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  });

  if (response.ok) {
    const data = await response.json();
    return { success: true, message: data.message || "连接成功" };
  } else {
    const errorData = await response.json().catch(() => ({}));
    return { success: false, message: errorData.error || "连接失败" };
  }
}

// 获取 AI 支持的模型列表
export async function getAIModels(): Promise<Array<{ provider: string; name: string; label: string }>> {
  try {
    const response = await apiFetch(`${API_BASE}/models`);
    if (response.ok) {
      const data = await response.json();
      const models = data.models || [];
      return models.map((m: any) => {
        if (typeof m === "string") {
          return { provider: "custom", name: m, label: m };
        }
        return m;
      });
    }
    return [];
  } catch {
    return [];
  }
}

// 便捷方法：发送流式请求并获取完整内容
export async function sendStreamAndGetContent(
  messages: ChatMessage[],
  config: AIConfig,
  context?: unknown
): Promise<string> {
  return new Promise((resolve, reject) => {
    let content = "";
    
    sendChatMessageStream(
      messages,
      {
        onChunk: (chunk) => {
          content += chunk;
        },
        onComplete: () => {
          resolve(content);
        },
        onError: (error) => {
          reject(error);
        },
      },
      config,
      context
    );
  });
}

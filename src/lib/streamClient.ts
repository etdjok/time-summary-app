// 流式响应客户端 - 处理 SSE (Server-Sent Events) 协议

import { apiFetch } from './auth';

export interface StreamCallbacks {
  onStart?: () => void;
  onChunk: (content: string) => void;
  onComplete: (fullContent: string) => void;
  onError: (error: Error) => void;
  onConnectionError?: (error: Error) => void;
}

export interface StreamOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  signal?: AbortSignal;
}

const DEFAULT_OPTIONS: Required<StreamOptions> = {
  maxRetries: 2,
  retryDelay: 1000,
  timeout: 120000, // 2分钟
  signal: undefined as unknown as AbortSignal,
};

// 解析 SSE 数据行
function parseSSELine(line: string): string | null {
  const trimmed = line.trimEnd();
  
  // 兼容 "data:" 和 "data: " 两种格式
  if (trimmed.startsWith("data:")) {
    // 提取 "data:" 后面的内容（可能有空格也可能没有）
    const data = trimmed.slice(5).trimStart();
    return data;
  }
  
  return null;
}

// 发送流式请求
export async function sendStreamRequest(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  callbacks: StreamCallbacks,
  options: StreamOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let retryCount = 0;
  let lastError: Error | null = null;

  const executeRequest = async (): Promise<void> => {
    try {
      callbacks.onStart?.();
      
      const response = await apiFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
        signal: opts.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`请求失败 (${response.status}): ${errorText.slice(0, 200)}`);
      }

      if (!response.body) {
        throw new Error("浏览器不支持 ReadableStream");
      }

      // 检查 Content-Type
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream") && !contentType.includes("application/json")) {
        console.warn("响应类型不是 SSE:", contentType);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let isStreamDone = false;

      while (!isStreamDone) {
        const { done, value } = await reader.read();
        
        if (done) {
          isStreamDone = true;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        // 按换行分割，保留残行
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const data = parseSSELine(line);
          
          if (data === null) continue;
          
          // 处理 [DONE] 信号
          if (data === "[DONE]") {
            isStreamDone = true;
            break;
          }

          try {
            // 尝试解析 JSON
            const parsed = JSON.parse(data);
            
            // 处理不同的响应格式
            if (parsed.content) {
              fullContent += parsed.content;
              callbacks.onChunk(parsed.content);
            } else if (parsed.delta?.content) {
              const delta = parsed.delta.content;
              fullContent += delta;
              callbacks.onChunk(delta);
            } else if (parsed.choices?.[0]?.delta?.content) {
              const content = parsed.choices[0].delta.content;
              fullContent += content;
              callbacks.onChunk(content);
            } else if (parsed.choices?.[0]?.message?.content) {
              // 非流式格式的完整响应
              fullContent = parsed.choices[0].message.content;
              callbacks.onChunk(fullContent);
              isStreamDone = true;
              break;
            } else if (typeof parsed === "string") {
              fullContent += parsed;
              callbacks.onChunk(parsed);
            }
          } catch {
            // JSON 解析失败，可能是普通文本
            fullContent += data;
            callbacks.onChunk(data);
          }
        }
      }

      // 处理缓冲区中剩余的数据
      if (buffer.trim()) {
        const data = parseSSELine(buffer);
        if (data && data !== "[DONE]") {
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullContent += parsed.content;
              callbacks.onChunk(parsed.content);
            } else if (parsed.delta?.content) {
              fullContent += parsed.delta.content;
              callbacks.onChunk(parsed.delta.content);
            }
          } catch {
            fullContent += data;
            callbacks.onChunk(data);
          }
        }
      }

      callbacks.onComplete(fullContent);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      // 检查是否应该重试
      if (
        !opts.signal?.aborted &&
        retryCount < opts.maxRetries &&
        (err.message.includes("网络") || 
         err.message.includes("network") ||
         err.message.includes("fetch") ||
         err.message.includes("连接"))
      ) {
        retryCount++;
        lastError = err;
        
        // 等待重试延迟
        await new Promise(resolve => setTimeout(resolve, opts.retryDelay * retryCount));
        
        callbacks.onConnectionError?.(err);
        return executeRequest();
      }
      
      callbacks.onError(err);
    }
  };

  await executeRequest();
}

// 简化版本：只获取完整内容（不处理增量）
export async function sendSimpleStreamRequest(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  options: StreamOptions = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    let content = "";
    
    sendStreamRequest(
      url,
      body,
      headers,
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
      options
    );
  });
}

// 创建取消令牌
export function createAbortController(): AbortController {
  return new AbortController();
}

// 心跳检测 - 确保连接活跃
export function createHeartbeat(
  onTimeout: () => void,
  interval: number = 30000
): { start: () => void; stop: () => void; reset: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastActivity = Date.now();

  const check = () => {
    const now = Date.now();
    if (now - lastActivity > interval) {
      onTimeout();
    } else {
      timer = setTimeout(check, interval);
    }
  };

  return {
    start() {
      lastActivity = Date.now();
      timer = setTimeout(check, interval);
    },
    stop() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
    reset() {
      lastActivity = Date.now();
    },
  };
}

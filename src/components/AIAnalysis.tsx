import { useState, useMemo, useRef, useEffect } from "react";
import { Brain, CheckCircle, Circle, TrendingUp, Target, Sparkles, Calendar, AlertCircle, Send, Settings, Loader2, MessageCircle, BarChart3, Plus, Trash2, Bot, User, FileText, Clock, Database, Eye, EyeOff, Square } from "lucide-react";
import { useSummaryStore } from "../hooks/useSummaryStore";
import { useCategories } from "../hooks/useCategories";
import { FILE_TYPE_LABELS, PERIOD_LABELS } from "../types";
import { getAIConfig, hasAIConfig, sanitizeEntriesForAI, limitChatHistory, addMessageToSession, updateSession, getSession, createSession, getActiveSessionId, setActiveSession, filterSensitiveContent, type ChatMessage, type ChatSession } from "../lib/aiSecurity";
import { sendChatMessage, sendChatMessageStream } from "../lib/aiClient";

import { AIConfigPanel } from "./AIConfigPanel";
import { SessionSidebar } from "./SessionSidebar";

const priorityLabels: Record<string, string> = {
  urgent: "紧急且重要",
  high: "重要不紧急",
  medium: "紧急不重要",
  low: "不紧急不重要",
};

const priorityColors: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-gray-100 text-gray-700 border-gray-200",
};

type ViewMode = "analysis" | "chat";

const CONTEXT_OPTIONS = [
  { value: "current", label: "当前周期", desc: "仅使用当前时间周期的数据" },
  { value: "all", label: "全部数据", desc: "使用所有历史数据" },
  { value: "none", label: "无上下文", desc: "不提供历史数据，纯对话" },
];

export function AIAnalysis() {
  const { getPeriodEntries, currentPeriod, updateEntry, periodType } = useSummaryStore();
  const { categories } = useCategories();
  
  const [viewMode, setViewMode] = useState<ViewMode>("analysis");
  const [showConfig, setShowConfig] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  
  const [filter, setFilter] = useState<"all" | "completed" | "incomplete">("all");
  const [analyzing, setAnalyzing] = useState(false);
  
  // 多会话相关状态
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const [contextMode, setContextMode] = useState<"current" | "all" | "none">("current");
  const [showSensitive, setShowSensitive] = useState(false);
  
  // 对话相关状态
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamEnabled, setStreamEnabled] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const entries = getPeriodEntries();

  useEffect(() => {
    setAiReady(hasAIConfig());
  }, [showConfig]);

  // 加载当前会话的消息
  useEffect(() => {
    if (currentSession) {
      setChatMessages(currentSession.messages);
    } else {
      setChatMessages([]);
    }
  }, [currentSession?.id]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  const handleSessionChange = (session: ChatSession | null) => {
    setCurrentSession(session);
    setSidebarRefreshKey(k => k + 1);
  };

  const getTypeLabel = (type: string): string => {
    const cat = categories.find(c => c.id === type);
    const cleanType = type && type.startsWith("custom_") ? type.slice(7) : type;
    return cat?.label || (type && type.startsWith("custom_") ? type.slice(7) : null) || FILE_TYPE_LABELS[type] || cleanType;
  };

  const analysis = useMemo(() => {
    const total = entries.length;
    const todos = entries.filter(e => e.type === "todo");
    const completed = todos.filter(e => e.completed).length;
    const incomplete = todos.filter(e => !e.completed).length;
    const nonTodo = entries.filter(e => e.type !== "todo").length;

    const byType: Record<string, number> = {};
    entries.forEach(e => {
      const type = e.categoryId || e.type;
      byType[type] = (byType[type] || 0) + 1;
    });

    const todoByPriority: Record<string, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
    todos.forEach(e => { todoByPriority[e.priority]++; });

    const byDate: Record<string, number> = {};
    entries.forEach(e => {
      byDate[e.date] = (byDate[e.date] || 0) + 1;
    });
    const activeDays = Object.keys(byDate).length;
    const avgPerDay = activeDays > 0 ? (total / activeDays).toFixed(1) : "0";

    const topDate = Object.entries(byDate).sort((a, b) => b[1] - a[1])[0];
    const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
    const completionRate = todos.length > 0 ? Math.round((completed / todos.length) * 100) : 0;

    return { total, todos: todos.length, completed, incomplete, nonTodo, byType, todoByPriority, activeDays, avgPerDay, topDate, topType, completionRate };
  }, [entries]);

  const summary = useMemo(() => {
    const periodLabel = PERIOD_LABELS[currentPeriod.type] || "周期";
    const lines: string[] = [];

    lines.push(`【${currentPeriod.title} 智能分析报告】`);
    lines.push("");
    lines.push(`本${periodLabel}共记录 ${analysis.total} 条内容，活跃 ${analysis.activeDays} 天，日均 ${analysis.avgPerDay} 条。`);
    lines.push(`其中待办事项 ${analysis.todos} 项（已完成 ${analysis.completed} 项，未完成 ${analysis.incomplete} 项），完成率 ${analysis.completionRate}%。`);

    if (analysis.topType) {
      lines.push(`主要活动集中在「${getTypeLabel(analysis.topType[0])}」，共 ${analysis.topType[1]} 条，占比 ${Math.round(analysis.topType[1] / analysis.total * 100)}%。`);
    }

    if (analysis.todoByPriority.urgent > 0) {
      lines.push(`紧急事项 ${analysis.todoByPriority.urgent} 项，重要事项 ${analysis.todoByPriority.high} 项。`);
    }

    if (analysis.topDate) {
      lines.push(`最活跃日期为 ${analysis.topDate[0]}，记录了 ${analysis.topDate[1]} 条内容。`);
    }

    if (analysis.completionRate >= 80) {
      lines.push("整体完成率优秀，执行力强。");
    } else if (analysis.completionRate >= 50) {
      lines.push("完成率中等，仍有提升空间。");
    } else if (analysis.todos > 0) {
      lines.push("完成率偏低，建议优先处理未完成事项。");
    }

    return lines.join("\n");
  }, [analysis, currentPeriod, categories]);

  const nextPlan = useMemo(() => {
    const incompleteTodos = entries.filter(e => e.type === "todo" && !e.completed);
    const lines: string[] = [];
    const nextLabel = PERIOD_LABELS[currentPeriod.type] || "周期";

    lines.push(`【下一${nextLabel} 计划建议】`);
    lines.push("");

    if (incompleteTodos.length > 0) {
      const sorted = [...incompleteTodos].sort((a, b) => {
        const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        return order[a.priority] - order[b.priority];
      });

      lines.push(`需跟进未完成事项 ${sorted.length} 项：`);
      sorted.slice(0, 8).forEach((todo, i) => {
        const priorityTag = `[${priorityLabels[todo.priority]}]`;
        lines.push(`${i + 1}. ${priorityTag} ${todo.content.substring(0, 60)}`);
      });
      if (sorted.length > 8) {
        lines.push(`...及其他 ${sorted.length - 8} 项。`);
      }
    } else if (analysis.todos > 0) {
      lines.push("本期所有待办事项均已完成，建议规划新的目标。");
    } else {
      lines.push("本期无待办事项，建议增加行动类记录以提升执行力。");
    }

    if (analysis.todoByPriority.urgent > 0) {
      const urgentIncomplete = entries.filter(e => e.type === "todo" && !e.completed && e.priority === "urgent").length;
      if (urgentIncomplete > 0) {
        lines.push("");
        lines.push(`⚠️ 有 ${urgentIncomplete} 项紧急未完成事项，建议优先处理。`);
      }
    }

    if (analysis.completionRate < 50 && analysis.todos > 3) {
      lines.push("");
      lines.push("建议：减少待办数量，集中精力完成关键任务。");
    }

    return lines.join("\n");
  }, [entries, analysis, currentPeriod]);

  const filteredTodos = useMemo(() => {
    const todos = entries.filter(e => e.type === "todo");
    if (filter === "completed") return todos.filter(e => e.completed);
    if (filter === "incomplete") return todos.filter(e => !e.completed);
    return todos;
  }, [entries, filter]);

  const handleToggleComplete = async (entryId: string, completed: boolean) => {
    await updateEntry(entryId, { completed: !completed });
  };

  const handleAnalyze = () => {
    setAnalyzing(true);
    setTimeout(() => setAnalyzing(false), 1500);
  };

  // 获取发送给 AI 的上下文数据
  const getContextData = () => {
    if (contextMode === "none") return null;
    if (contextMode === "current") return sanitizeEntriesForAI(entries);
    // 全部数据模式
    return sanitizeEntriesForAI(entries); // 可以扩展为从坚果云加载全部
  };

  // 对话功能
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    // 如果没有当前会话，创建一个新的
    let session = currentSession;
    if (!session) {
      session = createSession();
      setCurrentSession(session);
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: inputValue,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setInputValue("");
    setIsLoading(true);
    setIsStreaming(streamEnabled);

    // 保存用户消息到会话
    addMessageToSession(session.id, userMessage);

    const config = getAIConfig();
    if (!config) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "AI 服务未配置，请先配置 AI 服务",
        timestamp: new Date().toISOString(),
      };
      setChatMessages([...newMessages, errorMessage]);
      addMessageToSession(session.id, errorMessage);
      setIsLoading(false);
      setIsStreaming(false);
      return;
    }

    // 获取上下文数据
    const contextData = getContextData();
    
    // 限制历史消息长度
    const limitedMessages = limitChatHistory(newMessages, 20);

    if (streamEnabled) {
      // 流式模式
      // 创建占位的助手消息
      const placeholderMessage: ChatMessage = {
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };
      const messagesWithPlaceholder = [...newMessages, placeholderMessage];
      setChatMessages(messagesWithPlaceholder);

      let accumulatedContent = "";
      
      const controller = sendChatMessageStream(
        limitedMessages,
        {
          onStart: () => {
            setIsStreaming(true);
          },
          onChunk: (chunk) => {
            accumulatedContent += chunk;
            // 更新最后一条消息的内容
            setChatMessages(prev => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  content: accumulatedContent,
                };
              }
              return updated;
            });
          },
          onComplete: () => {
            // 保存完整的助手消息到会话
            const finalMessage: ChatMessage = {
              role: "assistant",
              content: accumulatedContent || "抱歉，我未能生成回复。",
              timestamp: new Date().toISOString(),
            };
            setChatMessages(prev => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
                updated[lastIdx] = finalMessage;
              }
              return updated;
            });
            addMessageToSession(session.id, finalMessage);
            setIsLoading(false);
            setIsStreaming(false);
            setSidebarRefreshKey(k => k + 1);
          },
          onError: (error) => {
            const errorMessage: ChatMessage = {
              role: "assistant",
              content: `抱歉，出现了问题：${error.message}`,
              timestamp: new Date().toISOString(),
            };
            setChatMessages(prev => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
                updated[lastIdx] = errorMessage;
              }
              return updated;
            });
            addMessageToSession(session.id, errorMessage);
            setIsLoading(false);
            setIsStreaming(false);
          },
        },
        config,
        contextData
      );
      
      abortControllerRef.current = controller;
    } else {
      // 非流式模式（原有逻辑）
      try {
        const configHeader = Buffer.from(JSON.stringify(config)).toString("base64");

        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-ai-config": configHeader,
          },
          body: JSON.stringify({
            messages: limitedMessages,
            context: contextData,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `请求失败 (${response.status})`);
        }

        const data = await response.json();
        
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.reply,
          timestamp: new Date().toISOString(),
        };

        setChatMessages([...newMessages, assistantMessage]);
        
        // 保存 AI 回复到会话
        addMessageToSession(session.id, assistantMessage);
        
        setSidebarRefreshKey(k => k + 1);
      } catch (error) {
        const errorMessage: ChatMessage = {
          role: "assistant",
          content: `抱歉，出现了问题：${error instanceof Error ? error.message : "未知错误"}`,
          timestamp: new Date().toISOString(),
        };
        setChatMessages([...newMessages, errorMessage]);
        addMessageToSession(session.id, errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // 停止生成
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setIsStreaming(false);
  };

  const handleNewSession = () => {
    const session = createSession();
    setCurrentSession(session);
    setChatMessages([]);
    setSidebarRefreshKey(k => k + 1);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickQuestions = [
    "帮我总结本期的记录",
    "我最需要关注什么？",
    "如何提高完成率？",
    "分析我的时间分配",
  ];

  // 根据消息内容判断是否包含敏感信息
  const hasSensitiveContent = (content: string) => {
    const sensitivePatterns = [
      /密码|password|secret/i,
      /身份证|id.?card/i,
      /银行卡|账号/i,
      /手机号|phone.?number/i,
      /邮箱|email/i,
    ];
    return sensitivePatterns.some(p => p.test(content));
  };

  const renderMessageContent = (content: string, role: string) => {
    if (showSensitive || role === "user" || !hasSensitiveContent(content)) {
      return content;
    }
    return filterSensitiveContent(content);
  };

  if (entries.length === 0 && viewMode === "analysis") {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 text-center">
        <Brain className="w-10 h-10 text-amber-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">当前周期暂无记录数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部工具栏 */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("analysis")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === "analysis" ? "bg-amber-500 text-white" : "text-gray-600 hover:bg-white"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              分析报告
            </button>
            <button
              onClick={() => setViewMode("chat")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === "chat" ? "bg-amber-500 text-white" : "text-gray-600 hover:bg-white"
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              AI 对话
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig(true)}
              className={`p-2 rounded-lg transition-colors ${
                aiReady ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
              }`}
              title={aiReady ? "AI 已配置" : "配置 AI"}
            >
              <Settings className="w-4 h-4" />
            </button>
            {aiReady && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                AI 就绪
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 分析报告视图 */}
      {viewMode === "analysis" && entries.length > 0 && (
        <>
          {/* 智能分析报告 */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-gray-800">AI 智能分析</h3>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {analyzing ? "分析中..." : "重新分析"}
              </button>
            </div>

            {/* 核心指标 */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="bg-amber-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-amber-600">{analysis.total}</p>
                <p className="text-xs text-amber-600/70">总记录</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-green-600">{analysis.completed}</p>
                <p className="text-xs text-green-600/70">已完成</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-orange-600">{analysis.incomplete}</p>
                <p className="text-xs text-orange-600/70">未完成</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-blue-600">{analysis.completionRate}%</p>
                <p className="text-xs text-blue-600/70">完成率</p>
              </div>
            </div>

            {/* 总结文本 */}
            <div className="bg-gray-50 rounded-xl p-3 mb-3">
              <div className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{summary}</pre>
              </div>
            </div>

            {/* 下期计划 */}
            <div className="bg-blue-50 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <Target className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{nextPlan}</pre>
              </div>
            </div>
          </div>

          {/* 待办事项跟踪 */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-gray-800">待办事项跟踪</h3>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    filter === "all" ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  全部 ({analysis.todos})
                </button>
                <button
                  onClick={() => setFilter("completed")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    filter === "completed" ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  已完成 ({analysis.completed})
                </button>
                <button
                  onClick={() => setFilter("incomplete")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    filter === "incomplete" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  未完成 ({analysis.incomplete})
                </button>
              </div>
            </div>

            {/* 待办列表 */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredTodos.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">暂无相关待办事项</p>
              ) : (
                filteredTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`flex items-start gap-2 p-2 rounded-lg transition-colors ${
                      todo.completed ? "bg-green-50" : "bg-gray-50"
                    }`}
                  >
                    <button
                      onClick={() => handleToggleComplete(todo.id, todo.completed || false)}
                      className="flex-shrink-0 mt-0.5"
                    >
                      {todo.completed ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-400 hover:text-amber-500" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm text-gray-700 ${todo.completed ? "line-through opacity-60" : ""}`}>
                        {todo.content}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${priorityColors[todo.priority]}`}>
                          {priorityLabels[todo.priority]}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {todo.date} {todo.time || ""}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {filter !== "all" && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span>
                    {filter === "completed"
                      ? `共 ${analysis.completed} 项已完成，完成率 ${analysis.completionRate}%`
                      : `共 ${analysis.incomplete} 项未完成，建议优先处理紧急事项`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* AI 对话视图 */}
      {viewMode === "chat" && (
        <div className="flex bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden" style={{ height: "600px" }}>
          {/* 侧边栏 - 会话列表 */}
          <SessionSidebar
            onSessionChange={handleSessionChange}
            refreshKey={sidebarRefreshKey}
          />
          
          {/* 主对话区域 */}
          <div className="flex-1 flex flex-col">
            {!aiReady ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <Bot className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="font-medium text-gray-700 mb-2">AI 助手未配置</h3>
                <p className="text-sm text-gray-500 mb-4 text-center">请先配置 AI 服务才能使用对话功能</p>
                <button
                  onClick={() => setShowConfig(true)}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600"
                >
                  立即配置
                </button>
              </div>
            ) : (
              <>
                {/* 对话头部 */}
                <div className="flex items-center justify-between p-3 border-b bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-amber-500" />
                    <span className="font-medium text-gray-700">
                      {currentSession?.title || "心光 AI 助手"}
                    </span>
                    {chatMessages.length > 0 && (
                      <span className="text-xs text-gray-400">({chatMessages.length} 条消息)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* 上下文选择 */}
                    <select
                      value={contextMode}
                      onChange={(e) => setContextMode(e.target.value as "current" | "all" | "none")}
                      className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 focus:outline-none focus:border-amber-400"
                      title="选择对话上下文"
                    >
                      {CONTEXT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleNewSession}
                      className="p-1.5 text-gray-400 hover:text-amber-500 rounded-lg hover:bg-amber-50 transition-colors"
                      title="新建对话"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 消息列表 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <MessageCircle className="w-10 h-10 mb-3 text-amber-300" />
                      <p className="text-sm">开始与 AI 助手对话吧</p>
                      <div className="mt-6 w-full max-w-xs space-y-2">
                        <p className="text-xs text-gray-400 text-center mb-2">试试这些问题：</p>
                        {quickQuestions.map((q) => (
                          <button
                            key={q}
                            onClick={() => setInputValue(q)}
                            className="w-full text-left px-3 py-2 bg-amber-50 text-amber-700 rounded-lg text-xs hover:bg-amber-100 transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {msg.role === "assistant" && (
                          <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-amber-600" />
                          </div>
                        )}
                        <div
                          className={`max-w-[75%] rounded-xl px-3 py-2 ${
                            msg.role === "user"
                              ? "bg-amber-500 text-white rounded-br-sm"
                              : "bg-white text-gray-800 rounded-bl-sm shadow-sm"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {renderMessageContent(msg.content, msg.role)}
                          </p>
                          <div className={`flex items-center gap-1 mt-1 ${msg.role === "user" ? "text-amber-100" : "text-gray-400"}`}>
                            <span className="text-xs">
                              {new Date(msg.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {msg.role === "assistant" && hasSensitiveContent(msg.content) && (
                              <button
                                onClick={() => setShowSensitive(!showSensitive)}
                                className="p-0.5 hover:bg-gray-100 rounded"
                                title={showSensitive ? "隐藏敏感内容" : "显示敏感内容"}
                              >
                                {showSensitive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </div>
                        {msg.role === "user" && (
                          <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {isLoading && (
                    <div className="flex gap-2 justify-start">
                      <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="bg-white rounded-xl px-3 py-2 shadow-sm">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* 输入区域 */}
                <div className="p-3 border-t bg-white">
                  {/* 上下文提示 */}
                  <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                    <Database className="w-3 h-3" />
                    <span>
                      上下文：{CONTEXT_OPTIONS.find(o => o.value === contextMode)?.label}
                      {contextMode === "none" && "（不使用历史数据）"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={streamEnabled}
                        onChange={(e) => setStreamEnabled(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-400"
                      />
                      流式响应
                    </label>
                    {isStreaming && (
                      <button
                        onClick={handleStopGeneration}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 ml-2"
                      >
                        <Square className="w-3 h-3" />
                        停止生成
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="输入你的问题，Enter 发送，Shift+Enter 换行"
                      rows={1}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 resize-none max-h-24"
                      disabled={isLoading}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim() || isLoading}
                      className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                      {isLoading ? (
                        isStreaming ? (
                          <span className="flex gap-0.5">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </span>
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      {isStreaming ? "生成中" : "发送"}
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <span>🔒 你的对话内容经过脱敏处理</span>
                    <span>当前模型：{getAIConfig()?.model || "未配置"}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* AI 配置面板 */}
      {showConfig && (
        <AIConfigPanel
          onClose={() => setShowConfig(false)}
          onConfigChange={() => setAiReady(hasAIConfig())}
        />
      )}
    </div>
  );
}



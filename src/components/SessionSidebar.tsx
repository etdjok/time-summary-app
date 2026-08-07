import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Check, X, MessageSquare, Clock, Search } from "lucide-react";
import { getSessions, getActiveSessionId, setActiveSession, deleteSession, updateSession, createSession, formatSessionTime, type ChatSession } from "../lib/aiSecurity";

interface SessionSidebarProps {
  onSessionChange: (session: ChatSession | null) => void;
  refreshKey: number;
}

export function SessionSidebar({ onSessionChange, refreshKey }: SessionSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadSessions();
  }, [refreshKey]);

  const loadSessions = () => {
    const allSessions = getSessions();
    setSessions(allSessions);
    const active = getActiveSessionId();
    if (active) {
      setActiveId(active);
    } else if (allSessions.length > 0) {
      setActiveId(allSessions[0].id);
      setActiveSession(allSessions[0].id);
      onSessionChange(allSessions[0]);
    }
  };

  const handleNewSession = () => {
    const session = createSession();
    setActiveId(session.id);
    onSessionChange(session);
    loadSessions();
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveId(sessionId);
    setActiveSession(sessionId);
    const session = getSessions().find(s => s.id === sessionId) || null;
    onSessionChange(session);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (confirm("确定要删除这个对话吗？")) {
      deleteSession(sessionId);
      loadSessions();
      // 如果删除的是当前活跃会话，切换到第一个
      if (activeId === sessionId) {
        const remaining = getSessions();
        if (remaining.length > 0) {
          setActiveId(remaining[0].id);
          setActiveSession(remaining[0].id);
          onSessionChange(remaining[0]);
        } else {
          setActiveId(null);
          onSessionChange(null);
        }
      }
    }
  };

  const handleStartEdit = (session: ChatSession) => {
    setEditingId(session.id);
    setEditingTitle(session.title);
  };

  const handleSaveTitle = () => {
    if (editingId && editingTitle.trim()) {
      updateSession(editingId, { title: editingTitle.trim() });
      loadSessions();
    }
    setEditingId(null);
    setEditingTitle("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const filteredSessions = searchQuery
    ? sessions.filter(s => 
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : sessions;

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* 头部 */}
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={handleNewSession}
          className="w-full py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新对话
        </button>
      </div>

      {/* 搜索框 */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索对话..."
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto">
        {filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4">
            <MessageSquare className="w-8 h-8 mb-2 text-gray-300" />
            <p className="text-xs">暂无对话</p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className={`group p-2 rounded-lg cursor-pointer transition-colors ${
                  activeId === session.id
                    ? "bg-amber-100 border border-amber-200"
                    : "hover:bg-gray-100"
                }`}
                onClick={() => activeId !== session.id && handleSelectSession(session.id)}
              >
                {editingId === session.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveTitle();
                        if (e.key === "Escape") handleCancelEdit();
                      }}
                      onBlur={handleSaveTitle}
                      autoFocus
                      className="flex-1 px-2 py-1 text-sm border border-amber-300 rounded focus:outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSaveTitle(); }}
                      className="p-1 text-green-500 hover:bg-green-50 rounded"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate flex-1 ${activeId === session.id ? "text-amber-700 font-medium" : "text-gray-700"}`}>
                        {session.title}
                      </span>
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartEdit(session); }}
                          className="p-1 text-gray-400 hover:text-amber-500 rounded"
                          title="重命名"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                          className="p-1 text-gray-400 hover:text-red-500 rounded"
                          title="删除"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-400">
                        {formatSessionTime(session.updatedAt)}
                      </span>
                      {session.messages.length > 0 && (
                        <span className="text-xs text-gray-400 ml-1">
                          · {session.messages.length}条
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部统计 */}
      <div className="p-3 border-t border-gray-200 text-xs text-gray-400">
        共 {sessions.length} 个对话
      </div>
    </div>
  );
}

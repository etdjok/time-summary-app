import { useState } from 'react';
import { X, Save, MessageSquare, CheckCircle, Lightbulb, BookOpen, FileText } from 'lucide-react';
import { MarkdownEntry, STATUS_OPTIONS } from '../types';
import { useSummaryStore } from '../hooks/useSummaryStore';

interface EntryEditModalProps {
  entry: MarkdownEntry;
  onClose: () => void;
}

const typeOptions = [
  { value: 'chat' as const, label: '收集箱', icon: MessageSquare, color: 'bg-blue-500' },
  { value: 'todo' as const, label: '待办', icon: CheckCircle, color: 'bg-amber-500' },
  { value: 'idea' as const, label: '想法', icon: Lightbulb, color: 'bg-pink-500' },
  { value: 'journal' as const, label: '日记', icon: BookOpen, color: 'bg-green-500' },
  { value: 'note' as const, label: '笔记', icon: FileText, color: 'bg-purple-500' },
];

const priorityOptions = [
  { value: 'urgent' as const, label: 'Q1 紧急且重要', color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'high' as const, label: 'Q2 重要不紧急', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'medium' as const, label: 'Q3 紧急不重要', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'low' as const, label: 'Q4 不紧急不重要', color: 'bg-gray-100 text-gray-600 border-gray-300' },
];

export function EntryEditModal({ entry, onClose }: EntryEditModalProps) {
  const { updateEntry, loadEntries } = useSummaryStore();
  const [content, setContent] = useState(entry.content);
  const [type, setType] = useState(entry.type);
  const [priority, setPriority] = useState(entry.priority);
  const [status, setStatus] = useState(entry.status || (entry.completed ? 'completed' : 'in-progress'));
  const [completed, setCompleted] = useState(entry.completed || false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    setError('');

    try {
      const success = await updateEntry(entry.id, {
        content: content.trim(),
        type,
        priority,
        status,
        completed: type === 'todo' ? completed : undefined,
      });

      if (success) {
        loadEntries();
        onClose();
      } else {
        setError('保存失败，请稍后重试');
      }
    } catch (err) {
      setError(`保存出错: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-800">编辑记录</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* 内容编辑 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 resize-none"
              placeholder="编辑内容..."
            />
          </div>

          {/* 类型选择 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">分类</label>
            <div className="flex flex-wrap gap-1.5">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                    type === opt.value
                      ? `${opt.color} text-white`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <opt.icon className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 优先级 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">优先级</label>
            <div className="flex flex-wrap gap-1.5">
              {priorityOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all ${
                    priority === opt.value
                      ? opt.color
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 状态 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">状态</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                    status === opt.value
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 待办完成标记 */}
          {type === 'todo' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-completed"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded border-gray-300 focus:ring-amber-500"
              />
              <label htmlFor="edit-completed" className="text-sm text-gray-700">标记为已完成</label>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex-shrink-0 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors font-medium text-sm"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!content.trim() || isSaving}
            className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

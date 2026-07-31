import { useState } from 'react';
import { CheckCircle, MessageSquare, BookOpen, Lightbulb, FileText, ChevronDown, ChevronUp, Clock, Tag, Edit2, Trash2, X, Check, Star, Heart, Flag, Bookmark, Bell, Calendar, Mail, Music, Camera, ShoppingCart } from 'lucide-react';
import { MarkdownEntry, FILE_TYPE_LABELS } from '../types';
import { MarkdownPreview } from './MarkdownPreview';
import { useSummaryStore } from '../hooks/useSummaryStore';
import { useCategories } from '../hooks/useCategories';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare, CheckCircle, Lightbulb, BookOpen, FileText,
  Star, Heart, Flag, Tag, Bookmark, Bell, Calendar, Mail, Music, Camera, ShoppingCart,
};

const defaultTypeIcons: Record<string, React.ReactNode> = {
  chat: <MessageSquare className="w-4 h-4" />,
  journal: <BookOpen className="w-4 h-4" />,
  todo: <CheckCircle className="w-4 h-4" />,
  idea: <Lightbulb className="w-4 h-4" />,
  note: <FileText className="w-4 h-4" />,
};

const defaultTypeColors: Record<string, string> = {
  chat: 'bg-blue-100 text-blue-700',
  journal: 'bg-green-100 text-green-700',
  todo: 'bg-amber-100 text-amber-700',
  idea: 'bg-pink-100 text-pink-700',
  note: 'bg-purple-100 text-purple-700',
};

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-gray-100 text-gray-700 border-gray-200',
};

const priorityLabels: Record<string, string> = {
  urgent: '紧急',
  high: '重要',
  medium: '一般',
  low: '次要',
};

interface EntryItemProps {
  entry: MarkdownEntry;
}

export function EntryItem({ entry }: EntryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editContent, setEditContent] = useState(entry.content);
  const [editType, setEditType] = useState(entry.type);
  const [editPriority, setEditPriority] = useState(entry.priority);
  const [saving, setSaving] = useState(false);
  
  const { updateEntry, deleteEntry, loadEntries } = useSummaryStore();
  const { categories } = useCategories();

  const isCompleted = entry.type === 'todo' && entry.completed;

  // 获取条目显示类型（优先使用 categoryId）
  const displayType = entry.categoryId || entry.type;

  // 获取类型标签
  const getTypeLabel = (type: string): string => {
    const cat = categories.find(c => c.id === type);
    if (cat) return cat.label;
    return FILE_TYPE_LABELS[type] || type;
  };

  // 获取类型图标
  const getTypeIcon = (type: string): React.ReactNode => {
    if (defaultTypeIcons[type]) return defaultTypeIcons[type];
    const cat = categories.find(c => c.id === type);
    if (cat) {
      const Icon = ICON_MAP[cat.icon] || MessageSquare;
      return <Icon className="w-4 h-4" />;
    }
    return <MessageSquare className="w-4 h-4" />;
  };

  // 获取类型颜色
  const getTypeColor = (type: string): string => {
    if (defaultTypeColors[type]) return defaultTypeColors[type];
    const cat = categories.find(c => c.id === type);
    if (cat) {
      return `${cat.color} text-white`;
    }
    return 'bg-gray-100 text-gray-600';
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    const success = await updateEntry(entry.id, {
      content: editContent,
      type: editType,
      priority: editPriority as any,
    });
    setSaving(false);
    
    if (success) {
      setIsEditing(false);
      await loadEntries();
    } else {
      alert('保存失败，请重试');
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    const success = await deleteEntry(entry.id);
    setSaving(false);
    
    if (success) {
      await loadEntries();
    } else {
      alert('删除失败，请重试');
    }
  };

  const handleCancelEdit = () => {
    setEditContent(entry.content);
    setEditType(entry.type);
    setEditPriority(entry.priority);
    setIsEditing(false);
  };

  // 构建类型选项列表（包括所有现有分类）
  const typeOptions = categories.map(cat => ({
    value: cat.id,
    label: cat.label,
  }));

  const priorityOptions = [
    { value: 'urgent', label: '紧急' },
    { value: 'high', label: '重要' },
    { value: 'medium', label: '一般' },
    { value: 'low', label: '次要' },
  ];

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-2 transition-all ${
        isCompleted ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getTypeColor(displayType)}`}>
          {getTypeIcon(displayType)}
        </div>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            // 编辑模式
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 resize-none"
                rows={3}
              />
              <div className="flex flex-wrap gap-2">
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-amber-400"
                >
                  {typeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as MarkdownEntry['priority'])}
                  className="px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-amber-400"
                >
                  {priorityOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 disabled:opacity-50"
                >
                  <Check className="w-3 h-3" />
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                  取消
                </button>
              </div>
            </div>
          ) : (
            // 显示模式
            <>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(displayType)}`}>
                  {getTypeLabel(displayType)}
                </span>
                
                {entry.type === 'todo' && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${priorityColors[entry.priority]}`}>
                    {priorityLabels[entry.priority]}
                  </span>
                )}

                {entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {entry.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded">
                    {entry.sourceFile}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {entry.date} {entry.time || ''}
                  </span>
                </div>
              </div>

              <div 
                className={`text-sm text-gray-700 cursor-pointer ${isCompleted ? 'line-through' : ''}`}
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {!isExpanded ? (
                  <p className="line-clamp-2">{entry.content}</p>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-3 -mx-2">
                    <MarkdownPreview content={entry.content} />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-1">
                <div className="flex gap-1">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1 text-gray-400 hover:text-amber-500 transition-colors"
                    title="编辑"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1 text-gray-400 hover:text-amber-500 transition-colors"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 删除确认框 */}
      {showDeleteConfirm && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 mb-2">确定要删除这条记录吗？此操作不可撤销。</p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50"
            >
              {saving ? '删除中...' : '确定删除'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={saving}
              className="px-3 py-1.5 bg-white text-gray-600 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
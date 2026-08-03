import { useState } from 'react';
import { CheckCircle, MessageSquare, BookOpen, Lightbulb, FileText, ChevronDown, ChevronUp, Clock, Tag, Edit2, Trash2, X, Check, Star, Heart, Flag, Bookmark, Bell, Calendar, Mail, Music, Camera, ShoppingCart, CheckSquare, Square } from 'lucide-react';
import { MarkdownEntry, FILE_TYPE_LABELS, QUADRANT_DEFS } from '../types';
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
  urgent: 'Q1 紧急且重要',
  high: 'Q2 重要不紧急',
  medium: 'Q3 紧急不重要',
  low: 'Q4 不紧急不重要',
};

interface EntryItemProps {
  entry: MarkdownEntry;
}

export function EntryItem({ entry }: EntryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editType, setEditType] = useState(entry.categoryId || entry.type);
  const [editPriority, setEditPriority] = useState(entry.priority);
  const [editCompleted, setEditCompleted] = useState(entry.completed || false);
  const [saving, setSaving] = useState(false);
  
  const { updateEntry, deleteEntry, loadEntries } = useSummaryStore();
  const { categories } = useCategories();

  const isCompleted = entry.completed || false;
  const displayType = entry.categoryId || entry.type;

  // v1.18.2: 显示时兜底，label 以 custom_ 开头时从 id 提取真实名称
  const getTypeLabel = (type: string): string => {
    const cat = categories.find(c => c.id === type);
    if (cat) {
      if (cat.label && cat.label.startsWith('custom_')) {
        return cat.id.startsWith('custom_') ? cat.id.slice(7) : cat.label.slice(7);
      }
      return cat.label;
    }
    return FILE_TYPE_LABELS[type] || type;
  };

  const getTypeIcon = (type: string): React.ReactNode => {
    if (defaultTypeIcons[type]) return defaultTypeIcons[type];
    const cat = categories.find(c => c.id === type);
    if (cat) {
      const Icon = ICON_MAP[cat.icon] || MessageSquare;
      return <Icon className="w-4 h-4" />;
    }
    return <MessageSquare className="w-4 h-4" />;
  };

  const getTypeColor = (type: string): string => {
    if (defaultTypeColors[type]) return defaultTypeColors[type];
    const cat = categories.find(c => c.id === type);
    if (cat) return `${cat.color} text-white`;
    return 'bg-gray-100 text-gray-600';
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    
    // 修复：保留原内容，新内容另起一行并标注编辑时的日期时间
    let contentToSave = entry.content;
    if (editContent.trim()) {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      contentToSave = `${entry.content}\n${dateStr} ${timeStr} ${editContent.trim()}`;
    }
    
    const success = await updateEntry(entry.id, {
      content: contentToSave,
      type: editType,
      priority: editPriority as any,
      completed: editCompleted,
    });
    setSaving(false);
    
    if (success) {
      setIsEditing(false);
      setEditContent('');
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
    setEditContent('');
    setEditType(entry.categoryId || entry.type);
    setEditPriority(entry.priority);
    setEditCompleted(entry.completed || false);
    setIsEditing(false);
  };

  // 快速切换完成状态
  const handleToggleComplete = async () => {
    const newCompleted = !entry.completed;
    const success = await updateEntry(entry.id, { completed: newCompleted });
    if (success) {
      await loadEntries();
    } else {
      alert('状态更新失败');
    }
  };

  const typeOptions = categories.map(cat => ({ value: cat.id, label: cat.label }));

  const priorityOptions = [
    { value: 'urgent', label: 'Q1 紧急且重要' },
    { value: 'high', label: 'Q2 重要不紧急' },
    { value: 'medium', label: 'Q3 紧急不重要' },
    { value: 'low', label: 'Q4 不紧急不重要' },
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
            <div className="space-y-3">
              <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2 mb-2 whitespace-pre-wrap">
                <span className="text-xs text-gray-400">原始内容：</span>
                {entry.content}
              </div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 resize-none"
                rows={3}
                placeholder="输入修改或补充内容（将另起一行，自动带上日期时间）..."
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditCompleted(!editCompleted)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg border transition-all ${
                    editCompleted
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}
                >
                  {editCompleted ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  {editCompleted ? '已完成' : '未完成'}
                </button>
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
            <>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(displayType)}`}>
                  {getTypeLabel(displayType)}
                </span>
                
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${priorityColors[entry.priority]}`}>
                  {priorityLabels[entry.priority]}
                </span>

                {isCompleted && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    已完成
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
                    {entry.date || '未记录日期'} {entry.time || ''}
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
                  {/* 完成状态切换 */}
                  <button
                    onClick={handleToggleComplete}
                    className={`p-1 transition-colors ${isCompleted ? 'text-green-500 hover:text-green-600' : 'text-gray-400 hover:text-green-500'}`}
                    title={isCompleted ? '标记为未完成' : '标记为已完成'}
                  >
                    {isCompleted ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => { setEditContent(''); setIsEditing(true); }}
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

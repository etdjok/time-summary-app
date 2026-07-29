import { useState } from 'react';
import { CheckCircle, MessageSquare, BookOpen, Lightbulb, FileText, ChevronDown, ChevronUp, Clock, Tag, Trash2 } from 'lucide-react';
import { MarkdownEntry, FILE_TYPE_LABELS } from '../types';
import { MarkdownPreview } from './MarkdownPreview';

interface EntryItemProps {
  entry: MarkdownEntry;
  onEdit?: (entry: MarkdownEntry) => void;
  onDelete?: (entry: MarkdownEntry) => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  chat: <MessageSquare className="w-4 h-4" />,
  journal: <BookOpen className="w-4 h-4" />,
  todo: <CheckCircle className="w-4 h-4" />,
  idea: <Lightbulb className="w-4 h-4" />,
  note: <FileText className="w-4 h-4" />,
};

const typeColors: Record<string, string> = {
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

export function EntryItem({ entry, onEdit, onDelete }: EntryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isCompleted = entry.type === 'todo' && entry.completed;

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-2 transition-all ${
        isCompleted ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${typeColors[entry.type] || 'bg-gray-100 text-gray-600'}`}>
          {typeIcons[entry.type]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[entry.type] || 'bg-gray-100 text-gray-600'}`}>
              {FILE_TYPE_LABELS[entry.type] || entry.type}
            </span>
            
            {entry.type === 'todo' && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${priorityColors[entry.priority]}`}>
                {priorityLabels[entry.priority]}
              </span>
            )}

            {entry.status && entry.status !== 'in-progress' && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                entry.status === 'completed' ? 'bg-green-100 text-green-700' :
                entry.status === 'incomplete' ? 'bg-red-100 text-red-700' :
                entry.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                'bg-purple-100 text-purple-700'
              }`}>
                {entry.status === 'completed' ? '已完成' : entry.status === 'incomplete' ? '未完成' : entry.status === 'draft' ? '草稿' : '已归档'}
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

          <div className="flex items-center justify-end mt-1 gap-1">
            {onDelete && (
              <button
                onClick={() => { if (confirm('确定要删除这条记录吗？')) onDelete(entry); }}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => onEdit(entry)}
                className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                title="编辑"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/></svg>
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-400 hover:text-amber-500 transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useSummaryStore } from '../hooks/useSummaryStore';
import { MarkdownEntry, FILE_TYPE_LABELS, PRIORITY_LABELS } from '../types';
import { EntryItem } from './EntryItem';

interface QuadrantViewProps {
  onEdit: (entry: MarkdownEntry) => void;
}

export function QuadrantView({ onEdit }: QuadrantViewProps) {
  const { getPeriodEntries } = useSummaryStore();
  const entries = getPeriodEntries();

  const urgent = entries.filter((e) => e.priority === 'urgent');
  const important = entries.filter((e) => e.priority === 'high');
  const normal = entries.filter((e) => e.priority === 'medium');
  const minor = entries.filter((e) => e.priority === 'low');

  const renderQuadrant = (
    title: string,
    subtitle: string,
    badge: string,
    badgeColor: string,
    items: MarkdownEntry[]
  ) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white ${badgeColor}`}>
          {badge}
        </span>
        <span className="font-semibold text-sm text-gray-800">{title}</span>
        <span className="text-xs text-gray-400 ml-auto">{items.length}项</span>
      </div>
      <p className="text-xs text-gray-400 mb-2">{subtitle}</p>
      {items.length === 0 ? (
        <p className="text-xs text-gray-300 text-center py-2">暂无</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {items.map((entry, index) => (
            <div
              key={`${entry.id}-${index}`}
              className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => onEdit(entry)}
            >
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                entry.type === 'todo' ? 'bg-amber-100 text-amber-700' :
                entry.type === 'chat' ? 'bg-blue-100 text-blue-700' :
                entry.type === 'journal' ? 'bg-green-100 text-green-700' :
                entry.type === 'idea' ? 'bg-pink-100 text-pink-700' :
                'bg-purple-100 text-purple-700'
              }`}>
                {FILE_TYPE_LABELS[entry.type] || entry.type}
              </span>
              <span className="text-xs text-gray-700 flex-1 truncate">{entry.content}</span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                entry.status === 'completed' ? 'bg-green-100 text-green-700' :
                entry.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {entry.status ? (entry.status === 'completed' ? '已完成' : entry.status === 'in-progress' ? '进行中' : entry.status === 'incomplete' ? '未完成' : entry.status === 'draft' ? '草稿' : '已归档') : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <span className="text-amber-500">🎯</span> 四象限矩阵
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {renderQuadrant('紧急且重要', '立即执行', 'Q1', 'bg-red-500', urgent)}
        {renderQuadrant('重要不紧急', '计划安排', 'Q2', 'bg-orange-500', important)}
        {renderQuadrant('紧急不重要', '委托减少', 'Q3', 'bg-blue-500', normal)}
        {renderQuadrant('不紧急不重要', '尽量删除', 'Q4', 'bg-gray-400', minor)}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
        <span>↑ 重要</span>
        <span>↓ 不重要</span>
        <span className="ml-4">← 紧急</span>
        <span>不紧急 →</span>
      </div>
    </div>
  );
}

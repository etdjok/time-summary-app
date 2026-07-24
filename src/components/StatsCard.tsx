import { BarChart3, CheckCircle, FileText, Lightbulb, BookOpen, MessageSquare } from 'lucide-react';
import { useSummaryStore } from '../hooks/useSummaryStore';
import { FILE_TYPE_LABELS } from '../types';

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

export function StatsCard() {
  const { getStats } = useSummaryStore();
  const stats = getStats();

  const typeEntries = Object.entries(stats.byType).filter(([, count]) => count > 0);

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-amber-500" />
        <h3 className="font-semibold text-gray-800">统计概览</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-amber-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.total}</p>
          <p className="text-xs text-amber-600/70">总记录</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          <p className="text-xs text-green-600/70">已完成待办</p>
        </div>
      </div>

      {typeEntries.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">按类型分布</p>
          {typeEntries.map(([type, count]) => (
            <div key={type} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${typeColors[type] || 'bg-gray-100 text-gray-600'}`}>
                {typeIcons[type]}
              </div>
              <span className="text-sm text-gray-700 flex-1">
                {FILE_TYPE_LABELS[type] || type}
              </span>
              <span className="text-sm font-medium text-gray-900">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
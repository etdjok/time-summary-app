import { BarChart3, CheckCircle, FileText, Lightbulb, BookOpen, MessageSquare, Star, Heart, Flag, Tag, Bookmark, Bell, Calendar, Mail, Music, Camera, ShoppingCart } from 'lucide-react';
import { useSummaryStore } from '../hooks/useSummaryStore';
import { useCategories } from '../hooks/useCategories';
import { FILE_TYPE_LABELS } from '../types';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare, CheckCircle, Lightbulb, BookOpen, FileText,
  Star, Heart, Flag, Tag, Bookmark, Bell, Calendar, Mail, Music, Camera, ShoppingCart,
};

const typeColors: Record<string, string> = {
  chat: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  journal: 'bg-green-100 text-green-700 hover:bg-green-200',
  todo: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  idea: 'bg-pink-100 text-pink-700 hover:bg-pink-200',
  note: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
};

const defaultIcons: Record<string, React.ReactNode> = {
  chat: <MessageSquare className="w-4 h-4" />,
  journal: <BookOpen className="w-4 h-4" />,
  todo: <CheckCircle className="w-4 h-4" />,
  idea: <Lightbulb className="w-4 h-4" />,
  note: <FileText className="w-4 h-4" />,
};

interface StatsCardProps {
  onTypeClick?: (type: string) => void;
}

export function StatsCard({ onTypeClick }: StatsCardProps) {
  const { getStats } = useSummaryStore();
  const { categories } = useCategories();
  const stats = getStats();

  // 显示所有类型，即使count=0
  const typeEntries = Object.entries(stats.byType);

  // v1.18.2: 获取分类标签，带 custom_ 兜底
  const getCategoryLabel = (type: string): string => {
    const cat = categories.find(c => c.id === type);
    if (cat) {
      if (cat.label && cat.label.startsWith('custom_')) {
        return cat.id.startsWith('custom_') ? cat.id.slice(7) : cat.label.slice(7);
      }
      return cat.label;
    }
    return FILE_TYPE_LABELS[type] || type;
  };

  // 获取分类图标
  const getCategoryIcon = (type: string): React.ReactNode => {
    if (defaultIcons[type]) return defaultIcons[type];
    const cat = categories.find(c => c.id === type);
    if (cat) {
      const Icon = ICON_MAP[cat.icon] || MessageSquare;
      return <Icon className="w-4 h-4" />;
    }
    return <MessageSquare className="w-4 h-4" />;
  };

  // 获取分类颜色
  const getCategoryColor = (type: string): string => {
    if (typeColors[type]) return typeColors[type];
    const cat = categories.find(c => c.id === type);
    if (cat) {
      return `${cat.color} text-white hover:opacity-80`;
    }
    return 'bg-gray-100 text-gray-600';
  };

  const handleTypeClick = (type: string) => {
    if (onTypeClick) {
      onTypeClick(type);
    }
  };

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
          <p className="text-xs font-medium text-gray-500">按类型分布（点击可筛选）</p>
          {typeEntries.map(([type, count]) => (
            <button
              key={type}
              onClick={() => handleTypeClick(type)}
              className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${getCategoryColor(type)} transition-colors`}>
                {getCategoryIcon(type)}
              </div>
              <span className="text-sm text-gray-700 flex-1">
                {getCategoryLabel(type)}
              </span>
              <span className="text-sm font-medium text-gray-900">{count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
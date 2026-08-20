import { useState, useEffect, useMemo } from 'react';
import { List, Filter, RefreshCw, Search, X, MessageSquare, BookOpen, CheckCircle, Lightbulb, FileText, Star, Heart, Flag, Tag, Bookmark, Bell, Calendar, Mail, Music, Camera, ShoppingCart } from 'lucide-react';
import { useSummaryStore } from '../hooks/useSummaryStore';
import { useCategories } from '../hooks/useCategories';
import { EntryItem } from './EntryItem';
import { FILE_TYPE_LABELS } from '../types';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare, CheckCircle, Lightbulb, BookOpen, FileText,
  Star, Heart, Flag, Tag, Bookmark, Bell, Calendar, Mail, Music, Camera, ShoppingCart,
};

interface SummaryListProps {
  initialTypeFilter?: string;
}

export function SummaryList({ initialTypeFilter = 'all' }: SummaryListProps) {
  const { getPeriodEntries, loadEntries, loading, entries: allEntries } = useSummaryStore();
  const { categories } = useCategories();
  const [typeFilter, setTypeFilter] = useState<string>(initialTypeFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'period' | 'all'>('period');

  // Sync with external filter changes
  useEffect(() => {
    setTypeFilter(initialTypeFilter);
  }, [initialTypeFilter]);

  const entries = getPeriodEntries();

  const typeFilters = [
    { value: 'all', label: '全部', icon: List },
    ...categories.map(cat => ({
      value: cat.id,
      label: cat.label,
      icon: ICON_MAP[cat.icon] || MessageSquare,
    })),
  ];

  const typeFilteredEntries = typeFilter === 'all'
    ? entries
    : entries.filter(e => e.type === typeFilter || e.categoryId === typeFilter);

  const hasSearch = searchQuery.trim() !== '';
  const isGlobalSearch = hasSearch && searchScope === 'all';

  // 搜索词清空时重置范围，避免下次输入静默全局搜索
  useEffect(() => {
    if (!searchQuery.trim() && searchScope !== 'period') setSearchScope('period');
  }, [searchQuery, searchScope]);

  const lowerQuery = searchQuery.trim().toLowerCase();

  // 全局搜索时忽略周期，在全量数据上检索（类型过滤仍然生效）
  const filteredEntries = useMemo(() => {
    if (!hasSearch) return typeFilteredEntries;
    const source = isGlobalSearch
      ? (typeFilter === 'all'
          ? allEntries
          : allEntries.filter(e => e.type === typeFilter || e.categoryId === typeFilter))
      : typeFilteredEntries;
    return source.filter(e =>
      e.content.toLowerCase().includes(lowerQuery) ||
      e.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [hasSearch, isGlobalSearch, typeFilter, typeFilteredEntries, allEntries, lowerQuery]);

  // 全局搜索结果按日期倒序、组内按时间倒序，并按日期分组展示
  const groupedEntries = useMemo(() => {
    if (!isGlobalSearch) return null;
    return Object.entries(
      filteredEntries.reduce<Record<string, typeof filteredEntries>>((groups, e) => {
        const key = e.date || '未知日期';
        (groups[key] = groups[key] || []).push(e);
        return groups;
      }, {})
    )
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, list]) => [
        date,
        [...list].sort((a, b) => (b.time || '').localeCompare(a.time || '')),
      ] as [string, typeof filteredEntries]);
  }, [isGlobalSearch, filteredEntries]);

  const getTypeLabel = (type: string): string => {
    // 先修正 custom_ 前缀
    const cleanType = type && type.startsWith('custom_') ? type.slice(7) : type;
    const cat = categories.find(c => c.id === type);
    if (cat) {
      if (cat.label && cat.label.startsWith('custom_')) {
        return cat.id.startsWith('custom_') ? cat.id.slice(7) : cat.label.slice(7);
      }
      return cat.label;
    }
    // 找不到分类时，也从 id 中提取真实名称
    if (type && type.startsWith('custom_')) {
      return type.slice(7);
    }
    return FILE_TYPE_LABELS[type] || cleanType;
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-gray-800">内容汇总</h3>
          <span className="text-xs text-gray-400">({filteredEntries.length}条)</span>
        </div>
        <button
          onClick={() => loadEntries()}
          disabled={loading}
          className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
          title="刷新"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索内容或标签..."
          className="w-full pl-9 pr-9 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 搜索范围开关：仅在有搜索词时显示 */}
      {hasSearch && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-400">范围</span>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setSearchScope('period')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                searchScope === 'period' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              当前周期
            </button>
            <button
              onClick={() => setSearchScope('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                searchScope === 'all' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              全部历史
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {typeFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setTypeFilter(filter.value)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
              typeFilter === filter.value
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <filter.icon className="w-3.5 h-3.5" />
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <RefreshCw className="w-8 h-8 mb-3 animate-spin text-amber-400" />
          <p className="text-sm">正在加载...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <List className="w-12 h-12 mb-3 text-gray-300" />
          <p className="text-base">暂无内容</p>
          <p className="text-sm mt-1 text-gray-300">
            {hasSearch
              ? '没有匹配的记录'
              : typeFilter === 'all'
                ? '这个周期还没有记录'
                : `没有${getTypeLabel(typeFilter)}类型的记录`}
          </p>
        </div>
      ) : isGlobalSearch && groupedEntries ? (
        // 全局搜索：按日期分组展示
        <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
          {groupedEntries.map(([date, list]) => (
            <div key={date} className="mb-2">
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm py-1.5 px-2 text-xs font-semibold text-gray-500 border-b border-gray-100">
                {date}
                <span className="ml-1 text-gray-300 font-normal">({list.length}条)</span>
              </div>
              {list.map((entry, index) => (
                <EntryItem key={`${entry.id}-${index}`} entry={entry} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
          {filteredEntries.map((entry, index) => (
            <EntryItem key={`${entry.id}-${index}`} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

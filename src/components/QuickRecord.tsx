import { useState } from 'react';
import { Send, MessageSquare, CheckCircle, Lightbulb, BookOpen, FileText, Star, Heart, Flag, Tag, Bookmark, Bell, Calendar, Mail, Music, Camera, ShoppingCart, Grid3x3, AlertTriangle, Target, Clock, MinusCircle } from 'lucide-react';
import { useSummaryStore } from '../hooks/useSummaryStore';
import { useCategories } from '../hooks/useCategories';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare, CheckCircle, Lightbulb, BookOpen, FileText,
  Star, Heart, Flag, Tag, Bookmark, Bell, Calendar, Mail, Music, Camera, ShoppingCart,
};

const quadrants = [
  { id: 'urgent', label: '紧急且重要', icon: AlertTriangle, color: 'bg-red-500', activeColor: 'bg-red-100 text-red-700 border-red-300' },
  { id: 'high', label: '重要不紧急', icon: Target, color: 'bg-orange-500', activeColor: 'bg-orange-100 text-orange-700 border-orange-300' },
  { id: 'medium', label: '紧急不重要', icon: Clock, color: 'bg-amber-500', activeColor: 'bg-amber-100 text-amber-700 border-amber-300' },
  { id: 'low', label: '不紧急不重要', icon: MinusCircle, color: 'bg-gray-500', activeColor: 'bg-gray-100 text-gray-700 border-gray-300' },
] as const;

export function QuickRecord() {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [showQuadrants, setShowQuadrants] = useState(false);
  const { addEntry, loadEntries } = useSummaryStore();
  const { categories } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id || 'chat');

  const activeCategory = categories.find((c) => c.id === selectedCategory) || categories[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !activeCategory) return;

    setIsSaving(true);

    try {
      const priority = selectedPriority as 'urgent' | 'high' | 'medium' | 'low' | undefined;
      const success = await addEntry(content.trim(), activeCategory.target, activeCategory.id, priority);
      if (success) {
        setContent('');
        setSelectedPriority(null);
        setShowQuadrants(false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        loadEntries();
      }
    } catch {
      // handle error in addEntry
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4 mb-4">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-amber-500" />
        快速记录
      </h3>

      <form onSubmit={handleSubmit}>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {categories.map((option) => {
            const Icon = ICON_MAP[option.icon] || MessageSquare;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedCategory(option.id)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                  selectedCategory === option.id
                    ? `${option.color} text-white`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>

        {/* 四象限选择 */}
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowQuadrants(!showQuadrants)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all border ${
              showQuadrants || selectedPriority
                ? 'bg-amber-100 text-amber-700 border-amber-300'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <Grid3x3 className="w-3.5 h-3.5" />
            {selectedPriority
              ? quadrants.find(q => q.id === selectedPriority)?.label
              : '选择象限（可选）'}
          </button>

          {showQuadrants && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quadrants.map((q) => {
                const Icon = q.icon;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setSelectedPriority(selectedPriority === q.id ? null : q.id);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                      selectedPriority === q.id
                        ? q.activeColor
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {q.label}
                  </button>
                );
              })}
              {selectedPriority && (
                <button
                  type="button"
                  onClick={() => setSelectedPriority(null)}
                  className="px-2.5 py-1 text-xs text-gray-400 hover:text-gray-600"
                >
                  清除
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={activeCategory?.target === 'todo' ? '添加待办事项...' : '记录想法、笔记...'}
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
            disabled={isSaving}
            autoFocus
          />
          <button
            type="submit"
            disabled={!content.trim() || isSaving}
            className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
              content.trim() && !isSaving
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>

      {showSuccess && (
        <div className="mt-3 flex items-center gap-2 text-green-600 text-sm bg-green-50 px-3 py-2 rounded-lg">
          <CheckCircle className="w-4 h-4" />
          记录已保存到坚果云
        </div>
      )}
    </div>
  );
}
import { useState } from 'react';
import { Send, MessageSquare, CheckCircle, Lightbulb, BookOpen, FileText, Star, Heart, Flag, Tag, Bookmark, Bell, Calendar, Mail, Music, Camera, ShoppingCart } from 'lucide-react';
import { useSummaryStore } from '../hooks/useSummaryStore';
import { useCategories } from '../hooks/useCategories';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare, CheckCircle, Lightbulb, BookOpen, FileText,
  Star, Heart, Flag, Tag, Bookmark, Bell, Calendar, Mail, Music, Camera, ShoppingCart,
};

export function QuickRecord() {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { addEntry, loadEntries } = useSummaryStore();
  const { categories } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id || 'chat');

  const activeCategory = categories.find((c) => c.id === selectedCategory) || categories[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !activeCategory) return;

    setIsSaving(true);

    try {
      const success = await addEntry(content.trim(), activeCategory.target, activeCategory.id);
      if (success) {
        setContent('');
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

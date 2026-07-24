import { useState } from 'react';
import { X, Plus, Trash2, MessageSquare, CheckCircle, Lightbulb, BookOpen, FileText, Star, Heart, Flag, Tag, Bookmark, Bell, Calendar, Mail, Music, Camera, ShoppingCart } from 'lucide-react';
import { useCategories } from '../hooks/useCategories';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare, CheckCircle, Lightbulb, BookOpen, FileText,
  Star, Heart, Flag, Tag, Bookmark, Bell, Calendar, Mail, Music, Camera, ShoppingCart,
};

interface CategoryManagerProps {
  onClose: () => void;
}

export function CategoryManager({ onClose }: CategoryManagerProps) {
  const {
    categories,
    addCategory,
    removeCategory,
    resetCategories,
    colorOptions,
    iconOptions,
    targetOptions,
  } = useCategories();

  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('Star');
  const [newColor, setNewColor] = useState('bg-blue-500');
  const [newTarget, setNewTarget] = useState<'chat' | 'todo' | 'journal'>('chat');

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    addCategory({
      label: newLabel.trim(),
      icon: newIcon,
      color: newColor,
      target: newTarget,
    });
    setNewLabel('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-800">分类管理</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* 现有分类列表 */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">当前分类</p>
            {categories.map((cat) => {
              const Icon = ICON_MAP[cat.icon] || MessageSquare;
              return (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl"
                >
                  <div className={`w-8 h-8 ${cat.color} rounded-lg flex items-center justify-center text-white`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{cat.label}</p>
                    <p className="text-xs text-gray-400">
                      {targetOptions.find((t) => t.value === cat.target)?.label}
                    </p>
                  </div>
                  <button
                    onClick={() => removeCategory(cat.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* 添加新分类 */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">添加分类</p>
            <div className="space-y-3">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="分类名称，如：阅读、运动"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400"
              />

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400"
                >
                  {iconOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400"
                >
                  {colorOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <select
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value as 'chat' | 'todo' | 'journal')}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400"
              >
                {targetOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              <button
                onClick={handleAdd}
                disabled={!newLabel.trim()}
                className="w-full px-4 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                <Plus className="w-4 h-4" />
                添加分类
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={resetCategories}
            className="w-full px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors font-medium text-sm"
          >
            恢复默认分类
          </button>
        </div>
      </div>
    </div>
  );
}

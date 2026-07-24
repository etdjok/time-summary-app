import { useState, useEffect, useCallback } from 'react';

const CATEGORIES_KEY = 'heartlight_categories';

export interface Category {
  id: string;
  label: string;
  icon: string;
  color: string;
  target: 'chat' | 'todo' | 'journal';
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'chat', label: '收集', icon: 'MessageSquare', color: 'bg-blue-500', target: 'chat' },
  { id: 'todo', label: '待办', icon: 'CheckCircle', color: 'bg-amber-500', target: 'todo' },
  { id: 'idea', label: '想法', icon: 'Lightbulb', color: 'bg-pink-500', target: 'chat' },
  { id: 'journal', label: '日记', icon: 'BookOpen', color: 'bg-green-500', target: 'journal' },
  { id: 'note', label: '笔记', icon: 'FileText', color: 'bg-purple-500', target: 'chat' },
];

const COLOR_OPTIONS = [
  { label: '蓝色', value: 'bg-blue-500' },
  { label: '琥珀', value: 'bg-amber-500' },
  { label: '粉色', value: 'bg-pink-500' },
  { label: '绿色', value: 'bg-green-500' },
  { label: '紫色', value: 'bg-purple-500' },
  { label: '红色', value: 'bg-red-500' },
  { label: '青色', value: 'bg-cyan-500' },
  { label: '橙色', value: 'bg-orange-500' },
  { label: '靛蓝', value: 'bg-indigo-500' },
  { label: '玫红', value: 'bg-rose-500' },
];

const ICON_OPTIONS = [
  { label: '消息', value: 'MessageSquare' },
  { label: '勾选', value: 'CheckCircle' },
  { label: '灯泡', value: 'Lightbulb' },
  { label: '书本', value: 'BookOpen' },
  { label: '文件', value: 'FileText' },
  { label: '星星', value: 'Star' },
  { label: '心形', value: 'Heart' },
  { label: '旗帜', value: 'Flag' },
  { label: '标签', value: 'Tag' },
  { label: '书签', value: 'Bookmark' },
  { label: '铃铛', value: 'Bell' },
  { label: '日历', value: 'Calendar' },
  { label: '邮件', value: 'Mail' },
  { label: '音乐', value: 'Music' },
  { label: '相机', value: 'Camera' },
  { label: '购物车', value: 'ShoppingCart' },
];

const TARGET_OPTIONS = [
  { label: '收集箱 (Chat.md)', value: 'chat' },
  { label: '待办 (Later.md)', value: 'todo' },
  { label: '日记 (journal)', value: 'journal' },
];

function loadCategories(): Category[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [...DEFAULT_CATEGORIES];
}

function saveCategories(categories: Category[]) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(loadCategories);

  useEffect(() => {
    saveCategories(categories);
  }, [categories]);

  const addCategory = useCallback((category: Omit<Category, 'id'>) => {
    const id = `custom_${Date.now()}`;
    setCategories((prev) => [...prev, { ...category, id }]);
  }, []);

  const removeCategory = useCallback((id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateCategory = useCallback((id: string, updates: Partial<Omit<Category, 'id'>>) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }, []);

  const resetCategories = useCallback(() => {
    setCategories([...DEFAULT_CATEGORIES]);
  }, []);

  return {
    categories,
    addCategory,
    removeCategory,
    updateCategory,
    resetCategories,
    colorOptions: COLOR_OPTIONS,
    iconOptions: ICON_OPTIONS,
    targetOptions: TARGET_OPTIONS,
  };
}

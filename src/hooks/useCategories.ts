import { create } from 'zustand';
import { getCredentialsAsync } from '../lib/nutstore';
import { maybeEncrypt, maybeDecrypt } from '../lib/crypto';
import { apiFetch } from '../lib/auth';

const CATEGORIES_KEY = 'heartlight_categories';

export interface Category {
  id: string;
  label: string;
  icon: string;
  color: string;
  target: string;
}

// v1.18: 分类配置同步到坚果云
const REMOTE_CATEGORIES_FILE = '_categories.json';
let _syncInProgress = false;

async function syncCategoriesToNutstore(categories: Category[]): Promise<void> {
  if (_syncInProgress) return;
  try {
    _syncInProgress = true;
    const creds = await getCredentialsAsync();
    if (!creds) return;
    const basePath = (localStorage.getItem('nutstore_base_path') || '').trim() || '/我的坚果云/笔记';
    const filePath = `${basePath}/${REMOTE_CATEGORIES_FILE}`;
    const response = await apiFetch('/api/nutstore/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: creds.username,
        password: creds.password,
        filePath,
        content: await maybeEncrypt(JSON.stringify(categories, null, 2)),
      }),
    });
    if (!response.ok) {
      console.warn('[categories] 同步到坚果云失败:', response.status);
    }
  } catch (e) {
    console.warn('[categories] 同步异常:', e);
  } finally {
    _syncInProgress = false;
  }
}

export async function loadCategoriesFromNutstore(): Promise<Category[] | null> {
  try {
    const creds = await getCredentialsAsync();
    if (!creds) return null;
    const basePath = (localStorage.getItem('nutstore_base_path') || '').trim() || '/我的坚果云/笔记';
    const filePath = `${basePath}/${REMOTE_CATEGORIES_FILE}`;
    const response = await apiFetch('/api/nutstore/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password, filePath }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.content) return null;
    const decrypted = await maybeDecrypt(data.content);
    if (decrypted === null) return null;
    const parsed = JSON.parse(decrypted);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    console.warn('[categories] 从坚果云加载失败:', e);
    return null;
  }
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'chat', label: '收集', icon: 'MessageSquare', color: 'bg-blue-500', target: 'chat' },
  { id: 'todo', label: '待办', icon: 'CheckCircle', color: 'bg-amber-500', target: 'todo' },
  { id: 'idea', label: '想法', icon: 'Lightbulb', color: 'bg-pink-500', target: 'idea' },
  { id: 'journal', label: '日记', icon: 'BookOpen', color: 'bg-green-500', target: 'journal' },
  { id: 'note', label: '笔记', icon: 'FileText', color: 'bg-purple-500', target: 'note' },
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
  { label: '想法 (Idea.md)', value: 'idea' },
  { label: '笔记 (Note.md)', value: 'note' },
];

function loadCategories(): Category[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const migrated = parsed.map((cat: Category) => {
        if (cat.id === 'idea' && cat.target === 'chat') return { ...cat, target: 'idea' as const };
        if (cat.id === 'note' && cat.target === 'chat') return { ...cat, target: 'note' as const };
        return cat;
      });
      // v1.18.2: 自动修正 label 为 custom_xxx 的条目，从 id 提取真实名称
      migrated.forEach((c: Category) => {
        if (c.label && c.label.startsWith('custom_')) {
          c.label = c.id.startsWith('custom_') ? c.id.slice(7) : c.label.slice(7);
        }
      });
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    // ignore
  }
  return [...DEFAULT_CATEGORIES];
}

function saveCategories(categories: Category[]) {
  // v1.18.2: 写入前自动修正 label，从 id 提取真实名称
  const fixed = categories.map((c: Category) => {
    if (c.label && c.label.startsWith('custom_')) {
      return { ...c, label: c.id.startsWith('custom_') ? c.id.slice(7) : c.label.slice(7) };
    }
    return c;
  });
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(fixed));
  // 同步到坚果云（异步，不阻塞）
  syncCategoriesToNutstore(fixed);
}

interface CategoryStore {
  categories: Category[];
  addCategory: (category: Omit<Category, 'id'>) => void;
  removeCategory: (id: string) => void;
  updateCategory: (id: string, updates: Partial<Omit<Category, 'id'>>) => void;
  resetCategories: () => void;
}

export const useCategories = create<CategoryStore>()((set) => {
  const initial = loadCategories();
  saveCategories(initial);

  return {
    categories: initial,

    addCategory: (category) => {
      // v1.18: id 用 target（稳定标识），跨设备可识别
      const target = category.target || category.label;
      const id = `custom_${target}`;
      // 立即修正 label，移除可能的 custom_ 前缀
      const fixedLabel = (category.label && category.label.startsWith('custom_'))
        ? id.slice(7)
        : category.label;
      set((state) => {
        // 避免 id 重复
        if (state.categories.some((c) => c.id === id)) {
          return state;
        }
        const updated = [...state.categories, { ...category, label: fixedLabel, id, target }];
        saveCategories(updated);
        return { categories: updated };
      });
    },

    removeCategory: (id) => {
      set((state) => {
        const updated = state.categories.filter((c) => c.id !== id);
        saveCategories(updated);
        return { categories: updated };
      });
    },

    updateCategory: (id, updates) => {
      set((state) => {
        const updated = state.categories.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        );
        saveCategories(updated);
        return { categories: updated };
      });
    },

    resetCategories: () => {
      const defaults = [...DEFAULT_CATEGORIES];
      saveCategories(defaults);
      set({ categories: defaults });
    },
  };
});

// v1.18: 异步从坚果云加载分类配置并合并到本地
export async function syncCategoriesFromNutstore(): Promise<void> {
  try {
    const remote = await loadCategoriesFromNutstore();
    if (!remote || remote.length === 0) return;

    const localRaw = localStorage.getItem(CATEGORIES_KEY);
    let local: Category[] = [...DEFAULT_CATEGORIES];
    if (localRaw) {
      try {
        local = JSON.parse(localRaw);
      } catch { /* ignore */ }
    }

    // 合并：以 id 去重，远程分类优先
    const localById = new Map(local.map((c) => [c.id, c]));
    for (const r of remote) {
      if (!localById.has(r.id)) {
        local.push(r);
      } else {
        const idx = local.findIndex((c) => c.id === r.id);
        if (idx >= 0) local[idx] = r;
      }
    }
    // v1.18.2: 自动修正 label 为 custom_xxx 的条目，从 id 提取真实名称
    local.forEach((c: Category) => {
      if (c.label && c.label.startsWith('custom_')) {
        c.label = c.id.startsWith('custom_') ? c.id.slice(7) : c.label.slice(7);
      }
    });
    // 把修正后的写回坚果云，彻底修复历史数据
    try {
      const creds = await getCredentialsAsync();
      if (creds) {
        const bp = (localStorage.getItem('nutstore_base_path') || '').trim() || '/我的坚果云/笔记';
        fetch('/api/nutstore/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: creds.username, password: creds.password,
            filePath: `${bp}/_categories.json`,
            content: await maybeEncrypt(JSON.stringify(local, null, 2)),
          }),
        });
      }
    } catch { /* ignore */ }
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(local));
    useCategories.setState({ categories: local });
    console.log(`[categories] 已从坚果云同步 ${remote.length} 个分类，本地共 ${local.length} 个`);
  } catch (e) {
    console.warn('[categories] 从坚果云同步合并失败:', e);
  }
}

export { COLOR_OPTIONS, ICON_OPTIONS, TARGET_OPTIONS };

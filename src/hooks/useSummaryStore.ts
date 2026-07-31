import { create } from 'zustand';
import { MarkdownEntry, Period, PeriodType } from '../types';
import { getPeriodForDate } from '../lib/dateUtils';
import { fetchFilesMdEntries, appendToChatMd, appendToTodoMd, appendToJournalMd, deleteFile, readFile, writeFile } from '../lib/nutstore';

interface SummaryStore {
  entries: MarkdownEntry[];
  currentPeriod: Period;
  periodType: PeriodType;
  loading: boolean;
  error: string | null;
  nutstoreBasePath: string;
  
  setPeriodType: (type: PeriodType) => void;
  setCurrentPeriod: (period: Period) => void;
  goToToday: () => void;
  goToNextPeriod: () => void;
  goToPrevPeriod: () => void;
  
  loadEntries: () => Promise<void>;
  setNutstoreBasePath: (path: string) => void;
  addEntry: (content: string, type: string, categoryId?: string) => Promise<boolean>;
  updateEntry: (entryId: string, updates: Partial<MarkdownEntry>) => Promise<boolean>;
  deleteEntry: (entryId: string) => Promise<boolean>;
  editEntry: (entryId: string, newContent: string) => Promise<boolean>;
  
  getPeriodEntries: () => MarkdownEntry[];
  getStats: () => { 
    total: number; 
    byType: Record<string, number>;
    byPriority: Record<string, number>;
    completed: number;
  };
}

export const useSummaryStore = create<SummaryStore>()((set, get) => ({
  entries: [],
  currentPeriod: getPeriodForDate(new Date(), 'week'),
  periodType: 'week',
  loading: false,
  error: null,
  nutstoreBasePath: '/我的坚果云/笔记',

  setPeriodType: (type: PeriodType) => {
    const newPeriod = getPeriodForDate(new Date(), type);
    set({ periodType: type, currentPeriod: newPeriod });
  },

  setCurrentPeriod: (period: Period) => {
    set({ currentPeriod: period });
  },

  goToToday: () => {
    const newPeriod = getPeriodForDate(new Date(), get().periodType);
    set({ currentPeriod: newPeriod });
  },

  goToNextPeriod: () => {
    const { currentPeriod } = get();
    const type = currentPeriod.type;
    const startDate = new Date(currentPeriod.startDate);
    
    let nextDate: Date;
    switch (type) {
      case 'day':
        nextDate = new Date(startDate.getTime() + 86400000);
        break;
      case 'week':
        nextDate = new Date(startDate.getTime() + 604800000);
        break;
      case 'month':
        nextDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
        break;
      case 'quarter':
        nextDate = new Date(startDate.getFullYear(), startDate.getMonth() + 3, 1);
        break;
      case 'half-year':
        nextDate = new Date(startDate.getFullYear(), startDate.getMonth() + 6, 1);
        break;
      case 'year':
        nextDate = new Date(startDate.getFullYear() + 1, 0, 1);
        break;
      default:
        nextDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
    }
    
    const newPeriod = getPeriodForDate(nextDate, type);
    set({ currentPeriod: newPeriod });
  },

  goToPrevPeriod: () => {
    const { currentPeriod } = get();
    const type = currentPeriod.type;
    const startDate = new Date(currentPeriod.startDate);
    
    let prevDate: Date;
    switch (type) {
      case 'day':
        prevDate = new Date(startDate.getTime() - 86400000);
        break;
      case 'week':
        prevDate = new Date(startDate.getTime() - 604800000);
        break;
      case 'month':
        prevDate = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
        break;
      case 'quarter':
        prevDate = new Date(startDate.getFullYear(), startDate.getMonth() - 3, 1);
        break;
      case 'half-year':
        prevDate = new Date(startDate.getFullYear(), startDate.getMonth() - 6, 1);
        break;
      case 'year':
        prevDate = new Date(startDate.getFullYear() - 1, 0, 1);
        break;
      default:
        prevDate = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
    }
    
    const newPeriod = getPeriodForDate(prevDate, type);
    set({ currentPeriod: newPeriod });
  },

  loadEntries: async () => {
    set({ loading: true, error: null });
    try {
      const entries = await fetchFilesMdEntries(get().nutstoreBasePath);
      set({ entries, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : '读取失败';
      set({ loading: false, error: message });
    }
  },

  setNutstoreBasePath: (path: string) => {
    set({ nutstoreBasePath: path });
  },

  addEntry: async (content: string, target: 'chat' | 'todo' | 'journal', categoryId?: string, priority?: 'urgent' | 'high' | 'medium' | 'low'): Promise<boolean> => {
    const basePath = get().nutstoreBasePath;
    let success = false;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 只要提供了 categoryId，就在内容中嵌入 @cat:xxx 标记，确保解析时能还原分类
    const catMarker = categoryId ? `@cat:${categoryId} ` : '';
    // 优先级标记（用于四象限分类）
    const priorityMarker = priority ? ` #${priority}` : '';
    let formattedContent = `${timeStr} ${catMarker}${content}${priorityMarker}`;

    if (target === 'todo') {
      formattedContent = `- [ ] ${formattedContent}`;
    }

    switch (target) {
      case 'todo':
        success = await appendToTodoMd(basePath, formattedContent);
        break;
      case 'journal':
        success = await appendToJournalMd(basePath, formattedContent);
        break;
      case 'chat':
      default:
        success = await appendToChatMd(basePath, formattedContent);
        break;
    }

    return success;
  },

  updateEntry: async (entryId: string, updates: Partial<MarkdownEntry>): Promise<boolean> => {
    const { entries, nutstoreBasePath } = get();
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return false;

    const sourceFile = entry.sourceFile;
    const filePath = sourceFile.startsWith('/') 
      ? `${nutstoreBasePath}/${sourceFile}` 
      : `${nutstoreBasePath}/${sourceFile}`;

    // 读取原文件内容
    const readResult = await readFile(filePath);
    if (!readResult.success || !readResult.content) return false;

    // 确定最终分类标记：优先使用显式更新的 type，否则保留原 categoryId/type
    const displayType = updates.type || entry.categoryId || entry.type;
    const categoryMarker = displayType ? `@cat:${displayType} ` : '';

    const lines = readResult.content.split('\n');
    const updatedLines: string[] = [];
    
    for (const line of lines) {
      // 匹配当前条目（通过时间和内容匹配）
      const timeMatch = line.match(/^(\d{2}:\d{2})\s+(.+)$/);
      const todoMatch = line.match(/^- \[([ x])\]\s+(\d{2}:\d{2})\s+(.+)$/);
      
      let isTargetLine = false;
      let newLine = line;
      
      if (todoMatch) {
        const [, check, time, content] = todoMatch;
        if (time === entry.time && content.includes(entry.content.substring(0, 20))) {
          isTargetLine = true;
          const newContent = updates.content || entry.content;
          const newPriority = updates.priority || entry.priority;
          const completed = updates.completed ?? entry.completed;
          const checkMark = completed ? 'x' : ' ';
          newLine = `- [${checkMark}] ${time} ${categoryMarker}${newContent} #${newPriority}`;
        }
      } else if (timeMatch) {
        const [, time, content] = timeMatch;
        if (time === entry.time && content.includes(entry.content.substring(0, 20))) {
          isTargetLine = true;
          const newContent = updates.content || entry.content;
          const newPriority = updates.priority || entry.priority;
          newLine = `${time} ${categoryMarker}${newContent} #${newPriority}`;
        }
      }
      
      updatedLines.push(newLine);
    }

    const newContent = updatedLines.join('\n');
    const writeResult = await writeFile(filePath, newContent);
    
    if (writeResult.success) {
      // 更新本地状态（同步 categoryId，确保后续渲染使用正确的分类）
      set({
        entries: entries.map(e => 
          e.id === entryId ? { ...e, ...updates, categoryId: displayType } : e
        )
      });
      return true;
    }
    
    return false;
  },

  deleteEntry: async (entryId: string): Promise<boolean> => {
    const { entries, nutstoreBasePath } = get();
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return false;

    const sourceFile = entry.sourceFile;
    const filePath = sourceFile.startsWith('/') 
      ? `${nutstoreBasePath}/${sourceFile}` 
      : `${nutstoreBasePath}/${sourceFile}`;

    // 读取原文件内容
    const readResult = await readFile(filePath);
    if (!readResult.success || !readResult.content) return false;

    const lines = readResult.content.split('\n');
    const updatedLines: string[] = [];
    
    for (const line of lines) {
      // 匹配当前条目（通过时间和内容匹配）
      const timeMatch = line.match(/^(\d{2}:\d{2})\s+(.+)$/);
      const todoMatch = line.match(/^- \[([ x])\]\s+(\d{2}:\d{2})\s+(.+)$/);
      
      let isTargetLine = false;
      
      if (todoMatch) {
        const [, , time, content] = todoMatch;
        if (time === entry.time && content.includes(entry.content.substring(0, 20))) {
          isTargetLine = true;
        }
      } else if (timeMatch) {
        const [, time, content] = timeMatch;
        if (time === entry.time && content.includes(entry.content.substring(0, 20))) {
          isTargetLine = true;
        }
      }
      
      if (!isTargetLine && line.trim()) {
        updatedLines.push(line);
      }
    }

    const newContent = updatedLines.join('\n');
    const writeResult = await writeFile(filePath, newContent);
    
    if (writeResult.success) {
      // 更新本地状态
      set({
        entries: entries.filter(e => e.id !== entryId)
      });
      return true;
    }
    
    return false;
  },

  editEntry: async (entryId: string, newContent: string): Promise<boolean> => {
    return get().updateEntry(entryId, { content: newContent });
  },

  getPeriodEntries: () => {
    const { entries, currentPeriod } = get();
    const start = new Date(currentPeriod.startDate);
    const end = new Date(currentPeriod.endDate);
    end.setHours(23, 59, 59, 999);
    
    const today = new Date().toISOString().split('T')[0];
    
    return entries
      .filter((entry) => {
        // 对于没有日期的条目（历史数据），默认归到今天
        const dateStr = entry.date || today;
        const entryDate = new Date(dateStr);
        return entryDate >= start && entryDate <= end;
      })
      .sort((a, b) => {
        const dateA = new Date(`${a.date || today} ${a.time || '00:00'}`);
        const dateB = new Date(`${b.date || today} ${b.time || '00:00'}`);
        return dateB.getTime() - dateA.getTime();
      });
  },

  getStats: () => {
    const entries = get().getPeriodEntries();
    
    const byType: Record<string, number> = {
      chat: 0,
      journal: 0,
      todo: 0,
      idea: 0,
      note: 0,
    };
    
    const byPriority: Record<string, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    let completed = 0;

    entries.forEach((entry) => {
      // 使用 categoryId 如果存在，否则使用 type
      const displayType = entry.categoryId || entry.type;
      if (!byType[displayType]) {
        byType[displayType] = 0;
      }
      byType[displayType]++;
      byPriority[entry.priority] = (byPriority[entry.priority] || 0) + 1;
      if (entry.type === 'todo' && entry.completed) completed++;
    });

    return {
      total: entries.length,
      byType,
      byPriority,
      completed,
    };
  },
}));
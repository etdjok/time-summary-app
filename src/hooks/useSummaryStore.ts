import { create } from 'zustand';
import { MarkdownEntry, Period, PeriodType } from '../types';
import { getPeriodForDate } from '../lib/dateUtils';
import { fetchFilesMdEntries, appendToChatMd, appendToTodoMd, appendToJournalMd } from '../lib/nutstore';

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
  addEntry: (content: string, type: string) => Promise<boolean>;
  
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

  addEntry: async (content: string, target: 'chat' | 'todo' | 'journal'): Promise<boolean> => {
    const basePath = get().nutstoreBasePath;
    let success = false;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let formattedContent = `${timeStr} ${content}`;

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

  getPeriodEntries: () => {
    const { entries, currentPeriod } = get();
    const start = new Date(currentPeriod.startDate);
    const end = new Date(currentPeriod.endDate);
    end.setHours(23, 59, 59, 999);
    
    return entries
      .filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= start && entryDate <= end;
      })
      .sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time || '00:00'}`);
        const dateB = new Date(`${b.date} ${b.time || '00:00'}`);
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
      byType[entry.type] = (byType[entry.type] || 0) + 1;
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
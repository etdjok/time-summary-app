import { create } from 'zustand';
import { MarkdownEntry, Period, PeriodType } from '../types';
import { getPeriodForDate } from '../lib/dateUtils';
import { fetchFilesMdEntries, appendToChatMd, appendToTodoMd, appendToJournalMd, appendToIdeaMd, appendToNoteMd, appendToFile, deleteFile, readFile, writeFile } from '../lib/nutstore';

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
  addEntry: (content: string, target: string, categoryId?: string, priority?: 'urgent' | 'high' | 'medium' | 'low') => Promise<boolean>;
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

function attachPriority(text: string, priority: string): string {
  if (!text.includes('\n')) {
    return `${text} #${priority}`;
  }
  const lines = text.split('\n');
  lines[0] = `${lines[0]} #${priority}`;
  return lines.join('\n');
}

function buildFilePath(basePath: string, sourceFile: string): string {
  const lower = sourceFile.toLowerCase();
  if (lower === 'chat.md') return `${basePath}/Chat.md`;
  if (lower === 'later.md') return `${basePath}/Later.md`;
  if (lower === 'idea.md') return `${basePath}/Idea.md`;
  if (lower === 'note.md') return `${basePath}/Note.md`;
  if (lower.includes('journal') || lower.match(/\d{4}\.\d{2}/)) return `${basePath}/journal/${sourceFile}`;
  return `${basePath}/${sourceFile}`;
}

function normTime(t?: string): string {
  if (!t) return '';
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : t;
}

function normContent(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function isNewEntryLine(l: string): boolean {
  const t = l.trim();
  if (!t) return true;
  if (t.match(/^##\s/)) return true;
  if (t.match(/^###?\s/)) return true;
  if (t.match(/^\d{1,2}:\d{2}\s/)) return true;
  if (t.match(/^[-*]\s*\[[x ]\]/)) return true;
  if (t.match(/^[-*]\s+/)) return true;
  if (t.match(/^\d+\.\s/)) return true;
  return false;
}

// 判断一行是否可能匹配目标条目
// v1.18.5: 新增 rawLine 精确匹配，优先使用
function lineMatchesEntry(
  line: string,
  entryTime: string,
  matchContent: string,
  rawLine?: string
): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // 优先使用 rawLine 精确匹配（v1.18.5）
  if (rawLine) {
    const rawFirstLine = rawLine.split('\n')[0].trim();
    if (trimmed === rawFirstLine) {
      return true;
    }
  }

  // 模式1: 带时间戳的条目
  const timeMatch = trimmed.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
  const todoMatch = trimmed.match(/^- \[([ x])\]\s+(\d{1,2}:\d{2})\s+(.+)$/);

  if (timeMatch) {
    const [, time, fileContent] = timeMatch;
    const timeNorm = normTime(time);
    if ((!entryTime || timeNorm === entryTime) && normContent(fileContent).includes(matchContent)) {
      return true;
    }
  } else if (todoMatch) {
    const [, , time, fileContent] = todoMatch;
    const timeNorm = normTime(time);
    if ((!entryTime || timeNorm === entryTime) && normContent(fileContent).includes(matchContent)) {
      return true;
    }
  } else {
    // 模式2: 无时间戳的条目（仅内容匹配）
    if (normContent(trimmed).includes(matchContent)) {
      return true;
    }
  }

  return false;
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
      case 'day': nextDate = new Date(startDate.getTime() + 86400000); break;
      case 'week': nextDate = new Date(startDate.getTime() + 604800000); break;
      case 'month': nextDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1); break;
      case 'quarter': nextDate = new Date(startDate.getFullYear(), startDate.getMonth() + 3, 1); break;
      case 'half-year': nextDate = new Date(startDate.getFullYear(), startDate.getMonth() + 6, 1); break;
      case 'year': nextDate = new Date(startDate.getFullYear() + 1, 0, 1); break;
      default: nextDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
    }
    set({ currentPeriod: getPeriodForDate(nextDate, type) });
  },

  goToPrevPeriod: () => {
    const { currentPeriod } = get();
    const type = currentPeriod.type;
    const startDate = new Date(currentPeriod.startDate);
    
    let prevDate: Date;
    switch (type) {
      case 'day': prevDate = new Date(startDate.getTime() - 86400000); break;
      case 'week': prevDate = new Date(startDate.getTime() - 604800000); break;
      case 'month': prevDate = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1); break;
      case 'quarter': prevDate = new Date(startDate.getFullYear(), startDate.getMonth() - 3, 1); break;
      case 'half-year': prevDate = new Date(startDate.getFullYear(), startDate.getMonth() - 6, 1); break;
      case 'year': prevDate = new Date(startDate.getFullYear() - 1, 0); break;
      default: prevDate = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
    }
    set({ currentPeriod: getPeriodForDate(prevDate, type) });
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

  addEntry: async (content: string, target: string, categoryId?: string, priority?: 'urgent' | 'high' | 'medium' | 'low'): Promise<boolean> => {
    const basePath = get().nutstoreBasePath;
    let success = false;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const catMarker = categoryId ? `@cat:${categoryId} ` : '';
    const contentWithPriority = priority
      ? attachPriority(content, priority)
      : content;
    let formattedContent = `${timeStr} ${catMarker}${contentWithPriority}`;

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
      case 'idea':
        success = await appendToIdeaMd(basePath, formattedContent);
        break;
      case 'note':
        success = await appendToNoteMd(basePath, formattedContent);
        break;
      case 'chat':
        success = await appendToChatMd(basePath, formattedContent);
        break;
      default:
        success = await appendToFile(basePath, formattedContent, target);
        break;
    }

    return success;
  },

  updateEntry: async (entryId: string, updates: Partial<MarkdownEntry>): Promise<boolean> => {
    const { entries, nutstoreBasePath } = get();
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return false;

    const filePath = buildFilePath(nutstoreBasePath, entry.sourceFile);

    const readResult = await readFile(filePath);
    if (!readResult.success || !readResult.content) return false;

    const displayType = updates.type || entry.categoryId || entry.type;
    const categoryMarker = displayType ? `@cat:${displayType} ` : '';

    const contentFirstLine = (entry.content.split('\n')[0] || '').trim();
    const matchContent = contentFirstLine.replace(/\s+/g, ' ');
    const entryTimeNorm = normTime(entry.time);

    const lines = readResult.content.split('\n');
    const updatedLines: string[] = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // v1.18.5: 传入 rawLine 进行精确匹配
      if (lineMatchesEntry(line, entryTimeNorm, matchContent, entry.rawLine)) {
        // 收集所有延续行
        let blockEnd = i + 1;
        while (blockEnd < lines.length && !isNewEntryLine(lines[blockEnd])) {
          blockEnd++;
        }

        const newContent = updates.content || entry.content;
        const newPriority = updates.priority || entry.priority;
        const completed = updates.completed ?? entry.completed;

        let newLine: string;
        const entryTimeStr = entry.time ? `${entry.time} ` : '';
        if (line.trim().startsWith('- [x]') || line.trim().startsWith('- [ ]') ||
            line.trim().startsWith('* [x]') || line.trim().startsWith('* [ ]')) {
          const checkMark = completed ? 'x' : ' ';
          newLine = `- [${checkMark}] ${entryTimeStr}${categoryMarker}${attachPriority(newContent, newPriority)}`;
        } else {
          newLine = `${entryTimeStr}${categoryMarker}${attachPriority(newContent, newPriority)}`;
        }

        updatedLines.push(newLine);
        i = blockEnd;
      } else {
        updatedLines.push(line);
        i++;
      }
    }

    const newContent = updatedLines.join('\n');
    const writeResult = await writeFile(filePath, newContent);
    
    if (writeResult.success) {
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

    const filePath = buildFilePath(nutstoreBasePath, entry.sourceFile);

    const readResult = await readFile(filePath);
    if (!readResult.success || !readResult.content) return false;

    const contentFirstLine = (entry.content.split('\n')[0] || '').trim();
    const matchContent = contentFirstLine.replace(/\s+/g, ' ');
    const entryTimeNorm = normTime(entry.time);

    const lines = readResult.content.split('\n');
    const updatedLines: string[] = [];

    let i = 0;
    let deleted = false;
    while (i < lines.length) {
      const line = lines[i];

      // v1.18.5: 传入 rawLine 进行精确匹配
      if (lineMatchesEntry(line, entryTimeNorm, matchContent, entry.rawLine) && !deleted) {
        let blockEnd = i + 1;
        while (blockEnd < lines.length && !isNewEntryLine(lines[blockEnd])) {
          blockEnd++;
        }
        i = blockEnd;
        deleted = true;
      } else {
        if (line.trim()) {
          updatedLines.push(line);
        }
        i++;
      }
    }

    const newContent = updatedLines.join('\n');
    const writeResult = await writeFile(filePath, newContent);
    
    if (writeResult.success) {
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
    const todayDate = new Date(today);
    const todayInPeriod = todayDate >= start && todayDate <= end;
    
    return entries
      .filter((entry) => {
        if (!entry.date) {
          return todayInPeriod;
        }
        const entryDate = new Date(entry.date);
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
      chat: 0, journal: 0, todo: 0, idea: 0, note: 0,
    };
    
    const byPriority: Record<string, number> = {
      urgent: 0, high: 0, medium: 0, low: 0,
    };

    let completed = 0;

    entries.forEach((entry) => {
      const displayType = entry.categoryId || entry.type;
      if (!byType[displayType]) byType[displayType] = 0;
      byType[displayType]++;
      byPriority[entry.priority] = (byPriority[entry.priority] || 0) + 1;
      if (entry.completed) completed++;
    });

    return {
      total: entries.length,
      byType,
      byPriority,
      completed,
    };
  },
}));
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

// v1.18: 模块级 attachPriority - #priority 只追加到首行末尾，续行不带 tag
function attachPriority(text: string, priority: string): string {
  if (!text.includes('\n')) {
    return `${text} #${priority}`;
  }
  const lines = text.split('\n');
  lines[0] = `${lines[0]} #${priority}`;
  return lines.join('\n');
}

// 根据 sourceFile 构建正确的坚果云文件路径
function buildFilePath(basePath: string, sourceFile: string): string {
  const lower = sourceFile.toLowerCase();
  if (lower === 'chat.md') return `${basePath}/Chat.md`;
  if (lower === 'later.md') return `${basePath}/Later.md`;
  if (lower === 'idea.md') return `${basePath}/Idea.md`;
  if (lower === 'note.md') return `${basePath}/Note.md`;
  if (lower.includes('journal') || lower.match(/\d{4}\.\d{2}/)) return `${basePath}/journal/${sourceFile}`;
  return `${basePath}/${sourceFile}`;
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
      case 'year': prevDate = new Date(startDate.getFullYear() - 1, 0, 1); break;
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
    // v1.18: 使用 attachPriority，#priority 加到首行而非整个 content 末尾
    const contentWithPriority = priority
      ? attachPriority(content, priority)
      : content;
    let formattedContent = `${timeStr} ${catMarker}${contentWithPriority}`;

    if (target === 'todo') {
      formattedContent = `- [ ] ${formattedContent}`;
    }

    // 每种分类写入独立文件
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
        // 自定义分类：用 target 名作为文件名
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

    // 修复 v1.17：使用完整 content 第一行匹配（不截断），并对空白做归一化以与文件原文一致
    const contentFirstLine = (entry.content.split('\n')[0] || '').trim();
    const matchContent = contentFirstLine.replace(/\s+/g, ' ');
    // 时间归一化（"9:30" -> "09:30"），用于和文件中可能补零的时间比较
    const normTime = (t?: string): string => {
      if (!t) return '';
      const m = t.match(/^(\d{1,2}):(\d{2})$/);
      return m ? `${m[1].padStart(2, '0')}:${m[2]}` : t;
    };
    const entryTimeNorm = normTime(entry.time);

    const lines = readResult.content.split('\n');
    const updatedLines: string[] = [];

    const isNewEntry = (l: string): boolean => {
      const t = l.trim();
      if (!t) return true;
      if (t.match(/^##\s/)) return true;
      if (t.match(/^###?\s/)) return true;
      if (t.match(/^\d{1,2}:\d{2}\s/)) return true;
      if (t.match(/^[-*]\s*\[[x ]\]/)) return true;
      if (t.match(/^[-*]\s+/)) return true;
      if (t.match(/^\d+\.\s/)) return true;
      return false;
    };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      // 修复 v1.17：时间正则统一为 1-2 位小时（与解析器一致），时间比较前做 padStart 归一化
      const timeMatch = line.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
      const todoMatch = line.match(/^- \[([ x])\]\s+(\d{1,2}:\d{2})\s+(.+)$/);

      let isTargetLine = false;

      // 对文件行内容也做空白归一化，保证与 matchContent 一致
      const normContent = (s: string) => s.replace(/\s+/g, ' ').trim();

      if (todoMatch) {
        const [, check, time, fileContent] = todoMatch;
        const timeNorm = normTime(time);
        // entry.time 可能是 undefined（无时间前缀的条目），此时只用内容匹配
        if ((!entryTimeNorm || timeNorm === entryTimeNorm) && normContent(fileContent).includes(matchContent)) {
          isTargetLine = true;
        }
      } else if (timeMatch) {
        const [, time, fileContent] = timeMatch;
        const timeNorm = normTime(time);
        if ((!entryTimeNorm || timeNorm === entryTimeNorm) && normContent(fileContent).includes(matchContent)) {
          isTargetLine = true;
        }
      }

      if (isTargetLine) {
        let blockEnd = i + 1;
        while (blockEnd < lines.length && !isNewEntry(lines[blockEnd])) {
          blockEnd++;
        }

        const newContent = updates.content || entry.content;
        const newPriority = updates.priority || entry.priority;
        const completed = updates.completed ?? entry.completed;

        let newLine: string;
        const entryTimeStr = entry.time ? `${entry.time} ` : '';
        if (todoMatch) {
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

    // 修复 v1.17：使用完整 content 第一行匹配（不截断），并对空白做归一化
    const contentFirstLine = (entry.content.split('\n')[0] || '').trim();
    const matchContent = contentFirstLine.replace(/\s+/g, ' ');
    const normTime = (t?: string): string => {
      if (!t) return '';
      const m = t.match(/^(\d{1,2}):(\d{2})$/);
      return m ? `${m[1].padStart(2, '0')}:${m[2]}` : t;
    };
    const entryTimeNorm = normTime(entry.time);

    const lines = readResult.content.split('\n');
    const updatedLines: string[] = [];
    
    const isNewEntry = (l: string): boolean => {
      const t = l.trim();
      if (!t) return true;
      if (t.match(/^##\s/)) return true;
      if (t.match(/^###?\s/)) return true;
      if (t.match(/^\d{1,2}:\d{2}\s/)) return true;
      if (t.match(/^[-*]\s*\[[x ]\]/)) return true;
      if (t.match(/^[-*]\s+/)) return true;
      if (t.match(/^\d+\.\s/)) return true;
      return false;
    };

    let i = 0;
    let deleted = false;
    while (i < lines.length) {
      const line = lines[i];
      // 修复 v1.17：时间正则统一为 1-2 位小时，时间比较前做 padStart 归一化
      const timeMatch = line.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
      const todoMatch = line.match(/^- \[([ x])\]\s+(\d{1,2}:\d{2})\s+(.+)$/);
      
      let isTargetLine = false;
      
      const normContent = (s: string) => s.replace(/\s+/g, ' ').trim();
      
      if (todoMatch) {
        const [, , time, content] = todoMatch;
        const timeNorm = normTime(time);
        if ((!entryTimeNorm || timeNorm === entryTimeNorm) && normContent(content).includes(matchContent)) {
          isTargetLine = true;
        }
      } else if (timeMatch) {
        const [, time, content] = timeMatch;
        const timeNorm = normTime(time);
        if ((!entryTimeNorm || timeNorm === entryTimeNorm) && normContent(content).includes(matchContent)) {
          isTargetLine = true;
        }
      }
      
      if (isTargetLine && !deleted) {
        let blockEnd = i + 1;
        while (blockEnd < lines.length && !isNewEntry(lines[blockEnd])) {
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
    
    return entries
      .filter((entry) => {
        // v1.18: 无日期条目不归入任何周期，避免"明天变成未记录日期"的问题
        // 只有当 entry.date 存在时才参与周期过滤
        if (!entry.date) {
          // 当周期是 day 且是今天时，仍然显示无日期条目（保持向后兼容）
          // 否则不显示
          return currentPeriod.type === 'day' && currentPeriod.startDate === today;
        }
        const entryDate = new Date(entry.date);
        return entryDate >= start && entryDate <= end;
      })
      // 修复：按日期和时间降序排序（最新在前）
      .sort((a, b) => {
        const dateA = new Date(`${a.date || today} ${a.time || '00:00'}`);
        const dateB = new Date(`${b.date || today} ${b.time || '00:00'}`);
        return dateB.getTime() - dateA.getTime(); // 降序：最新的在前
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

    return { total: entries.length, byType, byPriority, completed };
  },
}));

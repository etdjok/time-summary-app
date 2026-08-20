import { create } from 'zustand';
import { MarkdownEntry, Period, PeriodType } from '../types';
import { getPeriodForDate } from '../lib/dateUtils';
import { fetchFilesMdEntries, appendToChatMd, appendToTodoMd, appendToJournalMd, appendToIdeaMd, appendToNoteMd, appendToFile, readFile, writeFile } from '../lib/nutstore';

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

function matchEntryLine(line: string, entry: MarkdownEntry, preferOriginal: boolean = false): boolean {
  const trimmedLine = line.trim();
  
  if (!trimmedLine) return false;
  
  // 1. 先用 rawLine 做所有匹配（精确 + 标准化），即使包含日期时间戳也应该匹配
  if (entry.rawLine) {
    const rawLines = entry.rawLine.split('\n').map(l => l.trim()).filter(Boolean);
    if (rawLines.length > 0) {
      const firstRawLine = rawLines[0];
      
      // 精确匹配
      if (firstRawLine === trimmedLine) return true;
      
      // 标准化匹配
      const normalizeLine = (s: string) => {
        return s
          .replace(/^\d{1,2}:\d{2}\s*/, '')
          .replace(/^-\s*\[[ x]\]\s*/, '')
          .replace(/^[-*]\s+/, '')
          .replace(/@cat:\S+\s*/g, '')
          .replace(/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{2}\s*/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      };
      
      const normRaw = normalizeLine(firstRawLine);
      const normLine = normalizeLine(trimmedLine);
      
      if (normRaw === normLine) return true;
      
      if (normRaw.length > 5 && normLine.length > 5) {
        if (normRaw.includes(normLine) || normLine.includes(normRaw)) {
          const coreRaw = normRaw.replace(/^[-*]\s*/, '').trim();
          const coreLine = normLine.replace(/^[-*]\s*/, '').trim();
          if (coreRaw === coreLine) return true;
        }
      }
    }
  }
  
  // 2. rawLine 匹配失败后，跳过包含日期时间戳的行（这些是编辑行，不是原始行）
  if (preferOriginal && /\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{2}/.test(trimmedLine)) return false;
  
  // 3. 用 content 第一行做匹配
  const contentFirstLine = (entry.content.split('\n')[0] || '').trim();
  if (!contentFirstLine) return false;
  
  const normStr = (s: string) => s.replace(/\s+/g, ' ').trim();
  const matchContent = normStr(contentFirstLine);
  const lineContent = normStr(trimmedLine);
  
  if (lineContent.includes(matchContent) || matchContent.includes(lineContent)) {
    const normTime = (t: string | undefined) => {
      if (!t) return '';
      const m = t.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return t;
      const h = m[1].padStart(2, '0');
      const mm = m[2];
      return h + ':' + mm;
    };
    
    const entryTimeNorm = normTime(entry.time);
    
    const timeMatch = trimmedLine.match(/^(\d{1,2}:\d{2})\s+/);
    const todoTimeMatch = trimmedLine.match(/^- \[([ x])\]\s+(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+)?(\d{1,2}:\d{2})\s+/);
    
    let fileTime = '';
    if (timeMatch) {
      fileTime = normTime(timeMatch[1]);
    } else if (todoTimeMatch) {
      fileTime = normTime(todoTimeMatch[2]);
    }
    
    if (!entryTimeNorm || !fileTime || entryTimeNorm === fileTime) {
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
  nutstoreBasePath: (() => {
    try { return (localStorage.getItem('nutstore_base_path') || '').trim() || '/我的坚果云/笔记'; }
    catch { return '/我的坚果云/笔记'; }
  })(),

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
    // 持久化到 localStorage，与 _categories.json/_habits.json 等读取方保持同一来源，
    // 避免刷新后 basePath 回退默认值、条目与配置/打卡数据目录脱节
    try { localStorage.setItem('nutstore_base_path', path); } catch { /* iOS 隐私模式等场景忽略 */ }
    set({ nutstoreBasePath: path });
  },

  addEntry: async (content: string, target: string, categoryId?: string, priority?: 'urgent' | 'high' | 'medium' | 'low'): Promise<boolean> => {
    const basePath = get().nutstoreBasePath;
    let success = false;

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const catMarker = categoryId ? `@cat:${categoryId} ` : '';
    const contentWithPriority = priority
      ? attachPriority(content, priority)
      : content;
    // 修复：新条目包含日期和时间，格式 YYYY-MM-DD HH:MM
    let formattedContent = `${dateStr} ${timeStr} ${catMarker}${contentWithPriority}`;

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

    const lines = readResult.content.split('\n');
    const updatedLines: string[] = [];

    let i = 0;
    let editApplied = false;
    while (i < lines.length) {
      const line = lines[i];
      const todoMatch = line.match(/^- \[([ x])\]\s+(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+)?(\d{1,2}:\d{2})\s+(.+)$/);

      const isTargetLine = matchEntryLine(line, entry, true);

      if (isTargetLine && !editApplied) {
        const newContent = updates.content || entry.content;
        const newPriority = updates.priority || entry.priority;
        const completed = updates.completed ?? entry.completed;
        const onlyCompletedChange = updates.completed !== undefined && !updates.content && !updates.priority;

        if (onlyCompletedChange && todoMatch) {
          // 仅切换完成状态：原地修改 [ ]/[x] 标记，不产生编辑行
          const checkMark = completed ? 'x' : ' ';
          const modifiedLine = line.replace(/^(- \[)[ x](\])/, `$1${checkMark}$2`);
          updatedLines.push(modifiedLine);
          i++;
        } else {
          // 有内容/优先级变更：保留原行，追加编辑行
          updatedLines.push(line);
          i++;

          // 收集编辑行：检查 [编辑]/[已编辑] 标记或多个时间戳（向后兼容旧格式）
          const isEditLine = (l: string): boolean => {
            const t = l.trim();
            if (t.includes('[编辑]') || t.includes('[已编辑')) return true;
            const tsMatches = t.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{2}/g);
            if (tsMatches && tsMatches.length > 1) return true;
            return false;
          };

          while (i < lines.length && isEditLine(lines[i])) {
            updatedLines.push(lines[i]);
            i++;
          }

          const now = new Date();
          const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

          let newLine: string;
          if (todoMatch) {
            const checkMark = completed ? 'x' : ' ';
            newLine = `- [${checkMark}] ${dateStr} ${timeStr} ${categoryMarker}[编辑] ${attachPriority(newContent, newPriority)}`;
          } else {
            newLine = `${dateStr} ${timeStr} ${categoryMarker}[编辑] ${attachPriority(newContent, newPriority)}`;
          }

          updatedLines.push(newLine);
        }
        editApplied = true;
      } else {
        updatedLines.push(line);
        i++;
      }
    }

    const newFileContent = updatedLines.join('\n');
    const writeResult = await writeFile(filePath, newFileContent);
    
    if (writeResult.success) {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      const hasNewContent = updates.content && updates.content !== entry.content;
      
      set({
        entries: entries.map(e => {
          if (e.id !== entryId) return e;
          
          if (hasNewContent) {
            const newContentValue = updates.content as string;
            const localEditLine = `${dateStr} ${timeStr} ${displayType ? `@cat:${displayType} ` : ''}[编辑] ${attachPriority(newContentValue, updates.priority || e.priority)}`;
            return { 
              ...e, 
              content: `${e.content}\n${localEditLine}`,
              categoryId: displayType,
              priority: updates.priority || e.priority,
              completed: updates.completed ?? e.completed
            };
          } else {
            return { 
              ...e, 
              categoryId: displayType,
              priority: updates.priority || e.priority,
              completed: updates.completed ?? e.completed
            };
          }
        })
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

    const lines = readResult.content.split('\n');
    const updatedLines: string[] = [];
    
    const isNewEntry = (l: string): boolean => {
      const t = l.trim();
      if (!t) return true;
      // 编辑行：包含 [编辑]、[已编辑] 标记，或多个时间戳（旧格式）
      if (t.includes('[编辑]') || t.includes('[已编辑')) return false;
      const tsMatches = t.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{2}/g);
      if (tsMatches && tsMatches.length > 1) return false;
      if (t.match(/^##\s/)) return true;
      if (t.match(/^###?\s/)) return true;
      if (t.match(/^\d{1,2}:\d{2}\s/)) return true;
      if (t.match(/^[-*]\s*\[[x ]\]/)) return true;
      if (t.match(/^[-*]\s+/)) return true;
      if (t.match(/^\d+\.\s/)) return true;
      // 新格式原始条目：YYYY-MM-DD HH:MM 开头
      if (t.match(/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{2}/)) return true;
      return false;
    };

    let i = 0;
    let deleted = false;
    while (i < lines.length) {
      const line = lines[i];

      const isTargetLine = matchEntryLine(line, entry);
      
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
      let displayType = entry.categoryId || entry.type;
      if (displayType && displayType.startsWith('custom_')) {
        displayType = displayType.slice(7);
      }
      if (!byType[displayType]) byType[displayType] = 0;
      byType[displayType]++;
      byPriority[entry.priority] = (byPriority[entry.priority] || 0) + 1;
      if (entry.completed) completed++;
    });

    return { total: entries.length, byType, byPriority, completed };
  },
}));

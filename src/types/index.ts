export type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'half-year' | 'year';

export interface Period {
  id: string;
  type: PeriodType;
  startDate: string;
  endDate: string;
  title: string;
}

export type EntryStatus = 'draft' | 'incomplete' | 'in-progress' | 'completed' | 'archived';

export interface MarkdownEntry {
  id: string;
  content: string;
  type: string;
  categoryId?: string;
  date: string;
  time?: string;
  sourceFile: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  tags: string[];
  completed?: boolean;
  status?: EntryStatus;
  rawLine?: string;
}

export const PERIOD_LABELS: Record<PeriodType, string> = {
  'day': '日',
  'week': '周',
  'month': '月',
  'quarter': '季度',
  'half-year': '半年',
  'year': '年',
};

export const FILE_TYPE_LABELS: Record<string, string> = {
  'chat': '收集箱',
  'journal': '日记',
  'todo': '待办',
  'idea': '想法',
  'note': '笔记',
};

export const STATUS_OPTIONS: { value: EntryStatus; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'incomplete', label: '未完成' },
  { value: 'in-progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'archived', label: '已归档' },
];

export const STATUS_LABELS: Record<EntryStatus, string> = {
  'draft': '草稿',
  'incomplete': '未完成',
  'in-progress': '进行中',
  'completed': '已完成',
  'archived': '已归档',
};

export const PRIORITY_LABELS: Record<string, string> = {
  'urgent': 'Q1 紧急且重要',
  'high': 'Q2 重要不紧急',
  'medium': 'Q3 紧急不重要',
  'low': 'Q4 不紧急不重要',
};

// 四象限定义 Q1-Q4
export const QUADRANT_DEFS: Record<string, { id: string, name: string, label: string, color: string, bgColor: string }> = {
  'urgent': { id: 'Q1', name: '紧急且重要', label: 'Q1', color: 'bg-red-500', bgColor: 'bg-red-100 text-red-700 border-red-300' },
  'high': { id: 'Q2', name: '重要不紧急', label: 'Q2', color: 'bg-orange-500', bgColor: 'bg-orange-100 text-orange-700 border-orange-300' },
  'medium': { id: 'Q3', name: '紧急不重要', label: 'Q3', color: 'bg-amber-500', bgColor: 'bg-amber-100 text-amber-700 border-amber-300' },
  'low': { id: 'Q4', name: '不紧急不重要', label: 'Q4', color: 'bg-gray-500', bgColor: 'bg-gray-100 text-gray-600 border-gray-300' },
};

export const QUADRANT_PRIORITY_MAP: Record<string, string> = {
  'Q1': 'urgent',
  'Q2': 'high',
  'Q3': 'medium',
  'Q4': 'low',
};

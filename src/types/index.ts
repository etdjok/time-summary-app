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
  type: 'chat' | 'journal' | 'todo' | 'idea' | 'note';
  date: string;
  time?: string;
  sourceFile: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  tags: string[];
  completed?: boolean;
  status?: EntryStatus;
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
  'urgent': '紧急',
  'high': '重要',
  'medium': '一般',
  'low': '次要',
};

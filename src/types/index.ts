export type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'half-year' | 'year';

export interface Period {
  id: string;
  type: PeriodType;
  startDate: string;
  endDate: string;
  title: string;
}

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
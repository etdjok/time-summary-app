/**
 * 每日打卡（习惯追踪）数据层
 *
 * 存储设计：
 * - 数据以 JSON 存于坚果云 ${basePath}/_habits.json
 * - 读写走 nutstore.readFile/writeFile，端到端加密开启时自动加解密
 * - 纯逻辑函数（无 IO）与 IO 函数分离，便于单元测试
 */

import { readFile, writeFile } from './nutstore';

// ========== 数据模型 ==========

export interface Habit {
  id: string;
  name: string;
  icon: string; // emoji
  createdAt: string; // YYYY-MM-DD
}

// habitId -> 打卡日期列表（YYYY-MM-DD，升序）
export type HabitRecords = Record<string, string[]>;

export interface HabitsData {
  version: 1;
  habits: Habit[];
  records: HabitRecords;
}

// 深新建空数据（避免共享引用被意外修改）
export function emptyHabits(): HabitsData {
  return { version: 1, habits: [], records: {} };
}

export const HABITS_FILENAME = '_habits.json';

const HABIT_ICONS = ['✅', '🏃', '📖', '💧', '🧘', '💪', '🌱', '☀️', '🎯', '✍️'];

// ========== 纯逻辑（可单测） ==========

// 本地日期 YYYY-MM-DD（不使用 toISOString，避免时区偏移）
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function isDone(records: HabitRecords, habitId: string, date: string): boolean {
  return (records[habitId] || []).includes(date);
}

// 打卡/取消打卡（幂等：重复打卡不重复记录）
export function toggleDone(records: HabitRecords, habitId: string, date: string): HabitRecords {
  const list = records[habitId] || [];
  if (list.includes(date)) {
    const next = list.filter(d => d !== date);
    return { ...records, [habitId]: next };
  }
  return { ...records, [habitId]: [...list, date].sort() };
}

// 连续打卡天数：从今天往回数；今天未打卡时从昨天起算（当天还没打不清零）
export function computeStreak(records: HabitRecords, habitId: string, today: string): number {
  const set = new Set(records[habitId] || []);
  if (set.size === 0) return 0;
  const cur = new Date(today + 'T00:00:00');
  if (isNaN(cur.getTime())) return 0;
  if (!set.has(today)) cur.setDate(cur.getDate() - 1); // 今天尚未打卡，从昨天起算
  let streak = 0;
  while (set.has(toDateStr(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

// 某月打卡日期集合（month 为 1-12）
export function monthDoneSet(records: HabitRecords, habitId: string, year: number, month: number): Set<string> {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return new Set((records[habitId] || []).filter(d => d.startsWith(prefix)));
}

export function createHabit(name: string, icon?: string, today: string = todayStr()): Habit {
  const id = `habit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return { id, name: name.trim(), icon: icon || HABIT_ICONS[Math.floor(Math.random() * HABIT_ICONS.length)], createdAt: today };
}

// JSON 字符串 -> HabitsData（容错解析：损坏数据返回空，避免整个页面崩溃）
export function parseHabits(raw: string): HabitsData {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && Array.isArray(obj.habits) && typeof obj.records === 'object' && obj.records !== null) {
      // 逐项校验，过滤掉畸形数据（如 records 值不是 string[] 的历史脏数据）
      const habits = obj.habits.filter(
        (h: unknown): h is Habit => !!h && typeof h === 'object' && typeof (h as Habit).id === 'string' && typeof (h as Habit).name === 'string'
      );
      const records: HabitRecords = {};
      for (const [key, value] of Object.entries(obj.records as Record<string, unknown>)) {
        if (Array.isArray(value) && value.every((d): d is string => typeof d === 'string')) {
          records[key] = value;
        }
      }
      return { version: 1, habits, records };
    }
  } catch { /* 损坏数据按空处理 */ }
  return emptyHabits();
}

export function serializeHabits(data: HabitsData): string {
  return JSON.stringify(data);
}

// ========== IO（云端读写） ==========

export async function loadHabits(basePath: string): Promise<HabitsData> {
  const path = `${basePath.replace(/\/+$/, '')}/${HABITS_FILENAME}`;
  const r = await readFile(path);
  if (!r.success || !r.content) return emptyHabits();
  return parseHabits(r.content);
}

export async function saveHabits(basePath: string, data: HabitsData): Promise<boolean> {
  const path = `${basePath.replace(/\/+$/, '')}/${HABITS_FILENAME}`;
  const r = await writeFile(path, serializeHabits(data));
  return r.success;
}

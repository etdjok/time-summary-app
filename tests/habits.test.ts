/**
 * 心光 v2.3 每日打卡核心逻辑测试
 * 覆盖：打卡/取消、连续天数、月历统计、序列化容错
 */
import { describe, it, expect } from 'vitest';
import {
  isDone,
  toggleDone,
  computeStreak,
  monthDoneSet,
  createHabit,
  parseHabits,
  serializeHabits,
  toDateStr,
  type HabitRecords,
} from '../src/lib/habits';

describe('打卡与取消', () => {
  it('未打卡 -> 打卡 -> 取消完整往返', () => {
    let records: HabitRecords = {};
    expect(isDone(records, 'h1', '2026-08-20')).toBe(false);

    records = toggleDone(records, 'h1', '2026-08-20');
    expect(isDone(records, 'h1', '2026-08-20')).toBe(true);

    records = toggleDone(records, 'h1', '2026-08-20');
    expect(isDone(records, 'h1', '2026-08-20')).toBe(false);
    expect(records['h1']).toHaveLength(0);
  });

  it('重复打卡幂等，不产生重复日期', () => {
    let records: HabitRecords = {};
    records = toggleDone(records, 'h1', '2026-08-20');
    records = toggleDone(records, 'h1', '2026-08-20');
    records = toggleDone(records, 'h1', '2026-08-20');
    expect(records['h1']).toEqual(['2026-08-20']);
  });

  it('不同习惯互不影响', () => {
    let records: HabitRecords = {};
    records = toggleDone(records, 'h1', '2026-08-20');
    expect(isDone(records, 'h2', '2026-08-20')).toBe(false);
    expect(isDone(records, 'h1', '2026-08-19')).toBe(false);
  });
});

describe('连续天数计算', () => {
  it('连续打卡 3 天（含今天）计为 3', () => {
    const records: HabitRecords = {
      h1: ['2026-08-18', '2026-08-19', '2026-08-20'],
    };
    expect(computeStreak(records, 'h1', '2026-08-20')).toBe(3);
  });

  it('今天未打卡不清零，从昨天起算', () => {
    const records: HabitRecords = {
      h1: ['2026-08-18', '2026-08-19'],
    };
    expect(computeStreak(records, 'h1', '2026-08-20')).toBe(2);
  });

  it('中断后重新计数', () => {
    const records: HabitRecords = {
      h1: ['2026-08-15', '2026-08-16', '2026-08-19', '2026-08-20'],
    };
    expect(computeStreak(records, 'h1', '2026-08-20')).toBe(2);
  });

  it('无记录计为 0', () => {
    expect(computeStreak({}, 'h1', '2026-08-20')).toBe(0);
    expect(computeStreak({ h2: ['2026-08-20'] }, 'h1', '2026-08-20')).toBe(0);
  });
});

describe('月历统计', () => {
  it('按年月过滤打卡日期', () => {
    const records: HabitRecords = {
      h1: ['2026-07-31', '2026-08-01', '2026-08-15', '2026-08-31', '2026-09-01'],
    };
    const done = monthDoneSet(records, 'h1', 2026, 8);
    expect(done.size).toBe(3);
    expect(done.has('2026-08-01')).toBe(true);
    expect(done.has('2026-08-15')).toBe(true);
    expect(done.has('2026-08-31')).toBe(true);
    expect(done.has('2026-07-31')).toBe(false);
    expect(done.has('2026-09-01')).toBe(false);
  });

  it('月份补零：单位数月正确匹配', () => {
    const records: HabitRecords = { h1: ['2026-01-05'] };
    expect(monthDoneSet(records, 'h1', 2026, 1).has('2026-01-05')).toBe(true);
    expect(monthDoneSet(records, 'h1', 2026, 11).size).toBe(0);
  });
});

describe('习惯创建与序列化', () => {
  it('创建习惯生成唯一 id 且名称去除首尾空格', () => {
    const a = createHabit('  晨跑  ', '🏃', '2026-08-20');
    const b = createHabit('晨跑', '🏃', '2026-08-20');
    expect(a.name).toBe('晨跑');
    expect(b.name).toBe('晨跑');
    expect(a.id).not.toBe(b.id);
    expect(a.icon).toBe('🏃');
    expect(a.createdAt).toBe('2026-08-20');
  });

  it('序列化后解析还原一致', () => {
    const data = {
      version: 1 as const,
      habits: [createHabit('阅读', '📖', '2026-08-20')],
      records: { h1: ['2026-08-19', '2026-08-20'] },
    };
    const parsed = parseHabits(serializeHabits(data));
    expect(parsed).toEqual(data);
  });

  it('损坏数据解析返回空数据不抛异常', () => {
    expect(parseHabits('not-json{{{')).toEqual({ version: 1, habits: [], records: {} });
    expect(parseHabits('123')).toEqual({ version: 1, habits: [], records: {} });
    expect(parseHabits('{"habits": "not-array"}')).toEqual({ version: 1, habits: [], records: {} });
  });
});

describe('日期工具', () => {
  it('toDateStr 输出本地时区零填充格式', () => {
    expect(toDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateStr(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

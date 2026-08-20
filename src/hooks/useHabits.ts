import { create } from 'zustand';
import {
  type Habit, type HabitRecords, type HabitsData,
  loadHabits as loadHabitsFromCloud, saveHabits,
  createHabit, toggleDone, todayStr,
} from '../lib/habits';

interface HabitsStore {
  habits: Habit[];
  records: HabitRecords;
  loading: boolean;
  saving: boolean;
  error: string | null;

  loadHabits: () => Promise<void>;
  addHabit: (name: string) => Promise<boolean>;
  removeHabit: (id: string) => Promise<boolean>;
  toggleHabit: (id: string) => Promise<boolean>;
}

function basePath(): string {
  try {
    return (localStorage.getItem('nutstore_base_path') || '').trim() || '/我的坚果云/笔记';
  } catch {
    return '/我的坚果云/笔记';
  }
}

// 云端写入串行队列：WebDAV 无版本控制，并发写同一文件会互相覆盖丢数据。
// 所有持久化操作按序执行；前一个失败不断链。
let writeQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => undefined);
  return run;
}

// 队列执行时刻的最新数据快照（此前乐观更新可能已被后续操作叠加）
function currentData(): HabitsData {
  const { habits, records } = useHabits.getState();
  return { version: 1, habits, records };
}

export const useHabits = create<HabitsStore>((set, get) => ({
  habits: [],
  records: {},
  loading: false,
  saving: false,
  error: null,

  loadHabits: async () => {
    set({ loading: true, error: null });
    const data = await loadHabitsFromCloud(basePath());
    set({ habits: data.habits, records: data.records, loading: false });
  },

  addHabit: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const habit = createHabit(trimmed);
    // 乐观更新：立即入列表
    set({ habits: [...get().habits, habit], saving: true, error: null });
    const ok = await enqueue(() => saveHabits(basePath(), currentData()));
    if (!ok) {
      // 回滚：仅撤销本次新增
      set({ habits: get().habits.filter(h => h.id !== habit.id), saving: false, error: '同步到坚果云失败，请稍后重试' });
      return false;
    }
    set({ saving: false });
    return true;
  },

  removeHabit: async (id) => {
    const { habits, records } = get();
    const removed = habits.find(h => h.id === id);
    if (!removed) return false;
    const removedRecord = records[id];
    // 乐观更新：立即移除
    const nextRecords = { ...records };
    delete nextRecords[id];
    set({ habits: habits.filter(h => h.id !== id), records: nextRecords, saving: true, error: null });
    const ok = await enqueue(() => saveHabits(basePath(), currentData()));
    if (!ok) {
      // 回滚：恢复被删习惯及其打卡记录
      set({
        habits: [...get().habits, removed],
        records: { ...get().records, [id]: removedRecord || [] },
        saving: false,
        error: '同步到坚果云失败，请稍后重试',
      });
      return false;
    }
    set({ saving: false });
    return true;
  },

  toggleHabit: async (id) => {
    const date = todayStr();
    // 乐观更新：立即切换打卡状态
    set({ records: toggleDone(get().records, id, date), saving: true, error: null });
    const ok = await enqueue(() => saveHabits(basePath(), currentData()));
    if (!ok) {
      // 回滚：再切换一次即撤销本次打卡变更
      set({ records: toggleDone(get().records, id, date), saving: false, error: '同步到坚果云失败，请稍后重试' });
      return false;
    }
    set({ saving: false });
    return true;
  },
}));

import { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Circle, Plus, Trash2, ChevronLeft, ChevronRight, Flame, Loader2 } from 'lucide-react';
import { useHabits } from '../hooks/useHabits';
import { isDone, computeStreak, monthDoneSet, todayStr } from '../lib/habits';

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

export function HabitTracker() {
  const { habits, records, loading, saving, error, loadHabits, addHabit, removeHabit, toggleHabit } = useHabits();
  const [newName, setNewName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    loadHabits();
  }, [loadHabits]);

  // 习惯列表变化时保持有效选中
  useEffect(() => {
    if (habits.length === 0) {
      if (selectedId !== null) setSelectedId(null);
    } else if (!habits.some(h => h.id === selectedId)) {
      setSelectedId(habits[0].id);
    }
  }, [habits, selectedId]);

  const today = todayStr();

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const ok = await addHabit(newName);
    if (ok) setNewName('');
  };

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`确定删除习惯「${name}」吗？历史打卡记录将一并删除。`)) return;
    await removeHabit(id);
  };

  const selected = habits.find(h => h.id === selectedId) || null;

  // 月历网格：周一开头，前置补空位
  const calendarCells = useMemo(() => {
    if (!selected) return [];
    const firstDay = new Date(viewYear, viewMonth - 1, 1);
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const leading = (firstDay.getDay() + 6) % 7; // 周一=0
    const done = monthDoneSet(records, selected.id, viewYear, viewMonth);
    const cells: ({ day: number; done: boolean; isToday: boolean } | null)[] = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, done: done.has(dateStr), isToday: dateStr === today });
    }
    return cells;
  }, [selected, records, viewYear, viewMonth, today]);

  const goToPrevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); } else setViewMonth(m => m - 1);
  };
  const goToNextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); } else setViewMonth(m => m + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span className="text-sm">正在加载打卡数据...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
      )}

      {/* 习惯列表 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">今日打卡</h3>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-amber-500" />}
        </div>

        {habits.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            还没有习惯。添加一个每天固定要做的事，开始打卡吧！
          </p>
        ) : (
          <div className="space-y-2">
            {habits.map(h => {
              const done = isDone(records, h.id, today);
              const streak = computeStreak(records, h.id, today);
              const selectedRow = h.id === selectedId;
              return (
                <div
                  key={h.id}
                  onClick={() => setSelectedId(h.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border ${
                    selectedRow ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-transparent hover:bg-amber-50/50'
                  }`}
                >
                  <span className="text-xl flex-shrink-0">{h.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{h.name}</p>
                    {streak > 0 && (
                      <p className="text-xs text-orange-500 flex items-center gap-0.5">
                        <Flame className="w-3 h-3" />
                        连续 {streak} 天
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleHabit(h.id); }}
                    disabled={saving}
                    className={`flex-shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${done ? 'text-green-600' : 'text-gray-300 hover:text-amber-400'}`}
                    title={done ? '取消今日打卡' : '今日打卡'}
                  >
                    {done ? <CheckCircle2 className="w-7 h-7" /> : <Circle className="w-7 h-7" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(h.id, h.name); }}
                    className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 transition-colors"
                    title="删除习惯"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 添加习惯 */}
        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="新习惯名称，如：晨跑 30 分钟"
            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 transition-colors"
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || saving}
            className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            添加
          </button>
        </div>
      </div>

      {/* 选中习惯的月历 */}
      {selected && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">
              {selected.icon} {selected.name} · {viewYear}年{viewMonth}月
            </h3>
            <div className="flex items-center gap-1">
              <button onClick={goToPrevMonth} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={goToNextMonth} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEK_LABELS.map(w => (
              <div key={w} className="text-xs text-gray-400 py-1">{w}</div>
            ))}
            {calendarCells.map((cell, i) =>
              cell === null ? (
                <div key={`empty-${i}`} />
              ) : (
                <div
                  key={cell.day}
                  className={`aspect-square flex items-center justify-center rounded-lg text-sm transition-colors ${
                    cell.done
                      ? 'bg-green-100 text-green-700 font-semibold'
                      : cell.isToday
                        ? 'border-2 border-amber-400 text-amber-600 font-semibold'
                        : 'text-gray-400'
                  }`}
                  title={cell.done ? '已打卡' : cell.isToday ? '今天' : undefined}
                >
                  {cell.day}
                </div>
              )
            )}
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">
            点击习惯行可切换月历 · 打卡数据加密存储于坚果云 _habits.json
          </p>
        </div>
      )}
    </div>
  );
}

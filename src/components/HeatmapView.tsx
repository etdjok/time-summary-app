import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSummaryStore } from '../hooks/useSummaryStore';

interface HeatmapViewProps {
  onSelectDate: (date: string) => void;
}

export function HeatmapView({ onSelectDate }: HeatmapViewProps) {
  const { entries } = useSummaryStore();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  const monthLabel = `${year}年${month + 1}月`;
  const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  // Count entries per day
  const dayCounts: Record<string, number> = {};
  entries.forEach((entry) => {
    dayCounts[entry.date] = (dayCounts[entry.date] || 0) + 1;
  });

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  let startDayOfWeek = firstDay.getDay();
  if (startDayOfWeek === 0) startDayOfWeek = 7;
  startDayOfWeek--;

  const today = new Date().toISOString().split('T')[0];
  const weeks: { date: string; day: number; count: number; level: number; isToday: boolean }[][] = [];
  let currentWeek: typeof weeks[0] = [];

  for (let i = 0; i < startDayOfWeek; i++) {
    currentWeek.push({ date: '', day: 0, count: 0, level: 0, isToday: false });
  }

  for (let day = 1; day <= lastDay; day++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const count = dayCounts[date] || 0;
    const level = count === 0 ? 0 : count <= 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
    currentWeek.push({ date, day, count, level, isToday: date === today });
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ date: '', day: 0, count: 0, level: 0, isToday: false });
    }
    weeks.push(currentWeek);
  }

  // Monthly stats
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthEntries = entries.filter((e) => e.date.startsWith(monthPrefix));
  const monthTotal = monthEntries.length;
  const monthCompleted = monthEntries.filter((e) => e.status === 'completed' || e.completed).length;
  const activeDays = new Set(monthEntries.map((e) => e.date)).size;
  const completionRate = monthTotal === 0 ? 0 : Math.round((monthCompleted / monthTotal) * 100);

  const levelColors = ['bg-gray-100', 'bg-green-200', 'bg-green-400', 'bg-green-600', 'bg-green-800'];

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold text-gray-800">{monthLabel}</span>
        <button onClick={nextMonth} className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-1.5 mb-3">
        <span className="text-xs text-gray-400">少</span>
        {levelColors.map((color, i) => (
          <span key={i} className={`w-3.5 h-3.5 rounded-sm ${color}`} />
        ))}
        <span className="text-xs text-gray-400">多</span>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdays.map((day) => (
          <span key={day} className="text-center text-xs text-gray-400 py-1">{day}</span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((cell, ci) => (
              <div
                key={ci}
                className={`aspect-square rounded-md flex items-center justify-center text-xs cursor-pointer transition-all ${
                  cell.date
                    ? `${levelColors[cell.level]} ${cell.isToday ? 'ring-2 ring-amber-500 ring-offset-1' : ''} hover:ring-2 hover:ring-amber-400`
                    : ''
                }`}
                title={cell.date ? `${cell.date}: ${cell.count}项` : ''}
                onClick={() => cell.date && onSelectDate(cell.date)}
              >
                {cell.day > 0 && (
                  <span className={cell.level > 0 ? 'text-white font-medium' : 'text-gray-500'}>
                    {cell.day}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Monthly stats */}
      <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-gray-100">
        <div className="text-center">
          <p className="text-lg font-bold text-amber-600">{monthTotal}</p>
          <p className="text-xs text-gray-400">本月总计</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-green-600">{monthCompleted}</p>
          <p className="text-xs text-gray-400">已完成</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-blue-600">{activeDays}</p>
          <p className="text-xs text-gray-400">活跃天数</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-purple-600">{completionRate}%</p>
          <p className="text-xs text-gray-400">完成率</p>
        </div>
      </div>
    </div>
  );
}

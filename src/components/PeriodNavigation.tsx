import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useSummaryStore } from '../hooks/useSummaryStore';
import { PeriodType, PERIOD_LABELS } from '../types';

export function PeriodNavigation() {
  const { currentPeriod, periodType, setPeriodType, goToPrevPeriod, goToNextPeriod, goToToday } = useSummaryStore();

  const periodTypes: PeriodType[] = ['day', 'week', 'month', 'quarter', 'half-year', 'year'];

  const isToday = () => {
    const today = new Date();
    const start = new Date(currentPeriod.startDate);
    const end = new Date(currentPeriod.endDate);
    return today >= start && today <= end;
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-gray-800">时间周期</h3>
        </div>
        {!isToday() && (
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
          >
            今天
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevPeriod}
          className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">{currentPeriod.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {currentPeriod.startDate} ~ {currentPeriod.endDate}
          </p>
        </div>
        
        <button
          onClick={goToNextPeriod}
          className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 justify-center">
        {periodTypes.map((type) => (
          <button
            key={type}
            onClick={() => setPeriodType(type)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
              periodType === type
                ? 'bg-amber-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {PERIOD_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
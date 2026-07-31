import { Grid3x3, AlertTriangle, Target, Clock, MinusCircle } from 'lucide-react';
import { useSummaryStore } from '../hooks/useSummaryStore';
import { EntryItem } from './EntryItem';

const quadrantConfig = [
  {
    id: 'urgent-important',
    title: '紧急且重要',
    icon: AlertTriangle,
    color: 'bg-red-50 border-red-200',
    titleColor: 'text-red-700',
    iconColor: 'text-red-500',
    priorities: ['urgent'],
    types: ['todo'],
  },
  {
    id: 'important-not-urgent',
    title: '重要不紧急',
    icon: Target,
    color: 'bg-orange-50 border-orange-200',
    titleColor: 'text-orange-700',
    iconColor: 'text-orange-500',
    priorities: ['high'],
    types: ['todo'],
  },
  {
    id: 'urgent-not-important',
    title: '紧急不重要',
    icon: Clock,
    color: 'bg-amber-50 border-amber-200',
    titleColor: 'text-amber-700',
    iconColor: 'text-amber-500',
    priorities: ['urgent', 'high'],
    types: ['chat', 'journal', 'idea', 'note'],
  },
  {
    id: 'not-urgent-not-important',
    title: '不紧急不重要',
    icon: MinusCircle,
    color: 'bg-gray-50 border-gray-200',
    titleColor: 'text-gray-700',
    iconColor: 'text-gray-500',
    priorities: ['medium', 'low'],
    types: ['chat', 'journal', 'idea', 'note', 'todo'],
  },
];

export function QuadrantView() {
  const { getPeriodEntries } = useSummaryStore();
  const entries = getPeriodEntries();

  const getQuadrantEntries = (priorities: string[], types: string[]) => {
    return entries.filter(entry => 
      priorities.includes(entry.priority) && types.includes(entry.type)
    );
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Grid3x3 className="w-5 h-5 text-amber-500" />
        <h3 className="font-semibold text-gray-800">四象限视图</h3>
        <span className="text-xs text-gray-400">({entries.length}条)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quadrantConfig.map((quadrant) => {
          const quadrantEntries = getQuadrantEntries(quadrant.priorities, quadrant.types);
          const Icon = quadrant.icon;
          
          return (
            <div key={quadrant.id} className={`rounded-xl border-2 p-3 ${quadrant.color}`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-5 h-5 ${quadrant.iconColor}`} />
                <h4 className={`font-medium text-sm ${quadrant.titleColor}`}>
                  {quadrant.title}
                </h4>
                <span className="text-xs text-gray-500 ml-auto">
                  {quadrantEntries.length}条
                </span>
              </div>
              
              {quadrantEntries.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">暂无内容</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {quadrantEntries.map((entry, index) => (
                    <EntryItem key={`${entry.id}-${index}`} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { Brain, CheckCircle, Circle, TrendingUp, Target, Sparkles, Calendar, AlertCircle } from 'lucide-react';
import { useSummaryStore } from '../hooks/useSummaryStore';
import { useCategories } from '../hooks/useCategories';
import { FILE_TYPE_LABELS, PERIOD_LABELS } from '../types';

const priorityLabels: Record<string, string> = {
  urgent: '紧急且重要',
  high: '重要不紧急',
  medium: '紧急不重要',
  low: '不紧急不重要',
};

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-gray-100 text-gray-700 border-gray-200',
};

export function AIAnalysis() {
  const { getPeriodEntries, currentPeriod, updateEntry, periodType } = useSummaryStore();
  const { categories } = useCategories();
  const [filter, setFilter] = useState<'all' | 'completed' | 'incomplete'>('all');
  const [analyzing, setAnalyzing] = useState(false);

  const entries = getPeriodEntries();

  const getTypeLabel = (type: string): string => {
    const cat = categories.find(c => c.id === type);
    return cat?.label || FILE_TYPE_LABELS[type] || type;
  };

  // 智能分析数据
  const analysis = useMemo(() => {
    const total = entries.length;
    const todos = entries.filter(e => e.type === 'todo');
    const completed = todos.filter(e => e.completed).length;
    const incomplete = todos.filter(e => !e.completed).length;
    const nonTodo = entries.filter(e => e.type !== 'todo').length;

    // 按类型分组统计
    const byType: Record<string, number> = {};
    entries.forEach(e => {
      const type = e.categoryId || e.type;
      byType[type] = (byType[type] || 0) + 1;
    });

    // 按优先级分组
    const todoByPriority: Record<string, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
    todos.forEach(e => { todoByPriority[e.priority]++; });

    // 按日期分组（活跃度分析）
    const byDate: Record<string, number> = {};
    entries.forEach(e => {
      byDate[e.date] = (byDate[e.date] || 0) + 1;
    });
    const activeDays = Object.keys(byDate).length;
    const avgPerDay = activeDays > 0 ? (total / activeDays).toFixed(1) : '0';

    // 最活跃日期
    const topDate = Object.entries(byDate).sort((a, b) => b[1] - a[1])[0];

    // 主要分类
    const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];

    const completionRate = todos.length > 0 ? Math.round((completed / todos.length) * 100) : 0;

    return { total, todos: todos.length, completed, incomplete, nonTodo, byType, todoByPriority, activeDays, avgPerDay, topDate, topType, completionRate };
  }, [entries]);

  // 生成智能总结
  const summary = useMemo(() => {
    const periodLabel = PERIOD_LABELS[currentPeriod.type] || '周期';
    const lines: string[] = [];

    lines.push(`【${currentPeriod.title} 智能分析报告】`);
    lines.push('');
    lines.push(`本${periodLabel}共记录 ${analysis.total} 条内容，活跃 ${analysis.activeDays} 天，日均 ${analysis.avgPerDay} 条。`);
    lines.push(`其中待办事项 ${analysis.todos} 项（已完成 ${analysis.completed} 项，未完成 ${analysis.incomplete} 项），完成率 ${analysis.completionRate}%。`);

    if (analysis.topType) {
      lines.push(`主要活动集中在「${getTypeLabel(analysis.topType[0])}」，共 ${analysis.topType[1]} 条，占比 ${Math.round(analysis.topType[1] / analysis.total * 100)}%。`);
    }

    if (analysis.todoByPriority.urgent > 0) {
      lines.push(`紧急事项 ${analysis.todoByPriority.urgent} 项，重要事项 ${analysis.todoByPriority.high} 项。`);
    }

    if (analysis.topDate) {
      lines.push(`最活跃日期为 ${analysis.topDate[0]}，记录了 ${analysis.topDate[1]} 条内容。`);
    }

    if (analysis.completionRate >= 80) {
      lines.push(`整体完成率优秀，执行力强。`);
    } else if (analysis.completionRate >= 50) {
      lines.push(`完成率中等，仍有提升空间。`);
    } else if (analysis.todos > 0) {
      lines.push(`完成率偏低，建议优先处理未完成事项。`);
    }

    return lines.join('\n');
  }, [analysis, currentPeriod, categories]);

  // 生成下期计划
  const nextPlan = useMemo(() => {
    const incompleteTodos = entries.filter(e => e.type === 'todo' && !e.completed);
    const lines: string[] = [];
    const nextLabel = PERIOD_LABELS[currentPeriod.type] || '周期';

    lines.push(`【下一${nextLabel} 计划建议】`);
    lines.push('');

    if (incompleteTodos.length > 0) {
      const sorted = [...incompleteTodos].sort((a, b) => {
        const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        return order[a.priority] - order[b.priority];
      });

      lines.push(`需跟进未完成事项 ${sorted.length} 项：`);
      sorted.slice(0, 8).forEach((todo, i) => {
        const priorityTag = `[${priorityLabels[todo.priority]}]`;
        lines.push(`${i + 1}. ${priorityTag} ${todo.content.substring(0, 60)}`);
      });
      if (sorted.length > 8) {
        lines.push(`...及其他 ${sorted.length - 8} 项。`);
      }
    } else if (analysis.todos > 0) {
      lines.push('本期所有待办事项均已完成，建议规划新的目标。');
    } else {
      lines.push('本期无待办事项，建议增加行动类记录以提升执行力。');
    }

    // 基于分析给出建议
    if (analysis.todoByPriority.urgent > 0) {
      const urgentIncomplete = entries.filter(e => e.type === 'todo' && !e.completed && e.priority === 'urgent').length;
      if (urgentIncomplete > 0) {
        lines.push('');
        lines.push(`⚠️ 有 ${urgentIncomplete} 项紧急未完成事项，建议优先处理。`);
      }
    }

    if (analysis.completionRate < 50 && analysis.todos > 3) {
      lines.push('');
      lines.push('建议：减少待办数量，集中精力完成关键任务。');
    }

    return lines.join('\n');
  }, [entries, analysis, currentPeriod]);

  // 过滤显示的待办
  const filteredTodos = useMemo(() => {
    const todos = entries.filter(e => e.type === 'todo');
    if (filter === 'completed') return todos.filter(e => e.completed);
    if (filter === 'incomplete') return todos.filter(e => !e.completed);
    return todos;
  }, [entries, filter]);

  const handleToggleComplete = async (entryId: string, completed: boolean) => {
    await updateEntry(entryId, { completed: !completed });
  };

  const handleAnalyze = () => {
    setAnalyzing(true);
    setTimeout(() => setAnalyzing(false), 1500);
  };

  if (entries.length === 0) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 text-center">
        <Brain className="w-10 h-10 text-amber-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">当前周期暂无记录数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 智能分析报告 */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-gray-800">AI 智能分析</h3>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {analyzing ? '分析中...' : '重新分析'}
          </button>
        </div>

        {/* 核心指标 */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-amber-50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-amber-600">{analysis.total}</p>
            <p className="text-xs text-amber-600/70">总记录</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-green-600">{analysis.completed}</p>
            <p className="text-xs text-green-600/70">已完成</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-orange-600">{analysis.incomplete}</p>
            <p className="text-xs text-orange-600/70">未完成</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-blue-600">{analysis.completionRate}%</p>
            <p className="text-xs text-blue-600/70">完成率</p>
          </div>
        </div>

        {/* 总结文本 */}
        <div className="bg-gray-50 rounded-xl p-3 mb-3">
          <div className="flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{summary}</pre>
          </div>
        </div>

        {/* 下期计划 */}
        <div className="bg-blue-50 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <Target className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{nextPlan}</pre>
          </div>
        </div>
      </div>

      {/* 完成/未完成标签筛选 */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-gray-800">待办事项跟踪</h3>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === 'all' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              全部 ({analysis.todos})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === 'completed' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              已完成 ({analysis.completed})
            </button>
            <button
              onClick={() => setFilter('incomplete')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === 'incomplete' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              未完成 ({analysis.incomplete})
            </button>
          </div>
        </div>

        {/* 待办列表 */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredTodos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">暂无相关待办事项</p>
          ) : (
            filteredTodos.map((todo) => (
              <div
                key={todo.id}
                className={`flex items-start gap-2 p-2 rounded-lg transition-colors ${
                  todo.completed ? 'bg-green-50' : 'bg-gray-50'
                }`}
              >
                <button
                  onClick={() => handleToggleComplete(todo.id, todo.completed || false)}
                  className="flex-shrink-0 mt-0.5"
                >
                  {todo.completed ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400 hover:text-amber-500" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm text-gray-700 ${todo.completed ? 'line-through opacity-60' : ''}`}>
                    {todo.content}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${priorityColors[todo.priority]}`}>
                      {priorityLabels[todo.priority]}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {todo.date} {todo.time || ''}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 汇总统计 */}
        {filter !== 'all' && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span>
                {filter === 'completed'
                  ? `共 ${analysis.completed} 项已完成，完成率 ${analysis.completionRate}%`
                  : `共 ${analysis.incomplete} 项未完成，建议优先处理紧急事项`}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
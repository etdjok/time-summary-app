import { useState, useEffect } from 'react';
import { Settings, Cloud, ExternalLink, HelpCircle, Tags, Clock, Download, Upload, List, Grid3x3, Calendar, Brain, CheckSquare, Lock } from 'lucide-react';
import { version } from '../../package.json';
import { PeriodNavigation } from '../components/PeriodNavigation';
import { StatsCard } from '../components/StatsCard';
import { SummaryList } from '../components/SummaryList';
import { QuickRecord } from '../components/QuickRecord';
import { NutstoreConfig } from '../components/NutstoreConfig';
import { CategoryManager } from '../components/CategoryManager';
import { HelpPage } from '../components/HelpPage';
import { Changelog } from '../components/Changelog';
import { QuadrantView } from '../components/QuadrantView';
import { HeatmapView } from '../components/HeatmapView';
import { AIAnalysis } from '../components/AIAnalysis';
import { HabitTracker } from '../components/HabitTracker';
import { useSummaryStore } from '../hooks/useSummaryStore';
import { hasCredentials } from '../lib/nutstore';
import { hasSessionMK, hasLocalEncryptionKeys } from '../lib/crypto';
import { getPeriodForDate } from '../lib/dateUtils';
import { syncCategoriesFromNutstore } from '../hooks/useCategories';

type ViewMode = 'list' | 'quadrant' | 'heatmap' | 'habits' | 'ai';

const VIEW_TABS: { mode: ViewMode; label: string; shortLabel: string; icon: typeof List }[] = [
  { mode: 'list', label: '列表', shortLabel: '列表', icon: List },
  { mode: 'quadrant', label: '四象限', shortLabel: '象限', icon: Grid3x3 },
  { mode: 'heatmap', label: '热力图', shortLabel: '热图', icon: Calendar },
  { mode: 'habits', label: '打卡', shortLabel: '打卡', icon: CheckSquare },
  { mode: 'ai', label: 'AI分析', shortLabel: 'AI', icon: Brain },
];

export default function Home() {
  const [showConfig, setShowConfig] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  // v2.3.2 修复：加密已启用但本会话未解锁时，读写云端加密数据会静默失败，
  // 表现为"输入内容点发送没反应"。用醒目横幅引导用户解锁，而不是等发送失败。
  const [cryptoLocked, setCryptoLocked] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const { loadEntries, entries } = useSummaryStore();

  const checkCryptoLock = (connected: boolean) => {
    setCryptoLocked(connected && hasLocalEncryptionKeys() && !hasSessionMK());
  };

  useEffect(() => {
    const connected = hasCredentials();
    setIsConnected(connected);
    checkCryptoLock(connected);

    if (connected) {
      loadEntries();
      // v1.18: 从坚果云同步分类配置
      syncCategoriesFromNutstore();
    }
  }, [loadEntries]);

  const handleExport = () => {
    const data = {
      version: '1.15',
      exportDate: new Date().toISOString(),
      entries: entries,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `心光 - 导出-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.entries && Array.isArray(data.entries)) {
            alert(`导入成功！共 ${data.entries.length} 条记录。\n注意：导入功能需要手动将数据同步到坚果云。`);
          } else {
            alert('文件格式不正确');
          }
        } catch {
          alert('文件解析失败');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleTypeClick = (type: string) => {
    setTypeFilter(type);
    setViewMode('list');
  };

  const handleSelectDate = (date: string) => {
    // 切换到该日的 day 视图，让列表展示该日条目
    const { setPeriodType, setCurrentPeriod } = useSummaryStore.getState();
    const targetDate = new Date(date + 'T00:00:00');
    if (!isNaN(targetDate.getTime())) {
      setPeriodType('day');
      setCurrentPeriod(getPeriodForDate(targetDate, 'day'));
    }
    setViewMode('list');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <div className="max-w-2xl lg:max-w-6xl mx-auto px-3 py-4 lg:px-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-800">心光</h1>
            <span className="text-xs text-gray-400">v{version}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExport}
              className="p-2.5 rounded-xl bg-white text-gray-500 hover:text-amber-500 hover:bg-amber-50 shadow-sm transition-all"
              title="导出数据"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={handleImport}
              className="p-2.5 rounded-xl bg-white text-gray-500 hover:text-amber-500 hover:bg-amber-50 shadow-sm transition-all"
              title="导入数据"
            >
              <Upload className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowHelp(true)}
              className="p-2.5 rounded-xl bg-white text-gray-500 hover:text-amber-500 hover:bg-amber-50 shadow-sm transition-all"
              title="帮助"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowChangelog(true)}
              className="p-2.5 rounded-xl bg-white text-gray-500 hover:text-amber-500 hover:bg-amber-50 shadow-sm transition-all"
              title="更新日志"
            >
              <Clock className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowCategoryManager(true)}
              className="p-2.5 rounded-xl bg-white text-gray-500 hover:text-amber-500 hover:bg-amber-50 shadow-sm transition-all"
              title="分类管理"
            >
              <Tags className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowConfig(true)}
              className={`p-2.5 rounded-xl transition-all ${
                isConnected
                  ? 'bg-green-100 text-green-600 hover:bg-green-200'
                  : 'bg-white text-gray-500 hover:text-amber-500 hover:bg-amber-50 shadow-sm'
              }`}
              title="坚果云设置"
            >
              {isConnected ? (
                <Cloud className="w-5 h-5" />
              ) : (
                <Settings className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* 桌面双栏：左侧录入+统计固定，右侧内容区；移动端保持上下单列 */}
        <div className="lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-6 lg:items-start">
          {/* 左栏 */}
          <div className="lg:sticky lg:top-4">
            {!isConnected && (
              <div className="bg-white rounded-xl shadow p-4 mb-3 text-center">
                <Cloud className="w-12 h-12 text-amber-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">连接坚果云</h3>
                <p className="text-sm text-gray-500 mb-4">
                  连接坚果云后，自动读取你在 files.md 中记录的内容，按时间周期汇总展示
                </p>
                <button
                  onClick={() => setShowConfig(true)}
                  className="px-6 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium text-sm"
                >
                  立即配置
                </button>
              </div>
            )}

            {isConnected && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-3 flex items-center gap-2">
                <Cloud className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700">坚果云已连接</p>
                  <p className="text-xs text-green-600/70">自动同步 files.md 笔记</p>
                </div>
                <a
                  href="https://app.files.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-amber-600 bg-white rounded-lg hover:bg-amber-50 transition-colors"
                >
                  打开 files.md
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {cryptoLocked && (
              <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 mb-3 flex items-center gap-3">
                <Lock className="w-5 h-5 text-orange-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-700">加密会话未解锁</p>
                  <p className="text-xs text-orange-600/80 leading-relaxed">
                    云端笔记为加密格式，解锁前无法读取和保存。输入加密密码即可恢复。
                  </p>
                </div>
                <button
                  onClick={() => setShowConfig(true)}
                  className="px-3 py-1.5 text-xs text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors font-medium flex-shrink-0"
                >
                  解锁
                </button>
              </div>
            )}

            {isConnected && <QuickRecord />}

            <div className="mb-4">
              <PeriodNavigation />
              <StatsCard onTypeClick={handleTypeClick} compact={true} />
            </div>
          </div>

          {/* 右栏：视图内容 */}
          <div className="min-w-0">
            <div className="flex items-center gap-1 bg-white rounded-xl shadow-sm p-1 mb-4">
              {VIEW_TABS.map(({ mode, label, shortLabel, icon: Icon }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-medium transition-all ${
                    viewMode === mode
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-gray-500 hover:bg-amber-50 hover:text-amber-600'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{shortLabel}</span>
                </button>
              ))}
            </div>

            {viewMode === 'list' && <SummaryList initialTypeFilter={typeFilter} />}
            {viewMode === 'quadrant' && <QuadrantView />}
            {viewMode === 'heatmap' && <HeatmapView onSelectDate={handleSelectDate} />}
            {viewMode === 'habits' && <HabitTracker />}
            {viewMode === 'ai' && <AIAnalysis />}
          </div>
        </div>

        <div className="text-center mt-8 pb-6">
          <p className="text-xs text-gray-400">
            数据来自坚果云 · 仅读取不修改 · 隐私安全
          </p>
        </div>
      </div>

      {showConfig && (
        <NutstoreConfig
          onClose={() => {
            setShowConfig(false);
            const connected = hasCredentials();
            setIsConnected(connected);
            checkCryptoLock(connected);
            // v2.3.1 修复：设置窗口内可能刚完成加密解锁/凭据恢复，
            // 关闭时统一重新拉取数据，避免页面停留在解锁前的空列表
            if (connected) {
              loadEntries();
              syncCategoriesFromNutstore();
            }
          }}
        />
      )}

      {showCategoryManager && (
        <CategoryManager onClose={() => setShowCategoryManager(false)} />
      )}

      {showHelp && (
        <HelpPage onClose={() => setShowHelp(false)} />
      )}

      {showChangelog && (
        <Changelog onClose={() => setShowChangelog(false)} />
      )}
    </div>
  );
}


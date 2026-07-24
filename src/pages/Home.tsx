import { useState, useEffect } from 'react';
import { Settings, Cloud, ExternalLink, HelpCircle, Tags, Clock } from 'lucide-react';
import { PeriodNavigation } from '../components/PeriodNavigation';
import { StatsCard } from '../components/StatsCard';
import { SummaryList } from '../components/SummaryList';
import { QuickRecord } from '../components/QuickRecord';
import { NutstoreConfig } from '../components/NutstoreConfig';
import { CategoryManager } from '../components/CategoryManager';
import { HelpPage } from '../components/HelpPage';
import { Changelog } from '../components/Changelog';
import { useSummaryStore } from '../hooks/useSummaryStore';
import { hasCredentials } from '../lib/nutstore';

export default function Home() {
  const [showConfig, setShowConfig] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { loadEntries } = useSummaryStore();

  useEffect(() => {
    const connected = hasCredentials();
    setIsConnected(connected);

    if (connected) {
      loadEntries();
    }
  }, [loadEntries]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">心光</h1>
            <p className="text-sm text-gray-500 mt-0.5">v1.0 · 你的时光记录与思考空间</p>
          </div>
          <div className="flex items-center gap-1.5">
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

        {!isConnected && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-4 text-center">
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
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 flex items-center gap-3">
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

        {isConnected && <QuickRecord />}

        <PeriodNavigation />
        <StatsCard />
        <SummaryList />

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
            setIsConnected(hasCredentials());
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

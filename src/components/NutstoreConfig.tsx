import { useState, useEffect } from 'react';
import { Settings, X, Check, AlertCircle, FolderOpen, ChevronRight } from 'lucide-react';
import { saveCredentials, clearCredentials, hasCredentials, testConnectionWithDetails, listRootFolders, getCredentials } from '../lib/nutstore';
import { useSummaryStore } from '../hooks/useSummaryStore';

interface NutstoreConfigProps {
  onClose: () => void;
}

export function NutstoreConfig({ onClose }: NutstoreConfigProps) {
  const { nutstoreBasePath, setNutstoreBasePath, loadEntries } = useSummaryStore();
  const existing = getCredentials();
  const [username, setUsername] = useState(existing?.username || '');
  const [password, setPassword] = useState(existing?.password || '');
  const [basePath, setBasePath] = useState(nutstoreBasePath);

  // 组件挂载时再次回填（防止 localStorage 在会话中更新后未同步）
  useEffect(() => {
    const creds = getCredentials();
    if (creds) {
      if (!username) setUsername(creds.username);
      if (!password) setPassword(creds.password);
    }
  }, []);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isConnected, setIsConnected] = useState(hasCredentials());
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [basePathFiles, setBasePathFiles] = useState<string[]>([]);
  const [basePathFolders, setBasePathFolders] = useState<string[]>([]);
  const [pathResults, setPathResults] = useState<{ path: string; status: number; files: string[]; folders: string[] }[]>([]);
  const [showFolders, setShowFolders] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const handleLoadFolders = async () => {
    if (!username || !password) {
      setResult({ success: false, message: '请先输入账号和密码' });
      return;
    }
    
    saveCredentials(username, password);
    setShowFolders(!showFolders);
    
    if (!showFolders) {
      setResult({ success: true, message: '正在获取云端文件夹列表...' });
      const result = await listRootFolders();
      if (result.success) {
        setAvailableFolders(result.folders);
        setResult({ success: true, message: `找到 ${result.folders.length} 个文件夹` });
      } else {
        setResult({ success: false, message: result.error || '获取文件夹失败' });
      }
    }
  };

  const handleSaveAndTest = async () => {
    if (!username || !password) {
      setResult({ success: false, message: '请输入账号和应用密码' });
      return;
    }

    setTesting(true);
    setResult(null);

    saveCredentials(username, password);
    setNutstoreBasePath(basePath);

    const testResult = await testConnectionWithDetails(basePath);

    if (testResult.rootFolders) {
      setAvailableFolders(testResult.rootFolders);
    }
    if (testResult.basePathFiles) {
      setBasePathFiles(testResult.basePathFiles);
    }
    if (testResult.basePathFolders) {
      setBasePathFolders(testResult.basePathFolders);
    }
    if (testResult.pathResults) {
      setPathResults(testResult.pathResults);
    }
    setShowDebug(true);

    if (testResult.success) {
      setResult({ success: true, message: '坚果云已连接，正在读取数据...' });
      setIsConnected(true);
      
      try {
        await loadEntries();
      } catch (e) {
        console.error('加载数据失败:', e);
      }
      
      const store = await import('../hooks/useSummaryStore').then(m => m.useSummaryStore.getState());
      if (store.error) {
        setResult({ success: false, message: store.error });
        setTesting(false);
        return;
      }
      
      setResult({ success: true, message: `坚果云已连接，读取到 ${store.entries.length} 条记录` });
      setTesting(false);
      setTimeout(onClose, 1000);
    } else {
      setTesting(false);
      setResult({ success: false, message: testResult.error || '连接失败' });
      if (testResult.status === 401) {
        clearCredentials();
        setIsConnected(false);
      }
    }
  };

  const handleDisconnect = () => {
    clearCredentials();
    setIsConnected(false);
    setResult({ success: false, message: '已断开连接' });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-gray-800">坚果云配置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {isConnected && (
            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-xl text-sm">
              <Check className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-medium">坚果云已连接</p>
                <p className="text-xs text-green-600/70">数据将通过坚果云同步</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              坚果云账号
            </label>
            <input
              type="email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="wxpemail@163.com"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-amber-400 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              应用密码
              <span className="text-xs text-gray-400 font-normal ml-1">
                （不是登录密码）
              </span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="第三方应用密码"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-amber-400 transition-colors text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              在坚果云设置 → 安全选项 → 第三方应用管理中获取
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
              <FolderOpen className="w-4 h-4" />
              同步目录
            </label>
            <input
              type="text"
              value={basePath}
              onChange={(e) => setBasePath(e.target.value)}
              placeholder="/笔记"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-amber-400 transition-colors text-sm"
            />
            <div className="mt-2">
              <button
                onClick={handleLoadFolders}
                className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
              >
                <ChevronRight className={`w-3 h-3 transition-transform ${showFolders ? 'rotate-90' : ''}`} />
                选择云端文件夹 ({availableFolders.length}个)
              </button>
              {showFolders && availableFolders.length > 0 && (
                <div className="mt-2 space-y-1">
                  {availableFolders.map((folder) => (
                    <button
                      key={folder}
                      onClick={() => {
                        setBasePath(`/${folder}`);
                        setShowFolders(false);
                      }}
                      className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 bg-gray-50 rounded-lg hover:bg-amber-50 hover:text-amber-700 transition-colors"
                    >
                      /{folder}
                    </button>
                  ))}
                </div>
              )}
              {showFolders && availableFolders.length === 0 && (
                <p className="mt-2 text-xs text-gray-400">暂无可用文件夹，请先在坚果云中创建</p>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              files.md 笔记文件夹在坚果云中的路径
            </p>
          </div>

          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
              result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {result.success ? (
                <Check className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <span>{result.message}</span>
            </div>
          )}

          {showDebug && (
            <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-2">
              <p className="font-medium text-gray-600">调试信息</p>
              <div>
                <p className="text-gray-500">当前路径: <span className="text-gray-800">{basePath}</span></p>
                <p className="text-gray-500">根目录文件夹: <span className="text-gray-800">{availableFolders.join(', ') || '无'}</span></p>
                <p className="text-gray-500">当前路径下文件: <span className="text-gray-800">{basePathFiles.join(', ') || '无'}</span></p>
                <p className="text-gray-500">当前路径下子文件夹: <span className="text-gray-800">{basePathFolders.join(', ') || '无'}</span></p>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2">
                <p className="font-medium text-gray-600">路径探测结果</p>
                {pathResults.map((pr) => (
                  <div key={pr.path} className="mt-1">
                    <p className="text-gray-500">
                      路径 {pr.path} (状态{pr.status}):
                      <span className="text-gray-800"> 文件[{pr.files.join(', ') || '无'}] 文件夹[{pr.folders.join(', ') || '无'}]</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2">
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              className="flex-1 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-medium text-sm"
            >
              断开连接
            </button>
          ) : null}
          <button
            onClick={handleSaveAndTest}
            disabled={testing}
            className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? '测试中...' : isConnected ? '保存并测试' : '保存并连接'}
          </button>
        </div>
      </div>
    </div>
  );
}
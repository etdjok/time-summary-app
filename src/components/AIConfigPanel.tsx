import { useState, useEffect } from "react";
import { X, Settings, Key, Link, Cpu, CheckCircle, AlertCircle, Eye, EyeOff, Loader2, Database } from "lucide-react";
import { saveAIConfig, getAIConfig, clearAIConfig, hasAIConfig } from "../lib/aiSecurity";
import { testAIConnection, getAIModels } from "../lib/aiClient";

interface AIConfigPanelProps {
  onClose: () => void;
  onConfigChange: () => void;
}

export function AIConfigPanel({ onClose, onConfigChange }: AIConfigPanelProps) {
  const [provider, setProvider] = useState<string>("volcengine");
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [model, setModel] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [availableModels, setAvailableModels] = useState<Array<{ provider: string; name: string; label: string }>>([]);

  useEffect(() => {
    const config = getAIConfig();
    if (config) {
      setProvider(config.provider);
      setApiKey(config.apiKey);
      setEndpoint(config.endpoint);
      setModel(config.model);
      setEnabled(config.enabled);
    }
    loadModels();
  }, []);

  const loadModels = async () => {
        const modelStrings = await getAIModels();
    // 后端返回的是对象数组，前端兼容处理
    const models = modelStrings.map((m: string | {provider: string; name: string; label: string}) => {
      if (typeof m === 'string') {
        return { provider: 'custom', name: m, label: m };
      }
      return m;
    });
    setAvailableModels(models);
  };

  const getDefaultEndpoint = (p: string) => {
    switch (p) {
      case "volcengine": return "https://ark.cn-beijing.volces.com/api/v3";
      case "doubao": return "https://ark.cn-beijing.volces.com/api/v3";
      case "qwen": return "https://dashscope.aliyuncs.com/compatible-mode/v1";
      default: return "";
    }
  };

  const handleProviderChange = (p: string) => {
    setProvider(p);
    setEndpoint(getDefaultEndpoint(p));
    setAvailableModels([]);
    loadModels();
  };

  const handleTest = async () => {
    if (!apiKey || !endpoint || !model) {
      setTestResult({ success: false, message: "请填写完整配置" });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await testAIConnection({
        provider,
        apiKey,
        endpoint,
        model,
        enabled,
        createdAt: new Date().toISOString(),
      });
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "测试失败",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!apiKey || !endpoint || !model) {
      alert("请填写完整的 AI 配置信息");
      return;
    }

    saveAIConfig({
      provider,
      apiKey,
      endpoint,
      model,
      enabled,
      createdAt: new Date().toISOString(),
    });

    onConfigChange();
    onClose();
  };

  const handleClear = () => {
    if (confirm("确定要清除所有 AI 配置和聊天历史吗？")) {
      clearAIConfig();
      onConfigChange();
      onClose();
    }
  };

  const filteredModels = availableModels.filter(m => m.provider === provider || provider === "custom");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-amber-500 to-orange-500">
          <div className="flex items-center gap-2 text-white">
            <Cpu className="w-5 h-5" />
            <h3 className="font-semibold">AI 助手配置</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 服务提供商 */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
              <Database className="w-4 h-4" />
              AI 服务提供商
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "volcengine", label: "火山引擎" },
                { value: "qwen", label: "通义千问" },
                { value: "doubao", label: "豆包" },
                { value: "custom", label: "自定义" },
              ] as const).map((p) => (
                <button
                  key={p.value}
                  onClick={() => handleProviderChange(p.value)}
                  className={`py-2 px-3 text-sm rounded-lg border transition-all ${
                    provider === p.value
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-amber-50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* API 端点 */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
              <Link className="w-4 h-4" />
              API 端点
            </label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
              <Key className="w-4 h-4" />
              API Key
              <span className="text-xs text-gray-400 ml-1">(加密存储)</span>
            </label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="输入你的 API Key"
                className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 模型选择 */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
              <Cpu className="w-4 h-4" />
              模型
            </label>
            {filteredModels.length > 0 ? (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400"
              >
                <option value="">选择模型</option>
                {filteredModels.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.label} ({m.name})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="输入模型名称，如 gpt-4o"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400"
              />
            )}
          </div>

          {/* 启用开关 */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">启用 AI 助手</span>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`w-12 h-6 rounded-full transition-colors ${
                enabled ? "bg-amber-500" : "bg-gray-300"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* 测试连接 */}
          <div className="pt-2 border-t">
            <button
              onClick={handleTest}
              disabled={testing}
              className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  测试中...
                </>
              ) : (
                <>测试连接</>
              )}
            </button>
            {testResult && (
              <div className={`mt-2 p-2 rounded-lg text-sm flex items-center gap-2 ${
                testResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}>
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {testResult.message}
              </div>
            )}
          </div>

          {/* 安全提示 */}
          <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-700">
            <p className="font-medium mb-1">🔒 安全提示</p>
            <p>你的 API Key 将被加密存储在本地，数据通过代理转发，不会直接暴露给第三方。</p>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex gap-2">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-gray-500 hover:text-red-500 text-sm"
          >
            清除配置
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}


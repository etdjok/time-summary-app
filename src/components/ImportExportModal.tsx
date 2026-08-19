import { useState } from 'react';
import { X, Download, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useSummaryStore } from '../hooks/useSummaryStore';
import { getCredentialsAsync } from '../lib/nutstore';

interface ImportExportModalProps {
  onClose: () => void;
}

export function ImportExportModal({ onClose }: ImportExportModalProps) {
  const { entries, loadEntries, nutstoreBasePath } = useSummaryStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const handleExport = async (format: 'json' | 'markdown') => {
    setIsExporting(true);
    setMessage('');
    try {
      let content = '';
      let filename = '';
      let mimeType = '';

      if (format === 'json') {
        content = JSON.stringify(entries, null, 2);
        filename = `xinguang-export-${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      } else {
        // Group by date
        const grouped: Record<string, typeof entries> = {};
        entries.forEach(e => {
          if (!grouped[e.date]) grouped[e.date] = [];
          grouped[e.date].push(e);
        });

        const lines: string[] = [];
        lines.push('# 心光数据导出');
        lines.push(`导出时间: ${new Date().toLocaleString('zh-CN')}`);
        lines.push('');

        for (const [date, dateEntries] of Object.entries(grouped).sort()) {
          lines.push(`## ${date}`);
          lines.push('');
          for (const entry of dateEntries) {
            const time = entry.time ? `${entry.time} ` : '';
            const typeLabel = entry.type === 'todo' ? '- [ ] ' : '';
            lines.push(`${typeLabel}${time}${entry.content}`);
          }
          lines.push('');
        }

        content = lines.join('\n');
        filename = `xinguang-export-${new Date().toISOString().split('T')[0]}.md`;
        mimeType = 'text/markdown';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setMessage(`成功导出 ${entries.length} 条记录`);
      setMessageType('success');
    } catch (err) {
      setMessage('导出失败: ' + (err instanceof Error ? err.message : '未知错误'));
      setMessageType('error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setMessage('');

    try {
      const text = await file.text();
      const creds = await getCredentialsAsync();
      if (!creds) {
        setMessage('请先配置坚果云账号');
        setMessageType('error');
        setIsImporting(false);
        return;
      }

      let importedCount = 0;

      if (file.name.endsWith('.json')) {
        // JSON import
        const importedEntries = JSON.parse(text);
        if (!Array.isArray(importedEntries)) {
          throw new Error('JSON 格式错误：应为数组');
        }

        for (const entry of importedEntries) {
          const content = entry.content || '';
          if (!content.trim()) continue;

          const now = new Date(entry.date || new Date());
          const timeStr = entry.time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          const type = entry.type || 'chat';

          let formattedContent = `${timeStr} ${content}`;
          if (type === 'todo') {
            formattedContent = `- [ ] ${formattedContent}`;
          }

          const target = type === 'todo' ? 'todo' : type === 'journal' ? 'journal' : 'chat';
          const { addEntry } = useSummaryStore.getState();
          const success = await addEntry(content, target);
          if (success) importedCount++;
        }
      } else if (file.name.endsWith('.md')) {
        // Markdown import - parse lines
        const lines = text.split('\n');
        const { addEntry } = useSummaryStore.getState();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('##')) continue;

          // Skip metadata lines
          if (trimmed.startsWith('导出时间:')) continue;

          let content = trimmed;
          let type: 'chat' | 'todo' | 'journal' = 'chat';

          if (content.startsWith('- [ ] ') || content.startsWith('- [x] ')) {
            content = content.replace(/^[-*]\s*\[[x ]\]\s*/, '');
            type = 'todo';
          }

          // Remove time prefix for import
          content = content.replace(/^\d{1,2}:\d{2}\s*-?\s*/, '');

          if (content.trim()) {
            const success = await addEntry(content.trim(), type);
            if (success) importedCount++;
          }
        }
      } else {
        throw new Error('不支持的文件格式，请使用 .json 或 .md 文件');
      }

      setMessage(`成功导入 ${importedCount} 条记录`);
      setMessageType('success');
      loadEntries();
    } catch (err) {
      setMessage('导入失败: ' + (err instanceof Error ? err.message : '未知错误'));
      setMessageType('error');
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">导入导出</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 导出 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Download className="w-4 h-4" /> 导出数据
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('json')}
                disabled={isExporting || entries.length === 0}
                className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                导出 JSON
              </button>
              <button
                onClick={() => handleExport('markdown')}
                disabled={isExporting || entries.length === 0}
                className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                导出 Markdown
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">共 {entries.length} 条记录</p>
          </div>

          {/* 导入 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Upload className="w-4 h-4" /> 导入数据
            </h3>
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-colors">
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600">选择 JSON 或 Markdown 文件</span>
              <input
                type="file"
                accept=".json,.md"
                onChange={handleImport}
                disabled={isImporting}
                className="hidden"
              />
            </label>
            <p className="text-xs text-gray-400 mt-1">支持 .json 和 .md 格式</p>
          </div>

          {/* 消息提示 */}
          {message && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              messageType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {messageType === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {message}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors font-medium text-sm"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

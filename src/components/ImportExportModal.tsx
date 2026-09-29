import { useState } from 'react';
import { X, Download, Upload, FileText, CheckCircle, AlertCircle, MessageSquare, BookOpen, CheckCircle as CheckCircleIcon, Lightbulb, FileText as NoteIcon } from 'lucide-react';
import { useSummaryStore } from '../hooks/useSummaryStore';
import { getCredentialsAsync, writeDocument } from '../lib/nutstore';

interface ImportExportModalProps {
  onClose: () => void;
}

// 导入分类选项
const IMPORT_CATEGORIES = [
  { id: 'chat', label: '聊天', icon: MessageSquare, color: 'bg-blue-500' },
  { id: 'journal', label: '日记', icon: BookOpen, color: 'bg-green-500' },
  { id: 'todo', label: '待办', icon: CheckCircleIcon, color: 'bg-amber-500' },
  { id: 'idea', label: '想法', icon: Lightbulb, color: 'bg-pink-500' },
  { id: 'note', label: '笔记', icon: NoteIcon, color: 'bg-purple-500' },
] as const;

type ImportCategory = typeof IMPORT_CATEGORIES[number]['id'];

export function ImportExportModal({ onClose }: ImportExportModalProps) {
  const { entries, loadEntries } = useSummaryStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [importCategory, setImportCategory] = useState<ImportCategory>('chat');
  const [importMode, setImportMode] = useState<'document' | 'split'>('document');

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

  // v2.4.2 独立文档导入：逐文件写入云端《文档》，单文件失败不影响其他
  const importAsDocuments = async (allFiles: File[]) => {
    const { nutstoreBasePath } = useSummaryStore.getState();
    const usedNames: string[] = [];
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const f of allFiles) {
      if (!f.name.endsWith('.md') && !f.name.endsWith('.markdown') && !f.name.endsWith('.txt')) {
        failed.push(`${f.name}（独立文档模式仅支持 .md/.markdown/.txt）`);
        continue;
      }
      const text = await f.text();
      const result = await writeDocument(nutstoreBasePath, f.name, text, usedNames);
      if (result.success && result.fileName) {
        succeeded.push(f.name === result.fileName ? f.name : `${f.name} → ${result.fileName}`);
        usedNames.push(result.fileName);
      } else {
        failed.push(`${f.name}（${result.error || '未知错误'}）`);
      }
    }

    const summary: string[] = [];
    if (succeeded.length > 0) summary.push(`已存入文档库 ${succeeded.length} 个文件：\n${succeeded.join('\n')}`);
    if (failed.length > 0) summary.push(`失败 ${failed.length} 个：\n${failed.join('\n')}`);
    setMessage(summary.join('\n\n'));
    setMessageType(succeeded.length > 0 ? 'success' : 'error');
    loadEntries();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length === 0) return;
    const file = fileList[0];

    setIsImporting(true);
    setMessage('');

    try {
      const creds = await getCredentialsAsync();
      if (!creds) {
        setMessage('请先配置坚果云账号');
        setMessageType('error');
        return;
      }

      const isMdTxt = (name: string) =>
        name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt');

      // 独立文档模式：整篇原文保存到云端《文档》目录
      if (importMode === 'document') {
        await importAsDocuments(fileList);
        return;
      }

      const text = await file.text();
      let importedCount = 0;

      if (file.name.endsWith('.json')) {
        // JSON import - 使用原始分类，忽略分类选择器
        const importedEntries = JSON.parse(text);
        if (!Array.isArray(importedEntries)) {
          throw new Error('JSON 格式错误：应为数组');
        }

        for (const entry of importedEntries) {
          const content = entry.content || '';
          if (!content.trim()) continue;

          const type = entry.type || 'chat';
          const target = type === 'todo' ? 'todo' : type === 'journal' ? 'journal' : type === 'idea' ? 'idea' : type === 'note' ? 'note' : 'chat';
          const { addEntry } = useSummaryStore.getState();
          const success = await addEntry(content, target);
          if (success) importedCount++;
        }
      } else if (isMdTxt(file.name)) {
        // Markdown/TXT import - 使用用户选择的分类
        const lines = text.split('\n');
        const { addEntry } = useSummaryStore.getState();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('##')) continue;

          // Skip metadata lines
          if (trimmed.startsWith('导出时间:')) continue;

          let content = trimmed;

          // 检测待办格式（如果文件中有 - [ ] 格式，自动识别为待办）
          let detectedType = importCategory;
          if (content.startsWith('- [ ] ') || content.startsWith('- [x] ')) {
            content = content.replace(/^[-*]\s*\[[x ]\]\s*/, '');
            detectedType = 'todo';
          }

          // Remove time prefix for import
          content = content.replace(/^\d{1,2}:\d{2}\s*-?\s*/, '');
          content = content.replace(/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{2}\s*/, '');

          if (content.trim()) {
            const success = await addEntry(content.trim(), detectedType);
            if (success) importedCount++;
          }
        }
      } else {
        throw new Error(`不支持的文件格式: ${file.name}，请使用 .json、.md 或 .txt 文件`);
      }

      setMessage(`成功导入 ${importedCount} 条记录\n文件名: ${file.name}`);
      setMessageType('success');
      loadEntries();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      console.error('[心光] 导入失败:', err);
      setMessage(`导入失败: ${errorMsg}\n文件名: ${file.name}\n文件大小: ${file.size} 字节`);
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
            
            {/* v2.4.2 导入模式切换：默认独立文档，可切回原逐条导入 */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-2">
              <button
                type="button"
                onClick={() => setImportMode('document')}
                className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
                  importMode === 'document' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                独立文档
              </button>
              <button
                type="button"
                onClick={() => setImportMode('split')}
                className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
                  importMode === 'split' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                逐条导入到分类
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              {importMode === 'document'
                ? '整篇原文保存到坚果云《文档》，保留原文件名，可在「文档库」中阅读与编辑'
                : '按行拆分为记录，导入到下方选择的分类（原行为）'}
            </p>

            {/* 分类选择器（仅逐条模式对 MD/TXT 生效） */}
            {importMode === 'split' && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-2">选择分类（MD/TXT 文件使用）：</p>
                <div className="flex flex-wrap gap-1.5">
                  {IMPORT_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setImportCategory(cat.id)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          importCategory === cat.id
                            ? `${cat.color} text-white`
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-colors">
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600">选择 JSON、Markdown 或文本文件</span>
              <input
                type="file"
                accept=".json,.md,.txt,.markdown"
                multiple
                onChange={handleImport}
                disabled={isImporting}
                className="hidden"
              />
            </label>
            <p className="text-xs text-gray-400 mt-1">
              支持 .json、.md 和 .txt 格式（可多选）<br/>
              <span className="text-amber-600">* JSON 文件保留原分类；独立文档模式整篇存入《文档》，逐条模式使用上方选择的分类</span>
            </p>
          </div>

          {/* 消息提示 */}
          {message && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-pre-line ${
              messageType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {messageType === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              <span>{message}</span>
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

import { useState, useEffect } from 'react';
import { X, FileText, ArrowLeft, Pencil, Trash2, CheckCircle, AlertCircle, Upload } from 'lucide-react';
import { useSummaryStore } from '../hooks/useSummaryStore';
import { MarkdownPreview } from './MarkdownPreview';
import { MarkdownEditor } from './MarkdownEditor';
import { hasCredentials, writeFile, deleteFile } from '../lib/nutstore';
import type { DocumentFile } from '../types';

interface DocumentLibraryProps {
  onClose: () => void;
  onGoImport: () => void;
}

type DocViewMode = 'list' | 'read' | 'edit';

// v2.4.2 元数据缺失时显示「—」，排序回退文件名
function formatTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatSize(size?: number): string {
  if (size === undefined || isNaN(size)) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function sortDocuments(docs: DocumentFile[]): DocumentFile[] {
  return [...docs].sort((a, b) => {
    const ta = a.lastModified ? new Date(a.lastModified).getTime() : NaN;
    const tb = b.lastModified ? new Date(b.lastModified).getTime() : NaN;
    const aOk = !isNaN(ta);
    const bOk = !isNaN(tb);
    if (aOk && bOk && ta !== tb) return tb - ta;
    if (aOk && !bOk) return -1;
    if (!aOk && bOk) return 1;
    return a.fileName.localeCompare(b.fileName, 'zh-CN');
  });
}

export function DocumentLibrary({ onClose, onGoImport }: DocumentLibraryProps) {
  const { documents, loading, loadEntries, updateDocumentContent, removeDocumentByPath } = useSummaryStore();
  const [mode, setMode] = useState<DocViewMode>('list');
  const [activePath, setActivePath] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (hasCredentials()) loadEntries();
  }, [loadEntries]);

  const sorted = sortDocuments(documents);
  const activeDoc = documents.find(d => d.path === activePath) || null;

  const openDoc = (doc: DocumentFile) => {
    setActivePath(doc.path);
    setDraft(doc.content);
    setMessage('');
    setMode('read');
  };

  const backToList = () => {
    setActivePath(null);
    setMessage('');
    setMode('list');
  };

  const cancelEdit = () => {
    if (activeDoc) setDraft(activeDoc.content);
    setMessage('');
    setMode('read');
  };

  const saveDoc = async () => {
    if (!activeDoc || saving) return;
    setSaving(true);
    setMessage('');
    const result = await writeFile(activeDoc.path, draft);
    if (result.success) {
      updateDocumentContent(activeDoc.path, draft);
      setMessage('已保存，云端文件已同步更新');
      setMessageType('success');
      setMode('read');
    } else {
      setMessage('保存失败: ' + (result.error || '未知错误'));
      setMessageType('error');
    }
    setSaving(false);
  };

  const deleteDoc = async (doc: DocumentFile) => {
    if (!confirm(`确定删除《${doc.fileName}》？云端文件将一并删除，且不可恢复。`)) return;
    setMessage('');
    const result = await deleteFile(doc.path);
    if (result.success) {
      removeDocumentByPath(doc.path);
      if (activePath === doc.path) {
        setActivePath(null);
        setMode('list');
      }
      setMessage(`已删除《${doc.fileName}》`);
      setMessageType('success');
    } else {
      setMessage(`删除失败: ${result.error || '未知错误'}`);
      setMessageType('error');
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 z-50 overflow-y-auto">
      <div className="max-w-2xl lg:max-w-4xl mx-auto px-3 py-4 lg:px-6">
        {/* 头部 */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            {mode !== 'list' && (
              <button
                onClick={mode === 'edit' ? cancelEdit : backToList}
                className="p-2 rounded-xl bg-white text-gray-500 hover:text-amber-500 hover:bg-amber-50 shadow-sm transition-all flex-shrink-0"
                title={mode === 'edit' ? '取消编辑' : '返回列表'}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-800 truncate">
                {mode === 'list' ? '文档库' : activeDoc?.fileName || '文档库'}
              </h2>
              <p className="text-xs text-gray-400">
                {mode === 'list'
                  ? `${documents.length} 个独立文档`
                  : `${formatTime(activeDoc?.lastModified)} · ${formatSize(activeDoc?.size)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {mode === 'read' && activeDoc && (
              <>
                <button
                  onClick={() => setMode('edit')}
                  className="p-2 rounded-xl bg-white text-gray-500 hover:text-amber-500 hover:bg-amber-50 shadow-sm transition-all"
                  title="编辑"
                >
                  <Pencil className="w-5 h-5" />
                </button>
                <button
                  onClick={() => deleteDoc(activeDoc)}
                  className="p-2 rounded-xl bg-white text-gray-500 hover:text-red-500 hover:bg-red-50 shadow-sm transition-all"
                  title="删除"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </>
            )}
            {mode === 'edit' && (
              <button
                onClick={saveDoc}
                disabled={saving}
                className="px-4 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium text-sm disabled:opacity-50"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-100 shadow-sm transition-all"
              title="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-3 whitespace-pre-line ${
            messageType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {messageType === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span>{message}</span>
          </div>
        )}

        {/* 列表 */}
        {mode === 'list' && (
          <>
            {loading && documents.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                <p className="text-sm text-gray-400">加载中…</p>
              </div>
            )}
            {!loading && documents.length === 0 && (
              <div className="bg-white rounded-2xl shadow p-8 text-center">
                <FileText className="w-12 h-12 text-amber-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-800 mb-2">文档库还是空的</h3>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  在「导入导出」中选择「独立文档」模式导入 .md / .txt 文件，<br />
                  整篇原文会保存到坚果云《文档》目录，在此阅读与编辑。
                </p>
                <button
                  onClick={onGoImport}
                  className="px-6 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium text-sm inline-flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  去导入
                </button>
              </div>
            )}
            {documents.length > 0 && (
              <div className="space-y-2">
                {sorted.map((doc) => (
                  <button
                    key={doc.path}
                    onClick={() => openDoc(doc)}
                    className="w-full bg-white rounded-xl shadow-sm p-3.5 flex items-center gap-3 hover:shadow-md hover:bg-amber-50/40 transition-all text-left"
                  >
                    <FileText className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.fileName}</p>
                      <p className="text-xs text-gray-400">
                        {formatTime(doc.lastModified)} · {formatSize(doc.size)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* 阅读 */}
        {mode === 'read' && activeDoc && (
          <div className="bg-white rounded-2xl shadow-sm p-4 lg:p-6 min-h-[50vh]">
            {activeDoc.content.trim() ? (
              <MarkdownPreview content={activeDoc.content} />
            ) : (
              <p className="text-sm text-gray-400">（空文档）</p>
            )}
          </div>
        )}

        {/* 编辑 */}
        {mode === 'edit' && activeDoc && (
          <MarkdownEditor
            value={draft}
            onChange={setDraft}
            placeholder="编辑文档内容…"
            className="min-h-[60vh]"
          />
        )}

        {/* 文档已被移除（如云端删除后刷新） */}
        {mode !== 'list' && !activeDoc && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-sm text-gray-400 mb-3">文档不存在或已被移动</p>
            <button
              onClick={backToList}
              className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors"
            >
              返回列表
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

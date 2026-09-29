import { useState, useCallback, useEffect, useRef } from 'react';
import { Send, MessageSquare, CheckCircle, Lightbulb, BookOpen, FileText, Star, Heart, Flag, Tag, Bookmark, Bell, Calendar, Mail, Music, Camera, ShoppingCart, Grid3x3, AlertTriangle, Target, Clock, MinusCircle, Mic, MicOff, Sparkles, X, Maximize2, PenTool, Type } from 'lucide-react';
import { useSummaryStore } from '../hooks/useSummaryStore';
import { useCategories } from '../hooks/useCategories';
import { aiClassifyContent } from '../lib/aiClassifier';
import { MarkdownEditor } from './MarkdownEditor';
import { DrawingCanvas } from './DrawingCanvas';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare, CheckCircle, Lightbulb, BookOpen, FileText,
  Star, Heart, Flag, Tag, Bookmark, Bell, Calendar, Mail, Music, Camera, ShoppingCart,
};

const quadrants = [
  { id: 'urgent', label: 'Q1 紧急且重要', icon: AlertTriangle, color: 'bg-red-500', activeColor: 'bg-red-100 text-red-700 border-red-300' },
  { id: 'high', label: 'Q2 重要不紧急', icon: Target, color: 'bg-orange-500', activeColor: 'bg-orange-100 text-orange-700 border-orange-300' },
  { id: 'medium', label: 'Q3 紧急不重要', icon: Clock, color: 'bg-amber-500', activeColor: 'bg-amber-100 text-amber-700 border-amber-300' },
  { id: 'low', label: 'Q4 不紧急不重要', icon: MinusCircle, color: 'bg-gray-500', activeColor: 'bg-gray-100 text-gray-600 border-gray-300' },
] as const;

// 输入模式
type InputMode = 'text' | 'markdown' | 'drawing';

// 声明 Web Speech API 类型
interface SpeechRecognitionEventLike {
  results: { 0: { 0: { transcript: string } } };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionLike;
    webkitSpeechRecognition: new () => SpeechRecognitionLike;
  }
}

export function QuickRecord() {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [showQuadrants, setShowQuadrants] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [aiClassifiedCategory, setAiClassifiedCategory] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [showFullScreen, setShowFullScreen] = useState(false);
  const { addEntry, loadEntries } = useSummaryStore();
  const { categories } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id || 'chat');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // 语音识别初始化
  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = event.results[0][0].transcript;
      setContent(prev => prev + transcript);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    return recognition;
  }, []);

  const handleVoiceInput = useCallback(() => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const recognition = initSpeechRecognition();
    if (!recognition) {
      alert('您的浏览器不支持语音输入功能，请使用 Chrome 或 Edge 浏览器');
      return;
    }

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, initSpeechRecognition]);

  // 清理语音识别
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const activeCategory = categories.find((c) => c.id === selectedCategory) || categories[0];

  // AI语义识别自动分类
  const handleAiClassify = useCallback(async () => {
    if (!content.trim() || selectedCategory) return;
    
    setIsClassifying(true);
    try {
      const result = await aiClassifyContent(content.trim(), categories, selectedCategory);
      if (result && result !== selectedCategory) {
        setAiClassifiedCategory(result);
        setTimeout(() => {
          setSelectedCategory(result);
          setAiClassifiedCategory(null);
        }, 1500);
      } else {
        setAiClassifiedCategory(null);
      }
    } catch {
      // AI分类失败时静默处理
    } finally {
      setIsClassifying(false);
    }
  }, [content, categories, selectedCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !activeCategory) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      let targetCategory = activeCategory;

      if (!selectedCategory) {
        const aiResult = await aiClassifyContent(content.trim(), categories, selectedCategory);
        if (aiResult) {
          const aiCat = categories.find(c => c.id === aiResult);
          if (aiCat) {
            targetCategory = aiCat;
          }
        }
      }

      const priority = selectedPriority as 'urgent' | 'high' | 'medium' | 'low' | undefined;
      const success = await addEntry(content.trim(), targetCategory.target, targetCategory.id, priority);
      if (success) {
        setContent('');
        setSelectedPriority(null);
        setShowQuadrants(false);
        setAiClassifiedCategory(null);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        loadEntries();
      } else {
        setSaveError('保存失败：未能写入坚果云。常见原因：坚果云账号/应用密码已失效、加密会话未解锁、或网络中断。内容已保留，可重试。');
        console.error('[心光] addEntry 写入失败，详情见控制台网络请求 /api/nutstore/write');
      }
    } catch (e) {
      setSaveError(`保存失败：${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 用户手动选择分类时清除AI分类结果
  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setAiClassifiedCategory(null);
  };

  // 全屏编辑器（Markdown 或 涂鸦）
  if (showFullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-amber-50">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            {inputMode === 'markdown' ? (
              <><Type className="w-5 h-5 text-amber-500" /> Markdown 编辑</>
            ) : (
              <><PenTool className="w-5 h-5 text-amber-500" /> 涂鸦编辑</>
            )}
          </h3>
          <button
            onClick={() => setShowFullScreen(false)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 p-4 overflow-hidden flex flex-col">
          {/* 分类选择 */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {categories.map((option) => {
              const Icon = ICON_MAP[option.icon] || MessageSquare;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleCategorySelect(option.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                    selectedCategory === option.id
                      ? `${option.color} text-white`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {option.label && option.label.startsWith('custom_') ? (option.id.startsWith('custom_') ? option.id.slice(7) : option.label.slice(7)) : option.label}
                </button>
              );
            })}
          </div>

          {/* 四象限选择 */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {quadrants.map((q) => {
              const Icon = q.icon;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setSelectedPriority(selectedPriority === q.id ? null : q.id);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                    selectedPriority === q.id
                      ? q.activeColor
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {q.label}
                </button>
              );
            })}
            {selectedPriority && (
              <button
                type="button"
                onClick={() => setSelectedPriority(null)}
                className="px-2.5 py-1 text-xs text-gray-400 hover:text-gray-600"
              >
                清除象限
              </button>
            )}
          </div>

          {/* 编辑区域 */}
          {inputMode === 'markdown' ? (
            <MarkdownEditor
              value={content}
              onChange={setContent}
              placeholder="使用 Markdown 格式编写...&#10;&#10;支持：&#10;# 标题&#10;**粗体** _斜体_&#10;- 列表&#10;> 引用&#10;`代码`"
              className="flex-1"
            />
          ) : (
            <DrawingCanvas
              onSave={(imageData) => {
                setContent(imageData);
                setShowFullScreen(false);
              }}
              className="flex-1"
            />
          )}

          {/* 底部按钮 */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-2">
              {/* 语音输入按钮 */}
              <button
                type="button"
                onClick={handleVoiceInput}
                disabled={isSaving || inputMode === 'drawing'}
                className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                } ${inputMode === 'drawing' ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isListening ? '点击停止录音' : '语音输入'}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              {/* AI分类按钮 */}
              <button
                type="button"
                onClick={handleAiClassify}
                disabled={!content.trim() || isClassifying || !!selectedCategory || inputMode === 'drawing'}
                className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
                  content.trim() && !isClassifying && !selectedCategory && inputMode !== 'drawing'
                    ? 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                title={selectedCategory ? '已手动选择分类' : 'AI自动分类'}
              >
                {isClassifying ? (
                  <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setContent('');
                  setShowFullScreen(false);
                }}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  if (!content.trim()) return;
                  setShowFullScreen(false);
                  // 触发保存
                  setIsSaving(true);
                  setSaveError(null);
                  try {
                    const priority = selectedPriority as 'urgent' | 'high' | 'medium' | 'low' | undefined;
                    const success = await addEntry(content.trim(), activeCategory.target, activeCategory.id, priority);
                    if (success) {
                      setContent('');
                      setSelectedPriority(null);
                      setShowSuccess(true);
                      setTimeout(() => setShowSuccess(false), 2000);
                      loadEntries();
                    } else {
                      setSaveError('保存失败，内容已保留，可重试。');
                    }
                  } catch (e) {
                    setSaveError(`保存失败：${e instanceof Error ? e.message : '未知错误'}`);
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={!content.trim() || isSaving}
                className="px-4 py-2 text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {isSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4 mb-4">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-amber-500" />
        快速记录
      </h3>

      <form onSubmit={handleSubmit}>
        {/* 分类选择 */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {categories.map((option) => {
            const Icon = ICON_MAP[option.icon] || MessageSquare;
            const isAiClassified = aiClassifiedCategory === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleCategorySelect(option.id)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                  selectedCategory === option.id
                    ? `${option.color} text-white`
                    : isAiClassified
                    ? 'bg-purple-100 text-purple-700 border border-purple-300 animate-pulse'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {option.label && option.label.startsWith('custom_') ? (option.id.startsWith('custom_') ? option.id.slice(7) : option.label.slice(7)) : option.label}
                {isAiClassified && <Sparkles className="w-3 h-3 ml-0.5" />}
              </button>
            );
          })}
        </div>

        {/* AI分类提示 */}
        {aiClassifiedCategory && (
          <div className="mb-2 flex items-center gap-1.5 text-xs text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg">
            <Sparkles className="w-3.5 h-3.5" />
            AI 建议分类: {categories.find(c => c.id === aiClassifiedCategory)?.label || aiClassifiedCategory}
          </div>
        )}

        {/* 四象限选择 */}
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowQuadrants(!showQuadrants)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all border ${
              showQuadrants || selectedPriority
                ? 'bg-amber-100 text-amber-700 border-amber-300'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <Grid3x3 className="w-3.5 h-3.5" />
            {selectedPriority
              ? quadrants.find(q => q.id === selectedPriority)?.label
              : '选择象限（可选）'}
          </button>

          {showQuadrants && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quadrants.map((q) => {
                const Icon = q.icon;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setSelectedPriority(selectedPriority === q.id ? null : q.id);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                      selectedPriority === q.id
                        ? q.activeColor
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {q.label}
                  </button>
                );
              })}
              {selectedPriority && (
                <button
                  type="button"
                  onClick={() => setSelectedPriority(null)}
                  className="px-2.5 py-1 text-xs text-gray-400 hover:text-gray-600"
                >
                  清除
                </button>
              )}
            </div>
          )}
        </div>

        {/* 输入模式选择 */}
        <div className="flex gap-1.5 mb-3">
          <button
            type="button"
            onClick={() => setInputMode('text')}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              inputMode === 'text'
                ? 'bg-amber-100 text-amber-700 border border-amber-300'
                : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            文本
          </button>
          <button
            type="button"
            onClick={() => { setInputMode('markdown'); setShowFullScreen(true); }}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              inputMode === 'markdown'
                ? 'bg-amber-100 text-amber-700 border border-amber-300'
                : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            Markdown
          </button>
          <button
            type="button"
            onClick={() => { setInputMode('drawing'); setShowFullScreen(true); }}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              inputMode === 'drawing'
                ? 'bg-amber-100 text-amber-700 border border-amber-300'
                : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            涂鸦
          </button>
        </div>

        {/* 快速输入框（仅文本模式显示） */}
        {inputMode === 'text' && (
          <div className="flex gap-2">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={activeCategory?.target === 'todo' ? '添加待办事项...' : '记录想法、笔记...'}
              className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              disabled={isSaving}
              autoFocus
            />
            {/* 语音输入按钮 */}
            <button
              type="button"
              onClick={handleVoiceInput}
              disabled={isSaving}
              className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
              }`}
              title={isListening ? '点击停止录音' : '语音输入'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            {/* AI分类按钮 */}
            <button
              type="button"
              onClick={handleAiClassify}
              disabled={!content.trim() || isClassifying || !!selectedCategory}
              className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
                content.trim() && !isClassifying && !selectedCategory
                  ? 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              title={selectedCategory ? '已手动选择分类' : 'AI自动分类'}
            >
              {isClassifying ? (
                <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </button>
            <button
              type="submit"
              disabled={!content.trim() || isSaving}
              className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
                content.trim() && !isSaving
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        )}
      </form>

      {showSuccess && (
        <div className="mt-3 flex items-center gap-2 text-green-600 text-sm bg-green-50 px-3 py-2 rounded-lg">
          <CheckCircle className="w-4 h-4" />
          记录已保存到坚果云
        </div>
      )}

      {saveError && (
        <div className="mt-3 flex items-start gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}
    </div>
  );
}

import { useState, useCallback, useEffect, useRef } from 'react';
import { Send, MessageSquare, CheckCircle, Lightbulb, BookOpen, FileText, Star, Heart, Flag, Tag, Bookmark, Bell, Calendar, Mail, Music, Camera, ShoppingCart, Grid3x3, AlertTriangle, Target, Clock, MinusCircle, Mic, MicOff, Sparkles } from 'lucide-react';
import { useSummaryStore } from '../hooks/useSummaryStore';
import { useCategories } from '../hooks/useCategories';
import { aiClassifyContent } from '../lib/aiClassifier';

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

// 声明 Web Speech API 类型
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function QuickRecord() {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [showQuadrants, setShowQuadrants] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [aiClassifiedCategory, setAiClassifiedCategory] = useState<string | null>(null);
  const { addEntry, loadEntries } = useSummaryStore();
  const { categories } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id || 'chat');
  const recognitionRef = useRef<any>(null);

  // 语音识别初始化
  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.onresult = (event: any) => {
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
      // 停止录音
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
    if (!content.trim() || selectedCategory) return; // 用户手动选择了分类则不AI分类
    
    setIsClassifying(true);
    try {
      const result = await aiClassifyContent(content.trim(), categories, selectedCategory);
      if (result && result !== selectedCategory) {
        setAiClassifiedCategory(result);
        // 短暂显示AI分类结果后自动切换
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

    try {
      let targetCategory = activeCategory;
      
      // 如果用户没有手动选择分类，尝试AI自动分类
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
      }
    } catch {
      // handle error in addEntry
    } finally {
      setIsSaving(false);
    }
  };

  // 用户手动选择分类时清除AI分类结果
  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setAiClassifiedCategory(null);
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4 mb-4">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-amber-500" />
        快速记录
      </h3>

      <form onSubmit={handleSubmit}>
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
      </form>

      {showSuccess && (
        <div className="mt-3 flex items-center gap-2 text-green-600 text-sm bg-green-50 px-3 py-2 rounded-lg">
          <CheckCircle className="w-4 h-4" />
          记录已保存到坚果云
        </div>
      )}
    </div>
  );
}

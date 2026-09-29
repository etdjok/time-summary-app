import { useState, useRef, useEffect, useCallback } from 'react';
import { PenTool, Eraser, Trash2, Palette, Minus, Plus } from 'lucide-react';

interface DrawingCanvasProps {
  onSave: (imageData: string) => void;
  className?: string;
}

const COLORS = [
  '#000000', '#333333', '#666666', '#999999',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff',
];

const BRUSH_SIZES = [2, 4, 6, 10, 16];

export function DrawingCanvas({ onSave, className }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [showColors, setShowColors] = useState(false);

  // 初始化画布
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置画布尺寸
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // 白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  // 获取坐标
  const getCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  // 开始绘制
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoords(e);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'eraser') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = brushSize * 3;
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
    }

    setIsDrawing(true);
    e.preventDefault();
  }, [tool, color, brushSize, getCoords]);

  // 绘制中
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing, getCoords]);

  // 结束绘制
  const handlePointerUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // 清除画布
  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  // 保存为图片
  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageData = canvas.toDataURL('image/png');
    onSave(imageData);
  }, [onSave]);

  return (
    <div className={`flex flex-col ${className}`}>
      {/* 工具栏 */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-t-xl flex-wrap">
        {/* 画笔工具 */}
        <button
          onClick={() => setTool('pen')}
          className={`p-2 rounded-lg transition-colors ${
            tool === 'pen'
              ? 'bg-amber-100 text-amber-700'
              : 'text-gray-600 hover:bg-gray-200'
          }`}
          title="画笔"
        >
          <PenTool className="w-5 h-5" />
        </button>

        {/* 橡皮擦 */}
        <button
          onClick={() => setTool('eraser')}
          className={`p-2 rounded-lg transition-colors ${
            tool === 'eraser'
              ? 'bg-amber-100 text-amber-700'
              : 'text-gray-600 hover:bg-gray-200'
          }`}
          title="橡皮擦"
        >
          <Eraser className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-gray-300" />

        {/* 颜色选择 */}
        <div className="relative">
          <button
            onClick={() => setShowColors(!showColors)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors"
            title="选择颜色"
          >
            <Palette className="w-5 h-5" />
          </button>
          {showColors && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 grid grid-cols-4 gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setColor(c);
                    setTool('pen');
                    setShowColors(false);
                  }}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    color === c ? 'border-amber-500 scale-110' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-300" />

        {/* 粗细调节 */}
        <button
          onClick={() => {
            const idx = BRUSH_SIZES.indexOf(brushSize);
            const newIdx = Math.max(0, idx - 1);
            setBrushSize(BRUSH_SIZES[newIdx]);
          }}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors"
          title="减小粗细"
        >
          <Minus className="w-4 h-4" />
        </button>
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: color, width: brushSize + 8, height: brushSize + 8 }}
        />
        <button
          onClick={() => {
            const idx = BRUSH_SIZES.indexOf(brushSize);
            const newIdx = Math.min(BRUSH_SIZES.length - 1, idx + 1);
            setBrushSize(BRUSH_SIZES[newIdx]);
          }}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors"
          title="增大粗细"
        >
          <Plus className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-300" />

        {/* 清除 */}
        <button
          onClick={handleClear}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors"
          title="清除画布"
        >
          <Trash2 className="w-5 h-5" />
        </button>

        <div className="flex-1" />

        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium text-sm"
        >
          保存涂鸦
        </button>
      </div>

      {/* 画布区域 */}
      <div className="flex-1 border border-t-0 border-gray-200 rounded-b-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none cursor-crosshair"
          style={{ minHeight: '300px' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
    </div>
  );
}

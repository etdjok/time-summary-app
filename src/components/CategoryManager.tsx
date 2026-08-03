import { useState } from 'react';
import { X, Plus, Trash2, MessageSquare, CheckCircle, Lightbulb, BookOpen, FileText, Star, Heart, Flag, Tag, Bookmark, Bell, Calendar, Mail, Music, Camera, ShoppingCart, Lock, Pencil } from 'lucide-react';
import { changePassword } from '../lib/auth';
import { useCategories, COLOR_OPTIONS, ICON_OPTIONS } from '../hooks/useCategories';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare, CheckCircle, Lightbulb, BookOpen, FileText,
  Star, Heart, Flag, Tag, Bookmark, Bell, Calendar, Mail, Music, Camera, ShoppingCart,
};

interface CategoryManagerProps {
  onClose: () => void;
}

export function CategoryManager({ onClose }: CategoryManagerProps) {
  const {
    categories,
    addCategory,
    removeCategory,
    updateCategory,
    resetCategories,
  } = useCategories();

  const colorOptions = COLOR_OPTIONS;
  const iconOptions = ICON_OPTIONS;

  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('Star');
  const [newColor, setNewColor] = useState('bg-blue-500');
  const [newTarget, setNewTarget] = useState<'chat' | 'todo' | 'journal' | 'idea' | 'note'>('chat');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdMsgType, setPwdMsgType] = useState<'success' | 'error'>('success');

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    addCategory({
      label: newLabel.trim(),
      icon: newIcon,
      color: newColor,
      target: newLabel.trim(),
    });
    setNewLabel('');
  };


  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editTarget, setEditTarget] = useState<string>('chat');

  // v1.18.2: 编辑时自动修正 label，从 id 提取真实名称
  const startEdit = (cat: any) => {
    const fixedLabel = (cat.label && cat.label.startsWith('custom_'))
      ? (cat.id.startsWith('custom_') ? cat.id.slice(7) : cat.label.slice(7))
      : cat.label;
    setEditingId(cat.id);
    setEditLabel(fixedLabel);
    setEditIcon(cat.icon);
    setEditColor(cat.color);
    setEditTarget(cat.target);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = (id: string) => {
    if (!editLabel.trim()) return;
    updateCategory(id, {
      label: editLabel.trim(),
      icon: editIcon,
      color: editColor,
      target: editTarget,
    });
    setEditingId(null);
  };

  const handleChangePassword = async () => {
    setPwdMsg('');
    if (!newPwd.trim() || newPwd.length < 4) {
      setPwdMsg('新密码至少4个字符');
      setPwdMsgType('error');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg('两次输入不一致');
      setPwdMsgType('error');
      return;
    }
    const result = await changePassword(currentPwd, newPwd);
    if (result.success) {
      setPwdMsg('密码修改成功，所有设备需重新登录');
      setPwdMsgType('success');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setTimeout(() => { setShowPasswordChange(false); setPwdMsg(''); }, 3000);
    } else {
      setPwdMsg(result.error || '修改失败');
      setPwdMsgType('error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-800">分类管理</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* 现有分类列表 */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">当前分类</p>
            {categories.map((cat) => {
              const Icon = ICON_MAP[cat.icon] || MessageSquare;
              const isEditing = editingId === cat.id;

              if (isEditing) {
                return (
                  <div key={cat.id} className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="分类名称"
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={editIcon}
                        onChange={(e) => setEditIcon(e.target.value)}
                        className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-amber-400"
                      >
                        {iconOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <select
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-amber-400"
                      >
                        {colorOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <input
                        value={editTarget}
                        onChange={(e) => setEditTarget(e.target.value)}
                        className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-amber-400"
                        placeholder="文件名（不含.md）"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(cat.id)}
                        disabled={!editLabel.trim()}
                        className="flex-1 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 disabled:opacity-50"
                      >
                        保存
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-300"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl"
                >
                  <div className={`w-8 h-8 ${cat.color} rounded-lg flex items-center justify-center text-white`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{cat.label}</p>
                    <p className="text-xs text-gray-400">
                      {cat.target}.md
                    </p>
                  </div>
                  <button
                    onClick={() => startEdit(cat)}
                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                    title="编辑"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeCategory(cat.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* 添加新分类 */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">添加分类</p>
            <div className="space-y-3">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="分类名称，如：阅读、运动"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400"
              />

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400"
                >
                  {iconOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400"
                >
                  {colorOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                新分类将自动创建独立文件（{'{分类名}'}.md），与默认分类互不干扰
              </div>

              <button
                onClick={handleAdd}
                disabled={!newLabel.trim()}
                className="w-full px-4 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                <Plus className="w-4 h-4" />
                添加分类
              </button>
            </div>
          </div>

          {/* 修改密码 */}
          <div className="border-t border-gray-100 pt-4">
            <button
              onClick={() => setShowPasswordChange(!showPasswordChange)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors font-medium text-sm"
            >
              <Lock className="w-4 h-4" />
              {showPasswordChange ? '收起' : '修改密码'}
            </button>

            {showPasswordChange && (
              <div className="mt-3 space-y-3">
                <input
                  type="password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="当前密码"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400"
                />
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="新密码（至少4位）"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400"
                />
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="确认新密码"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400"
                  onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
                />
                {pwdMsg && (
                  <p className={`text-xs text-center ${pwdMsgType === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                    {pwdMsg}
                  </p>
                )}
                <button
                  onClick={handleChangePassword}
                  className="w-full px-4 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium text-sm"
                >
                  确认修改
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={resetCategories}
            className="w-full px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors font-medium text-sm"
          >
            恢复默认分类
          </button>
        </div>
      </div>
    </div>
  );
}

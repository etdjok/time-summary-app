import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { verifyPassword, markAuthenticated, getAuthStatus, setupPassword } from '../lib/auth';

interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // v2.3.2 首次使用向导：服务器从未设置过密码时，强制先设置登录密码
  const [needsSetup, setNeedsSetup] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [setupChecked, setSetupChecked] = useState(false);

  useEffect(() => {
    getAuthStatus().then(({ needsSetup }) => {
      setNeedsSetup(needsSetup);
      setSetupChecked(true);
    });
  }, []);

  const handleSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 4) {
      setError('密码至少4个字符');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    setIsLoading(true);
    setError('');
    setupPassword(newPassword)
      .then((result) => {
        if (result.success) {
          markAuthenticated();
          onLogin();
        } else {
          setError(result.error || '设置失败，请重试');
        }
      })
      .catch(() => setError('设置过程出现异常，请重试'))
      .finally(() => setIsLoading(false));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }
    setIsLoading(true);
    setError('');

    // v2.2 修复：网络错误与密码错误分开提示；catch+finally 兜底，
    // 避免异常时按钮永久禁用（iOS 隐私模式下 localStorage 可能抛异常）
    verifyPassword(password)
      .then((result) => {
        if (result.success) {
          markAuthenticated();
          onLogin();
        } else {
          setError(result.message || '密码错误，请重试');
          if (result.error === 'auth') setPassword('');
        }
      })
      .catch(() => setError('登录过程出现异常，请重试'))
      .finally(() => setIsLoading(false));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            {needsSetup ? (
              <ShieldCheck className="w-8 h-8 text-amber-600" />
            ) : (
              <Lock className="w-8 h-8 text-amber-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-800">心光</h1>
          <p className="text-sm text-gray-500 mt-1">
            {needsSetup ? '首次使用 · 设置登录密码' : '请输入密码访问'}
          </p>
        </div>

        {needsSetup ? (
          <form onSubmit={handleSetup}>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
              placeholder="设置登录密码（至少4个字符）"
              className="w-full px-4 py-3 mb-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              autoFocus
              disabled={isLoading}
            />
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => { setConfirmNewPassword(e.target.value); setError(''); }}
              placeholder="再次输入密码"
              className="w-full px-4 py-3 mb-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              disabled={isLoading}
            />

            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading || !setupChecked}
              className="w-full py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  保存密码并进入
                </>
              )}
            </button>

            <p className="mt-4 text-xs text-gray-400 text-center leading-relaxed">
              密码将以 PBKDF2 哈希存储在服务端，不保存明文。
              <br />此设置仅在首次部署时出现。
            </p>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="relative mb-4">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="请输入密码"
                className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                autoFocus
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  登录
                </>
              )}
            </button>
          </form>
        )}

        {!needsSetup && (
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">可在设置中修改密码</p>
          </div>
        )}
      </div>
    </div>
  );
}

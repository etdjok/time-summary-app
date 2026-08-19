import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { verifyPassword } from '../lib/auth';

const AUTH_KEY = 'heartlight_auth';
const AUTH_TIME_KEY = 'heartlight_auth_time';
const SESSION_HOURS = 24;

export function isAuthenticated(): boolean {
  const auth = localStorage.getItem(AUTH_KEY);
  const authTime = localStorage.getItem(AUTH_TIME_KEY);
  if (!auth || !authTime) return false;
  const hoursSinceAuth = (Date.now() - parseInt(authTime)) / (1000 * 60 * 60);
  if (hoursSinceAuth > SESSION_HOURS) {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_TIME_KEY);
    return false;
  }
  return true;
}

interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }
    setIsLoading(true);
    setError('');

    verifyPassword(password).then((valid) => {
      if (valid) {
        localStorage.setItem(AUTH_KEY, 'true');
        localStorage.setItem(AUTH_TIME_KEY, Date.now().toString());
        onLogin();
      } else {
        setError('密码错误，请重试');
        setPassword('');
      }
      setIsLoading(false);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">心光</h1>
          <p className="text-sm text-gray-500 mt-1">请输入密码访问</p>
        </div>

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

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">可在设置中修改密码</p>
        </div>
      </div>
    </div>
  );
}

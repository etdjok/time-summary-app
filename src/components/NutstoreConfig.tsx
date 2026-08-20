import { useState, useEffect } from 'react';
import { Settings, X, Check, AlertCircle, FolderOpen, ChevronRight, Copy, Shield } from 'lucide-react';
import { saveCredentials, clearCredentials, hasCredentials, testConnectionWithDetails, listRootFolders, getCredentials, backupRecoveryToCloud, fetchRecoveryBackupFromCloud, getCredentialUsername, saveCredentialsSmart, hasEncryptedCredentials } from '../lib/nutstore';
import {
  getEncryptSettings, saveEncryptSettings, clearEncryptSettings,
  setupEncryption, normalizeRecoveryCode,
  hasSessionMK, hasLocalEncryptionKeys, markRecoveryShown, loginWithPassword, logout,
  encryptExistingFiles, unlockWithCloudBackup, type MigrationStats,
} from '../lib/crypto';
import { useSummaryStore } from '../hooks/useSummaryStore';

interface NutstoreConfigProps { onClose: () => void; }

function copyTextSafe(text: string): boolean {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).catch(() => {});
      return true;
    }
  } catch { /* fallthrough */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand && document.execCommand('copy');
    document.body.removeChild(ta);
    return !!ok;
  } catch { return false; }
}

export function NutstoreConfig({ onClose }: NutstoreConfigProps) {
  const { nutstoreBasePath, setNutstoreBasePath, loadEntries } = useSummaryStore();
  const existing = getCredentials();
  const encExisting = getEncryptSettings();
  const encInitial = encExisting.enabled || hasLocalEncryptionKeys();
  const [username, setUsername] = useState(existing?.username || getCredentialUsername() || '');
  const [password, setPassword] = useState(existing?.password || '');
  const [basePath, setBasePath] = useState(nutstoreBasePath);
  const [encEnabled, setEncEnabled] = useState(encInitial);
  const [encPassword, setEncPassword] = useState('');
  const [encConfirm, setEncConfirm] = useState('');

  useEffect(() => {
    const creds = getCredentials();
    if (creds) { if (!username) setUsername(creds.username); if (!password) setPassword(creds.password); }
  }, []);

  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isConnected, setIsConnected] = useState(hasCredentials());
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [basePathFiles, setBasePathFiles] = useState<string[]>([]);
  const [basePathFolders, setBasePathFolders] = useState<string[]>([]);
  const [pathResults, setPathResults] = useState<{ path: string; status: number; files: string[]; folders: string[] }[]>([]);
  const [showFolders, setShowFolders] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // 恢复码弹窗状态
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // 忘记密码弹窗
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotRecovery, setForgotRecovery] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirm, setForgotConfirm] = useState('');
  const [forgotResult, setForgotResult] = useState<{ success: boolean; message: string } | null>(null);
  const [forgotBusy, setForgotBusy] = useState(false);

  // 修改加密密码弹窗
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changeCurrent, setChangeCurrent] = useState('');
  const [changeNew, setChangeNew] = useState('');
  const [changeConfirm, setChangeConfirm] = useState('');
  const [changeResult, setChangeResult] = useState<{ success: boolean; message: string } | null>(null);
  const [changeBusy, setChangeBusy] = useState(false);

  // 已启用加密时的摘要 + 云端备份状态
  const [encActive, setEncActive] = useState(encExisting.enabled || hasLocalEncryptionKeys());
  const [cloudBackupOk, setCloudBackupOk] = useState(false);
  const [cloudBackupError, setCloudBackupError] = useState('');
  const [backingUp, setBackingUp] = useState(false);

  // 重新开启加密前检测云端已有备份 → 警告
  const [cloudBackupExists, setCloudBackupExists] = useState(false);
  const [checkedCloudOnEnable, setCheckedCloudOnEnable] = useState(false);

  // v2.2 三态加密显示：本地无密钥但云端有备份 → 云端已加密·本浏览器未解锁
  const [cloudLocked, setCloudLocked] = useState(false);
  const [forceReset, setForceReset] = useState(false); // 用户已明确确认放弃云端旧数据
  const [cloudUnlockBusy, setCloudUnlockBusy] = useState(false);
  const [confirmForceReset, setConfirmForceReset] = useState(false);

  // v2.2 历史明文文件迁移加密
  const [migrating, setMigrating] = useState(false);
  const [migrationStats, setMigrationStats] = useState<MigrationStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchRecoveryBackupFromCloud(basePath);
      if (cancelled) return;
      if (encActive) {
        if (r.success && r.wrapped) { setCloudBackupOk(true); setCloudBackupError(''); }
        else setCloudBackupError(r.error === '文件不存在' ? '' : (r.error || ''));
      } else if (r.success && r.wrapped) {
        setCloudBackupExists(true);
        // 本地无密钥但云端有备份：进入"云端已加密·未解锁"态，防止误覆盖
        if (!hasLocalEncryptionKeys()) { setCloudLocked(true); setEncEnabled(true); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChangePassword = async () => {
    setChangeBusy(true);
    setChangeResult(null);
    if (!changeCurrent) { setChangeResult({ success: false, message: '请输入当前密码' }); setChangeBusy(false); return; }
    if (!changeNew || changeNew.length < 6) { setChangeResult({ success: false, message: '新密码至少 6 位' }); setChangeBusy(false); return; }
    if (changeNew !== changeConfirm) { setChangeResult({ success: false, message: '两次新密码不一致' }); setChangeBusy(false); return; }
    const { changeEncryptionPassword } = await import('../lib/crypto');
    const r = await changeEncryptionPassword(changeCurrent, changeNew);
    setChangeBusy(false);
    if (r.success) {
      setChangeResult({ success: true, message: '加密密码修改成功！新密码已生效，主密钥不变，数据不受影响。' });
      setChangeCurrent(''); setChangeNew(''); setChangeConfirm('');
      setTimeout(() => { setShowChangeModal(false); setChangeResult(null); }, 2200);
    } else {
      setChangeResult({ success: false, message: r.error || '修改失败' });
    }
  };

  const handleLoadFolders = async () => {
    if (!username || !password) { setResult({ success: false, message: '请先输入账号和密码' }); return; }
    await saveCredentialsSmart(username, password);
    setShowFolders(!showFolders);
    if (!showFolders) {
      setResult({ success: true, message: '正在获取云端文件夹列表...' });
      const r = await listRootFolders();
      if (r.success) { setAvailableFolders(r.folders); setResult({ success: true, message: `找到 ${r.folders.length} 个文件夹` }); }
      else { setResult({ success: false, message: r.error || '获取文件夹失败' }); }
    }
  };

  const handleVerifyRecovery = () => {
    const normalized = normalizeRecoveryCode(recoveryInput);
    const expected = normalizeRecoveryCode(recoveryCode);
    if (normalized === expected) {
      setRecoveryVerified(true);
      setCountdown(5);
      const timer = setInterval(() => {
        setCountdown(prev => { if (prev <= 1) { clearInterval(timer); return 0; } return prev - 1; });
      }, 1000);
    } else {
      setResult({ success: false, message: '恢复码不匹配，请重新输入' });
    }
  };

  const handleConfirmRecovery = async () => {
    const b64 = basePath;
    markRecoveryShown();
    setEncActive(true);
    setShowRecoveryModal(false);
    setRecoveryCode('');
    setRecoveryInput('');
    setRecoveryVerified(false);
    setConfirmedSaved(false);
    setBackingUp(true);
    const r = await backupRecoveryToCloud(b64 || '/我的坚果云/笔记');
    setBackingUp(false);
    if (r.success) {
      setCloudBackupOk(true);
      setCloudBackupError('');
      setResult({ success: true, message: '加密已启用，恢复密钥已备份到云端' });
    } else {
      setCloudBackupOk(false);
      setCloudBackupError(r.error || '云端备份失败');
      setResult({ success: false, message: `加密已启用，但恢复密钥云端备份失败：${r.error || '未知错误'}` });
    }
    // v2.2 迁移加密：将云端已有明文笔记全部加密，确保历史数据同样受保护
    setMigrating(true);
    const mr = await encryptExistingFiles(b64 || '/我的坚果云/笔记', (cur, total) => {
      setResult({ success: true, message: `正在加密云端历史文件 ${cur}/${total}...` });
    });
    setMigrating(false);
    if (mr.success && mr.stats) {
      setMigrationStats(mr.stats);
      const s = mr.stats;
      const parts = [`新加密 ${s.migrated} 个`];
      if (s.alreadyEncrypted > 0) parts.push(`已加密 ${s.alreadyEncrypted} 个`);
      if (s.oldFormat > 0) parts.push(`旧格式 ${s.oldFormat} 个（登录时自动迁移）`);
      if (s.failed.length > 0) parts.push(`失败 ${s.failed.length} 个`);
      setResult({ success: s.failed.length === 0, message: `云端历史文件加密完成：${parts.join('，')}` });
    } else if (!mr.success) {
      setResult({ success: false, message: `历史文件迁移加密失败：${mr.error || '未知错误'}（新保存的内容仍会加密）` });
    }
    // 继续完成坚果云连接并读取数据
    setTesting(true);
    const testResult = await testConnectionWithDetails(b64);
    if (testResult.rootFolders) setAvailableFolders(testResult.rootFolders);
    if (testResult.basePathFiles) setBasePathFiles(testResult.basePathFiles);
    if (testResult.basePathFolders) setBasePathFolders(testResult.basePathFolders);
    if (testResult.pathResults) setPathResults(testResult.pathResults);
    setShowDebug(true);
    if (testResult.success) {
      setResult({ success: true, message: '坚果云已连接，正在读取数据...' });
      try { await loadEntries(); } catch (e) { console.error('加载数据失败:', e); }
      const store = await import('../hooks/useSummaryStore').then(m => m.useSummaryStore.getState());
      if (!store.error) setResult({ success: true, message: `坚果云已连接，读取到 ${store.entries.length} 条记录` });
      setTimeout(onClose, 1000);
    } else {
      setResult({ success: false, message: testResult.error || '连接失败' });
    }
    setTesting(false);
  };

  const handleUnlock = async () => {
    if (!encPassword) { setResult({ success: false, message: '请输入加密密码' }); return; }
    setTesting(true);
    setResult(null);
    setResult({ success: true, message: '正在解锁加密会话...' });
    const lr = await loginWithPassword(encPassword);
    setTesting(false);
    if (lr.success) {
      setEncPassword('');
      setResult({ success: true, message: '加密会话已解锁，可以正常读写加密数据' });
    } else {
      setResult({ success: false, message: lr.error || '解锁失败' });
    }
  };

  // v2.2 云端已加密·本浏览器未解锁：用密码直接从云端备份恢复
  const handleCloudUnlock = async () => {
    if (!encPassword) { setResult({ success: false, message: '请输入加密密码' }); return; }
    setCloudUnlockBusy(true);
    setResult({ success: true, message: '正在从云端备份解锁...' });
    const r = await unlockWithCloudBackup(encPassword, async () => {
      const cr = await fetchRecoveryBackupFromCloud(basePath);
      return cr.success ? (cr.raw || null) : null;
    });
    setCloudUnlockBusy(false);
    if (r.success) {
      setEncPassword('');
      setEncConfirm('');
      setCloudLocked(false);
      setEncActive(true);
      setResult({ success: true, message: '已从云端备份恢复加密配置并解锁，可以正常读写加密数据' });
    } else {
      setResult({ success: false, message: r.error || '解锁失败' });
    }
  };

  // v2.2 手动迁移：加密云端已有的明文历史文件（供旧版本升级用户补加密）
  const handleMigrate = async () => {
    if (!hasSessionMK()) { setResult({ success: false, message: '请先解锁加密会话' }); return; }
    setMigrating(true);
    setMigrationStats(null);
    setResult({ success: true, message: '正在扫描云端历史文件...' });
    const mr = await encryptExistingFiles(basePath || '/我的坚果云/笔记', (cur, total) => {
      setResult({ success: true, message: `正在加密云端历史文件 ${cur}/${total}...` });
    });
    setMigrating(false);
    if (mr.success && mr.stats) {
      setMigrationStats(mr.stats);
      const s = mr.stats;
      const parts = [`新加密 ${s.migrated} 个`];
      if (s.alreadyEncrypted > 0) parts.push(`已加密 ${s.alreadyEncrypted} 个`);
      if (s.oldFormat > 0) parts.push(`旧格式 ${s.oldFormat} 个（登录时自动迁移）`);
      if (s.failed.length > 0) parts.push(`失败 ${s.failed.length} 个`);
      setResult({ success: s.failed.length === 0, message: `云端历史文件加密完成：${parts.join('，')}` });
    } else {
      setResult({ success: false, message: `历史文件迁移加密失败：${mr.error || '未知错误'}` });
    }
  };

  // v2.2 强制放弃云端旧加密数据（需二次确认），进入全新设置流程
  const handleForceReset = () => {
    if (!confirmForceReset) { setConfirmForceReset(true); return; }
    setForceReset(true);
    setCloudLocked(false);
    setConfirmForceReset(false);
    setEncPassword('');
    setEncConfirm('');
    setResult({ success: false, message: '已选择放弃云端旧加密数据。请设置新的加密密码，保存后将生成全新密钥并覆盖云端备份。' });
  };

  const handleSaveAndTest = async () => {
    if (!username || !password) { setResult({ success: false, message: '请输入账号和应用密码' }); return; }
    setTesting(true);
    setResult(null);

    const latestEnc = getEncryptSettings();
    const hasLocalKeys = hasLocalEncryptionKeys();

    if (encEnabled) {
      // 已是启用状态（本地已有完整配置）：解锁或直接连接，绝不重新生成密钥
      if (latestEnc.enabled || hasLocalKeys) {
        if (!hasSessionMK()) {
          if (!encPassword) { setResult({ success: false, message: '此浏览器尚未解锁加密会话，请输入加密密码解锁' }); setTesting(false); return; }
          setResult({ success: true, message: '正在验证加密密码...' });
          const lr = await loginWithPassword(encPassword, undefined, (msg) => setResult({ success: true, message: msg }));
          if (!lr.success) { setResult({ success: false, message: lr.error || '密码错误' }); setTesting(false); return; }
          setEncPassword('');
          setResult({ success: true, message: '加密会话已解锁，正在连接坚果云...' });
        }
        // 兼容旧版恢复遗留：本地已有完整密钥但 enc_settings 缺失时补写
        if (hasLocalKeys && !latestEnc.enabled) {
          saveEncryptSettings({ enabled: true, recoveryShown: true });
        }
      } else {
        // 首次启用：先检测云端是否已有恢复备份（防止覆盖旧数据）
        if (!checkedCloudOnEnable) {
          const cr = await fetchRecoveryBackupFromCloud(basePath);
          setCheckedCloudOnEnable(true);
          if (cr.success && cr.wrapped && !forceReset) {
            // v2.2 防误覆盖：检测到云端备份时禁止直接生成新密钥，强制走解锁/恢复流程
            setCloudBackupExists(true);
            setCloudLocked(true);
            setTesting(false);
            setResult({ success: false, message: '检测到云端已有加密配置备份。为防止旧数据无法读取，请先用密码或恢复码解锁；若确认放弃旧数据，可选择强制重新设置。' });
            return;
          }
        }
        if (!encPassword) { setResult({ success: false, message: '启用加密必须输入加密密码' }); setTesting(false); return; }
        if (encPassword.length < 6) { setResult({ success: false, message: '加密密码至少 6 位' }); setTesting(false); return; }
        if (encPassword !== encConfirm) { setResult({ success: false, message: '两次输入的加密密码不一致' }); setTesting(false); return; }

        setResult({ success: true, message: '正在设置加密...' });
        const r = await setupEncryption(encPassword, (msg) => setResult({ success: true, message: msg }));
        if (!r.success) { setResult({ success: false, message: r.error || '设置失败' }); setTesting(false); return; }

        // 首次启用：保存坚果云配置并显示恢复码
        await saveCredentialsSmart(username, password);
        setNutstoreBasePath(basePath);
        setIsConnected(true);
        if (r.recoveryCode) {
          setRecoveryCode(r.recoveryCode);
          setShowRecoveryModal(true);
          setTesting(false);
          return;
        }
        setEncActive(true);
      }
    } else {
      clearEncryptSettings();
      setEncActive(false);
      setCloudBackupOk(false);
      setCloudBackupError('');
      setCloudLocked(false);
      setForceReset(false);
      setConfirmForceReset(false);
      setCheckedCloudOnEnable(false);
      setMigrationStats(null);
    }

    await saveCredentialsSmart(username, password);
    setNutstoreBasePath(basePath);
    const testResult = await testConnectionWithDetails(basePath);
    if (testResult.rootFolders) setAvailableFolders(testResult.rootFolders);
    if (testResult.basePathFiles) setBasePathFiles(testResult.basePathFiles);
    if (testResult.basePathFolders) setBasePathFolders(testResult.basePathFolders);
    if (testResult.pathResults) setPathResults(testResult.pathResults);
    setShowDebug(true);

    if (testResult.success) {
      setResult({ success: true, message: '坚果云已连接，正在读取数据...' });
      setIsConnected(true);
      try { await loadEntries(); } catch (e) { console.error('加载数据失败:', e); }
      const store = await import('../hooks/useSummaryStore').then(m => m.useSummaryStore.getState());
      if (store.error) { setResult({ success: false, message: store.error }); setTesting(false); return; }
      setResult({ success: true, message: `坚果云已连接，读取到 ${store.entries.length} 条记录` });
      setTesting(false);
      setTimeout(onClose, 1000);
    } else {
      setTesting(false);
      setResult({ success: false, message: testResult.error || '连接失败' });
      if (testResult.status === 401) { clearEncryptSettings(); clearCredentials(); setEncActive(false); setIsConnected(false); }
    }
  };

  const handleDisconnect = () => {
    clearEncryptSettings();
    logout();
    setEncEnabled(false);
    setEncPassword('');
    setEncConfirm('');
    setEncActive(false);
    setCloudBackupOk(false);
    setCloudBackupError('');
    setCloudBackupExists(false);
    setCheckedCloudOnEnable(false);
    setCloudLocked(false);
    setForceReset(false);
    setConfirmForceReset(false);
    setMigrationStats(null);
    clearCredentials();
    setIsConnected(false);
    setResult({ success: false, message: '已断开连接' });
  };

  const handleForgotPassword = async () => {
    setForgotResult(null);
    setForgotBusy(true);
    if (!forgotRecovery.trim()) { setForgotResult({ success: false, message: '请输入恢复码' }); setForgotBusy(false); return; }
    if (!forgotNewPassword || forgotNewPassword.length < 6) { setForgotResult({ success: false, message: '新密码至少 6 位' }); setForgotBusy(false); return; }
    if (forgotNewPassword !== forgotConfirm) { setForgotResult({ success: false, message: '两次密码不一致' }); setForgotBusy(false); return; }
    const { resetPasswordWithRecovery } = await import('../lib/crypto');
    const r = await resetPasswordWithRecovery(
      forgotRecovery, forgotNewPassword,
      async () => {
        const cr = await fetchRecoveryBackupFromCloud(basePath);
        return cr.success && cr.wrapped ? cr.wrapped : null;
      },
    );
    setForgotBusy(false);
    if (r.success) {
      setEncActive(true);
      setCloudBackupOk(true);
      setCloudBackupError('');
      setForgotResult({ success: true, message: '密码重置成功！请牢记新密码。' });
      setTimeout(() => { setShowForgotModal(false); setForgotRecovery(''); setForgotNewPassword(''); setForgotConfirm(''); setForgotResult(null); }, 2000);
    } else {
      setForgotResult({ success: false, message: r.error || '重置失败' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-gray-800">坚果云配置</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {isConnected && (
            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-xl text-sm">
              <Check className="w-5 h-5 flex-shrink-0" />
              <div><p className="font-medium">坚果云已连接</p><p className="text-xs text-green-600/70">数据将通过坚果云同步</p></div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">坚果云账号</label>
            <input type="email" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="wxpemail@163.com"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-amber-400 transition-colors text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">应用密码<span className="text-xs text-gray-400 font-normal ml-1">（不是登录密码）</span></label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="第三方应用密码"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-amber-400 transition-colors text-sm" />
            <p className="text-xs text-gray-400 mt-1">在坚果云设置 → 安全选项 → 第三方应用管理中获取</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
              <FolderOpen className="w-4 h-4" />同步目录
            </label>
            <input type="text" value={basePath} onChange={(e) => setBasePath(e.target.value)} placeholder="/笔记"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-amber-400 transition-colors text-sm" />
            <div className="mt-2">
              <button onClick={handleLoadFolders} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700">
                <ChevronRight className={`w-3 h-3 transition-transform ${showFolders ? 'rotate-90' : ''}`} />
                选择云端文件夹 ({availableFolders.length}个)
              </button>
              {showFolders && availableFolders.length > 0 && (
                <div className="mt-2 space-y-1">
                  {availableFolders.map((folder) => (
                    <button key={folder} onClick={() => { setBasePath(`/${folder}`); setShowFolders(false); }}
                      className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 bg-gray-50 rounded-lg hover:bg-amber-50 hover:text-amber-700 transition-colors">/{folder}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 加密设置 */}
          <div className="border-t border-gray-100 pt-4 mt-2">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-800 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-500" />坚果云端到端加密
              </label>
              <button type="button" onClick={() => setEncEnabled(!encEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${encEnabled ? 'bg-amber-500' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${encEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {encEnabled && (
              <div className="space-y-3">
                {encActive ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <p className="text-sm font-medium text-green-800">已启用加密</p>
                    </div>
                    <p className="text-xs text-green-700 leading-relaxed">
                      {hasSessionMK()
                        ? '当前会话已解锁，数据读写自动加解密。'
                        : '当前会话未解锁，重建数据或刷新页面后需输入加密密码。'}
                    </p>
                    {migrating && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">正在加密云端历史文件，请勿关闭此窗口...</div>
                    )}
                    {migrationStats && !migrating && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700">
                        历史文件加密统计：新加密 {migrationStats.migrated} 个、已加密 {migrationStats.alreadyEncrypted} 个
                        {migrationStats.oldFormat > 0 && `、旧格式 ${migrationStats.oldFormat} 个（登录时自动迁移）`}
                        {migrationStats.failed.length > 0 && `、失败 ${migrationStats.failed.length} 个：${migrationStats.failed.map(f => f.file.split('/').pop()).join('、')}`}
                      </div>
                    )}
                    {!hasSessionMK() && (
                      <div className="space-y-2">
                        <input type="password" value={encPassword} onChange={(e) => setEncPassword(e.target.value)} placeholder="输入加密密码解锁会话"
                          className="w-full px-3 py-2 bg-white border border-green-200 rounded-xl focus:outline-none focus:border-green-400 transition-colors text-sm" />
                        <button type="button" onClick={handleUnlock} disabled={testing || !encPassword}
                          className="w-full py-2 px-3 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          解锁会话
                        </button>
                      </div>
                    )}
                    {hasSessionMK() && (
                      <div className="space-y-2">
                        <button type="button" onClick={handleMigrate} disabled={migrating}
                          className="w-full py-2 px-3 bg-green-50 text-green-700 text-sm font-medium rounded-xl hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          {migrating ? '正在加密云端历史文件...' : '加密云端历史明文文件'}
                        </button>
                        <p className="text-[11px] text-green-600/80 leading-relaxed">
                          将云端（含 journal/brain 子目录）所有明文 .md 笔记加密为密文，已加密文件自动跳过。建议执行一次，确保坚果云网页端看不到笔记内容。
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs">
                      {backingUp ? (
                        <span className="text-amber-600">正在备份恢复密钥到云端...</span>
                      ) : cloudBackupOk ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <Check className="w-3.5 h-3.5" />恢复密钥已备份到坚果云，换机或清缓存后可用恢复码找回</span>
                      ) : (
                        <span className="text-red-500">恢复密钥云端备份异常：{cloudBackupError || '未备份'}</span>
                      )}
                    </div>
                    <button type="button" onClick={() => setShowForgotModal(true)}
                      className="w-full py-2 px-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors">
                      忘记密码？使用恢复码重置
                    </button>
                    <button type="button" onClick={() => setShowChangeModal(true)}
                      className="w-full py-2 px-3 bg-amber-50 text-amber-700 text-sm font-medium rounded-xl hover:bg-amber-100 transition-colors">
                      修改加密密码
                    </button>
                  </div>
                ) : cloudLocked && !forceReset ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <p className="text-sm font-medium text-blue-800">云端已加密 · 本浏览器未解锁</p>
                    </div>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      检测到云端该目录已有加密配置备份（本浏览器未保存密钥，常见于清除浏览器数据、换设备或无痕窗口）。输入原加密密码即可恢复，不会覆盖任何数据。
                    </p>
                    <input type="password" value={encPassword} onChange={(e) => setEncPassword(e.target.value)} placeholder="输入原加密密码解锁"
                      className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl focus:outline-none focus:border-blue-400 transition-colors text-sm" />
                    <button type="button" onClick={handleCloudUnlock} disabled={cloudUnlockBusy || !encPassword}
                      className="w-full py-2 px-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {cloudUnlockBusy ? '正在解锁...' : '用密码解锁'}
                    </button>
                    <button type="button" onClick={() => setShowForgotModal(true)}
                      className="w-full py-2 px-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors">
                      忘记密码？使用恢复码重置
                    </button>
                    <div className="border-t border-blue-100 pt-2">
                      <button type="button" onClick={handleForceReset}
                        className="w-full py-2 px-3 text-red-600 text-xs font-medium rounded-xl hover:bg-red-50 transition-colors">
                        {confirmForceReset ? '⚠ 再次点击确认：永久放弃云端旧加密数据（不可恢复）' : '放弃云端旧加密数据，强制重新设置'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">加密密码 <span className="text-amber-600">（不落盘，仅用于派生密钥）</span></label>
                      <input type="password" value={encPassword} onChange={(e) => setEncPassword(e.target.value)} placeholder="至少 6 位，务必牢记"
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-amber-400 transition-colors text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">确认密码</label>
                      <input type="password" value={encConfirm} onChange={(e) => setEncConfirm(e.target.value)} placeholder="再次输入加密密码"
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-amber-400 transition-colors text-sm" />
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                      <p className="text-[11px] text-amber-700 leading-relaxed font-medium mb-1">️ 重要提醒</p>
                      <ul className="text-[11px] text-amber-600 leading-relaxed space-y-0.5 list-disc list-inside">
                        <li>密码<strong>不存储</strong>在浏览器中，每次会话需重新输入</li>
                        <li>设置时会生成<strong>恢复码</strong>，务必安全保存</li>
                        <li>忘记密码可用恢复码或云端备份（密码通道）重置</li>
                        <li>开启后将<strong>自动加密云端已有的明文笔记</strong></li>
                        <li>坚果云无法搜索加密文件内容</li>
                      </ul>
                    </div>
                    {cloudBackupExists && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                        <p className="text-[11px] text-red-600 leading-relaxed">⚠️ 检测到云端存在恢复密钥备份文件（.xinguang_recovery.json）。保存后将生成全新密钥并<strong>覆盖该备份</strong>；若之前有真实加密过的笔记且未迁移，将无法读取。如需找回旧数据，请先点击下方"忘记密码？使用恢复码重置"。</p>
                      </div>
                    )}
                    {cloudBackupExists && (
                      <button type="button" onClick={() => setShowForgotModal(true)}
                        className="w-full py-2 px-3 bg-blue-50 text-blue-700 text-sm font-medium rounded-xl hover:bg-blue-100 transition-colors">
                        在云端找到恢复密钥 · 用恢复码找回旧数据
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {result.success ? <Check className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
              <span>{result.message}</span>
            </div>
          )}

          {showDebug && (
            <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-2">
              <p className="font-medium text-gray-600">调试信息</p>
              <p className="text-gray-500">当前路径: <span className="text-gray-800">{basePath}</span></p>
              <p className="text-gray-500">根目录文件夹: <span className="text-gray-800">{availableFolders.join(', ') || '无'}</span></p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2 sticky bottom-0 bg-white">
          {isConnected ? (
            <button onClick={handleDisconnect} className="flex-1 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-medium text-sm">断开连接</button>
          ) : null}
          <button onClick={handleSaveAndTest} disabled={testing}
            className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {testing ? '处理中...' : isConnected ? '保存并测试' : '保存并连接'}
          </button>
        </div>
      </div>

      {/* 恢复码弹窗 */}
      {showRecoveryModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" />恢复码
            </h3>
            <p className="text-sm text-gray-600">
              这是你的<strong>恢复码</strong>，忘记密码时用它重置。请安全保存：
            </p>
            <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
              <li>复制到记事本存 U 盘或打印纸质保存</li>
              <li><strong>不要截图</strong>（截图可能同步到云端）</li>
              <li>关闭此窗口后不再显示</li>
              <li>确认后恢复密钥将<strong>自动备份到坚果云</strong>，换机/清缓存后仍可恢复</li>
            </ul>
            <div className="bg-gray-100 rounded-xl p-4 text-center">
              <code className="text-lg font-mono font-bold text-amber-700 tracking-wider">{recoveryCode}</code>
            </div>
            <button onClick={() => { const ok = copyTextSafe(recoveryCode.replace(/-/g, '')); setResult({ success: ok, message: ok ? '已复制（不含横线）' : '复制失败，请手动抄写恢复码' }); }}
              className="w-full py-2 bg-gray-100 text-gray-700 text-sm rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-1">
              <Copy className="w-4 h-4" />复制恢复码
            </button>
            <div className="border-t pt-3 space-y-3">
              <p className="text-xs text-gray-600 font-medium">请输入恢复码以确认已保存：</p>
              <input type="text" value={recoveryInput} onChange={(e) => { setRecoveryInput(e.target.value); setRecoveryVerified(false); }}
                placeholder="输入恢复码（横线可选）"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono tracking-wider focus:outline-none focus:border-amber-400" />
              {recoveryVerified && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input type="checkbox" checked={confirmedSaved} onChange={(e) => setConfirmedSaved(e.target.checked)} className="rounded" />
                    我已确认将恢复码保存在安全位置
                  </label>
                  <button onClick={handleConfirmRecovery} disabled={!confirmedSaved || countdown > 0 || backingUp}
                    className="w-full py-2 bg-amber-500 text-white text-sm rounded-xl disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                    {backingUp ? '正在备份恢复密钥...' : countdown > 0 ? `${countdown} 秒后可确认` : '确认完成'}
                  </button>
                </div>
              )}
              {!recoveryVerified && (
                <button onClick={handleVerifyRecovery} disabled={!recoveryInput.trim()}
                  className="w-full py-2 bg-amber-500 text-white text-sm rounded-xl disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                  验证恢复码
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 忘记密码弹窗 */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800">忘记密码 - 使用恢复码重置</h3>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">恢复码</label>
              <input type="text" value={forgotRecovery} onChange={(e) => setForgotRecovery(e.target.value)} placeholder="输入恢复码"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono tracking-wider focus:outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">新密码</label>
              <input type="password" value={forgotNewPassword} onChange={(e) => setForgotNewPassword(e.target.value)} placeholder="至少 6 位"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">确认新密码</label>
              <input type="password" value={forgotConfirm} onChange={(e) => setForgotConfirm(e.target.value)} placeholder="再次输入新密码"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400" />
            </div>
            {forgotResult && (
              <div className={`p-3 rounded-xl text-sm ${forgotResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {forgotResult.message}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setShowForgotModal(false); setForgotResult(null); }} disabled={forgotBusy}
                className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50">取消</button>
              <button onClick={handleForgotPassword} disabled={forgotBusy}
                className="flex-1 py-2 bg-amber-500 text-white text-sm rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50">{forgotBusy ? '处理中...' : '重置密码'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 修改加密密码弹窗 */}
      {showChangeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800">修改加密密码</h3>
            <p className="text-xs text-gray-500">修改后需用新密码解锁会话，主密钥不变，已有数据不受影响。若忘记当前密码，请使用「忘记密码？使用恢复码重置」。</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">当前密码</label>
              <input type="password" value={changeCurrent} onChange={(e) => setChangeCurrent(e.target.value)} placeholder="输入当前加密密码"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">新密码</label>
              <input type="password" value={changeNew} onChange={(e) => setChangeNew(e.target.value)} placeholder="至少 6 位"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">确认新密码</label>
              <input type="password" value={changeConfirm} onChange={(e) => setChangeConfirm(e.target.value)} placeholder="再次输入新密码"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400" />
            </div>
            {changeResult && (
              <div className={`p-3 rounded-xl text-sm ${changeResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {changeResult.message}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setShowChangeModal(false); setChangeResult(null); }} disabled={changeBusy}
                className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50">取消</button>
              <button onClick={handleChangePassword} disabled={changeBusy}
                className="flex-1 py-2 bg-amber-500 text-white text-sm rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50">{changeBusy ? '处理中...' : '确认修改'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
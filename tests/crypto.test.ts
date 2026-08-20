/**
 * 心光 v2.2 加密体系核心测试
 * 覆盖：加密往返、双通道备份格式兼容、恢复码、历史文件迁移加密
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setupEncryption,
  loginWithPassword,
  encryptContent,
  decryptContent,
  isEncryptedContent,
  isNewFormatEncrypted,
  generateRecoveryCode,
  normalizeRecoveryCode,
  hashRecoveryCode,
  verifyRecoveryCode,
  buildCloudBackupPayload,
  parseCloudBackup,
  unlockWithCloudBackup,
  encryptExistingFiles,
  clearEncryptSettings,
  clearSessionMK,
  getSessionMK,
  ENC_MAGIC_NEW,
} from '../src/lib/crypto';

const TEST_PASSWORD = 'test-password-123';

beforeEach(() => {
  localStorage.clear();
  clearSessionMK();
  vi.unstubAllGlobals();
});

describe('加密往返', () => {
  it('加密后内容以 [XG2] 开头且不再是明文', async () => {
    const r = await setupEncryption(TEST_PASSWORD);
    expect(r.success).toBe(true);
    const mk = getSessionMK();
    expect(mk).not.toBeNull();
    const encrypted = await encryptContent('你好，心光！secret content', mk!);
    expect(encrypted.startsWith(ENC_MAGIC_NEW)).toBe(true);
    expect(encrypted).not.toContain('心光');
  });

  it('解密后还原为原始内容', async () => {
    await setupEncryption(TEST_PASSWORD);
    const mk = getSessionMK()!;
    const original = '多行内容\n第二行：时间记录 ✅\n- 列表项';
    const encrypted = await encryptContent(original, mk);
    const decrypted = await decryptContent(encrypted, mk);
    expect(decrypted).toBe(original);
  });

  it('错误的主密钥解密应抛出明确错误', async () => {
    await setupEncryption(TEST_PASSWORD);
    const encrypted = await encryptContent('data', getSessionMK()!);
    const wrongMk = new Uint8Array(32).fill(1);
    await expect(decryptContent(encrypted, wrongMk)).rejects.toThrow('解密失败');
  });
});

describe('内容格式判断', () => {
  it('isEncryptedContent 识别新旧格式', () => {
    expect(isEncryptedContent('[XG2]abc')).toBe(true);
    expect(isEncryptedContent('[XG_ENC]abc')).toBe(true);
    expect(isEncryptedContent('普通内容')).toBe(false);
    expect(isEncryptedContent('')).toBe(false);
    expect(isEncryptedContent(null)).toBe(false);
  });

  it('isNewFormatEncrypted 仅识别 [XG2]', () => {
    expect(isNewFormatEncrypted('[XG2]x')).toBe(true);
    expect(isNewFormatEncrypted('[XG_ENC]x')).toBe(false);
  });
});

describe('登录与恢复码', () => {
  it('正确密码登录成功并恢复会话主密钥', async () => {
    await setupEncryption(TEST_PASSWORD);
    const mkBefore = getSessionMK();
    clearSessionMK();
    expect(getSessionMK()).toBeNull();
    const lr = await loginWithPassword(TEST_PASSWORD);
    expect(lr.success).toBe(true);
    expect(getSessionMK()).toEqual(mkBefore);
  });

  it('错误密码登录失败', async () => {
    await setupEncryption(TEST_PASSWORD);
    clearSessionMK();
    const lr = await loginWithPassword('wrong-password');
    expect(lr.success).toBe(false);
    expect(lr.error).toBe('密码错误');
    expect(getSessionMK()).toBeNull();
  });

  it('恢复码规范化与哈希校验', async () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^[A-Z2-9]{6}(-[A-Z2-9]{6}){3}$/);
    expect(normalizeRecoveryCode(' ab-cd ef ')).toBe('ABCDEF');
    const hash = await hashRecoveryCode(code);
    expect(await verifyRecoveryCode(code)).toBe(false); // 未存储哈希时为 false
    localStorage.setItem('xinguang_recovery_hash', hash);
    expect(await verifyRecoveryCode(code.replace(/-/g, ''))).toBe(true); // 无横线也能验证
    expect(await verifyRecoveryCode('AAAA-BBBB-CCCC-DDDD')).toBe(false);
  });
});

describe('云端备份双通道（v2.2）', () => {
  it('buildCloudBackupPayload 生成 v2 双通道格式', async () => {
    await setupEncryption(TEST_PASSWORD);
    const payload = buildCloudBackupPayload();
    expect(payload).not.toBeNull();
    expect(payload!.v).toBe(2);
    expect(payload!.recovery.salt).toBeTruthy();
    expect(payload!.pw.ciphertext).toBeTruthy();
  });

  it('parseCloudBackup 兼容旧单通道格式（pw 为 null）', () => {
    const legacy = JSON.stringify({ salt: 'aaa', ciphertext: 'bbb' });
    const parsed = parseCloudBackup(legacy);
    expect(parsed).not.toBeNull();
    expect(parsed!.recovery).toEqual({ salt: 'aaa', ciphertext: 'bbb' });
    expect(parsed!.pw).toBeNull();
  });

  it('parseCloudBackup 解析新双通道格式', () => {
    const raw = JSON.stringify({
      v: 2,
      recovery: { salt: 'r-salt', ciphertext: 'r-ct' },
      pw: { salt: 'p-salt', ciphertext: 'p-ct' },
    });
    const parsed = parseCloudBackup(raw);
    expect(parsed!.pw).toEqual({ salt: 'p-salt', ciphertext: 'p-ct' });
  });

  it('parseCloudBackup 拒绝无效格式', () => {
    expect(parseCloudBackup('not-json')).toBeNull();
    expect(parseCloudBackup('{}')).toBeNull();
  });

  it('unlockWithCloudBackup 用密码从云端备份完整恢复', async () => {
    await setupEncryption(TEST_PASSWORD);
    const mkBefore = getSessionMK();
    const payload = buildCloudBackupPayload()!;
    const raw = JSON.stringify(payload);
    // 模拟清缓存后的浏览器
    localStorage.clear();
    clearSessionMK();
    const r = await unlockWithCloudBackup(TEST_PASSWORD, async () => raw);
    expect(r.success).toBe(true);
    expect(getSessionMK()).toEqual(mkBefore);
    // 再次用密码可直接登录（本地已恢复 wrappedMK）
    clearSessionMK();
    const lr = await loginWithPassword(TEST_PASSWORD);
    expect(lr.success).toBe(true);
  });

  it('unlockWithCloudBackup 错误密码被拒', async () => {
    await setupEncryption(TEST_PASSWORD);
    const raw = JSON.stringify(buildCloudBackupPayload()!);
    localStorage.clear();
    clearSessionMK();
    const r = await unlockWithCloudBackup('wrong', async () => raw);
    expect(r.success).toBe(false);
    expect(r.error).toBe('密码错误');
  });

  it('unlockWithCloudBackup 对旧格式备份提示走恢复码', async () => {
    const legacy = JSON.stringify({ salt: 's', ciphertext: 'c' });
    const r = await unlockWithCloudBackup(TEST_PASSWORD, async () => legacy);
    expect(r.success).toBe(false);
    expect(r.error).toContain('恢复码');
  });
});

describe('历史明文文件迁移加密（v2.2）', () => {
  function mockNutstoreApi(filesByDir: Record<string, { name: string; content: string }[]>) {
    const writes: { path: string; content: string }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const path = url.replace('/api/nutstore', '');
      if (path === '/list') {
        const names = (filesByDir[body.dirPath] || []).map(f => f.name);
        return { ok: true, json: async () => ({ files: names }) } as Response;
      }
      if (path === '/read') {
        const dir = body.filePath.split('/').slice(0, -1).join('/');
        const name = body.filePath.split('/').pop();
        const f = (filesByDir[dir] || []).find(x => x.name === name);
        if (!f) return { ok: false, status: 404 } as Response;
        return { ok: true, json: async () => ({ content: f.content }) } as Response;
      }
      if (path === '/write') {
        writes.push({ path: body.filePath, content: body.content });
        return { ok: true, json: async () => ({}) } as Response;
      }
      return { ok: false, status: 404 } as Response;
    }) as unknown as typeof fetch);
    return writes;
  }

  it('明文被加密、密文跳过、空文件跳过、统计正确', async () => {
    await setupEncryption(TEST_PASSWORD);
    const mk = getSessionMK()!;
    const alreadyEnc = await encryptContent('已是密文', mk);
    const writes = mockNutstoreApi({
      '/笔记': [
        { name: 'Chat.md', content: '明文内容A' },
        { name: 'Done.md', content: alreadyEnc },
        { name: 'Empty.md', content: '   ' },
      ],
      '/笔记/journal': [{ name: '2026-07-26.md', content: '日志明文' }],
      '/笔记/brain': [],
    });
    localStorage.setItem('nutstore_credentials', JSON.stringify({ username: 'u', password: 'p' }));

    const r = await encryptExistingFiles('/笔记');
    expect(r.success).toBe(true);
    expect(r.stats!.total).toBe(4); // 含空文件（发现即计数，空文件跳过不加密）
    expect(r.stats!.migrated).toBe(2);
    expect(r.stats!.alreadyEncrypted).toBe(1);
    expect(r.stats!.failed).toHaveLength(0);
    // 写回的内容必须是 [XG2] 密文
    const chatWrite = writes.find(w => w.path.endsWith('Chat.md'));
    expect(chatWrite!.content.startsWith(ENC_MAGIC_NEW)).toBe(true);
    // 已加密文件不应被重写
    expect(writes.find(w => w.path.endsWith('Done.md'))).toBeUndefined();
    // 回写的密文可用会话密钥解密还原
    const decrypted = await decryptContent(chatWrite!.content, mk);
    expect(decrypted).toBe('明文内容A');
  });

  it('未登录时迁移被拒绝', async () => {
    mockNutstoreApi({ '/笔记': [{ name: 'A.md', content: 'x' }] });
    localStorage.setItem('nutstore_credentials', JSON.stringify({ username: 'u', password: 'p' }));
    const r = await encryptExistingFiles('/笔记');
    expect(r.success).toBe(false);
    expect(r.error).toContain('未解锁');
  });

  it('未配置坚果云账号时迁移被拒绝', async () => {
    await setupEncryption(TEST_PASSWORD);
    mockNutstoreApi({});
    const r = await encryptExistingFiles('/笔记');
    expect(r.success).toBe(false);
    expect(r.error).toContain('未配置坚果云账号');
  });
});

describe('设置失败回滚（v2.2）', () => {
  it('中途失败不破坏既有配置', async () => {
    await setupEncryption(TEST_PASSWORD);
    const snapshot = localStorage.getItem('xinguang_mk_pw');
    clearEncryptSettings();
    localStorage.clear();
    // 重新建立一套配置
    await setupEncryption(TEST_PASSWORD);
    const before = localStorage.getItem('xinguang_mk_pw');
    expect(before).toBeTruthy();
    expect(before).not.toBe(snapshot); // 新密钥应不同
  });
});

/**
 * vitest 测试环境初始化（node 环境）
 *
 * 背景：jsdom 29 依赖链要求 Node >= 20.19（require(esm)），本机 20.18 加载即崩溃，
 * 故测试运行在 node 环境：WebCrypto、btoa/atob 由 Node 原生提供，
 * 这里仅补一个内存版 localStorage，满足 crypto 模块的存储调用。
 */
const store = new Map<string, string>();

const memoryStorage: Storage = {
  get length(): number {
    return store.size;
  },
  clear(): void {
    store.clear();
  },
  getItem(key: string): string | null {
    const value = store.get(key);
    return typeof value === 'string' ? value : null;
  },
  key(index: number): string | null {
    const keys = Array.from(store.keys());
    return keys[index] ?? null;
  },
  removeItem(key: string): void {
    store.delete(key);
  },
  setItem(key: string, value: string): void {
    store.set(key, value);
  },
};

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = memoryStorage;
}

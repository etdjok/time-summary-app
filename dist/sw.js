// 退役 Service Worker：清除旧版 PWA 缓存并注销自身
// 部署后浏览器会自动安装此 SW，然后立即卸载，保证页面始终加载最新服务器资源
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 删除所有旧缓存
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    // 接管所有客户端并强制刷新，避免旧页面继续使用缓存代码
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.navigate(client.url));
    // 注销自身（必须先 unregister，否则 re-register 会重新启用）
    await self.registration.unregister();
  })());
});
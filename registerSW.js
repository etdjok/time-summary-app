// 版本号 - 每次发布新版本时更新此值
const APP_VERSION = 'v1.18.8';

// 简化版 Service Worker 注册 - 不检测更新，不自动刷新
if('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // 只注册一次，避免重复注册导致问题
    if (!sessionStorage.getItem('sw_ready')) {
      navigator.serviceWorker.register('./sw.js?v=' + APP_VERSION, { scope: './' })
        .then(() => {
          sessionStorage.setItem('sw_ready', 'true');
          console.log('Service Worker 注册成功');
        })
        .catch(error => {
          console.log('Service Worker 注册失败:', error);
        });
    }
  });
}


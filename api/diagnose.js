// 坚果云连接诊断脚本 - 修复版
const NUTSTORE_WEBDAV_URL = 'https://dav.jianguoyun.com/dav';

function encodePath(pathStr) {
  // 正确编码：过滤空字符串，避免 %2F 双重编码
  return pathStr.split('/').filter(s => s).map(s => encodeURIComponent(s)).join('/');
}

async function testConnection(username, password, testPath = '/') {
  console.log('=== 坚果云连接诊断（修复版）===');
  console.log('用户名:', username);
  console.log('密码长度:', password.length);
  console.log('');

  // Base64 编码
  const raw = username + ':' + password;
  const token = Buffer.from(raw).toString('base64');
  console.log('认证令牌: Basic ' + token.substring(0, 20) + '...');
  console.log('');

  // 测试根路径
  const url = testPath === '/' 
    ? NUTSTORE_WEBDAV_URL + '/'
    : NUTSTORE_WEBDAV_URL + '/' + encodePath(testPath);
  console.log('测试 URL:', url);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + token,
      },
    });

    console.log('状态码:', response.status);

    if (response.status === 200 || response.status === 207) {
      console.log('✅ 连接成功！密码正确');
    } else if (response.status === 401) {
      console.log('❌ 认证失败 - 账号或密码错误');
    } else if (response.status === 403) {
      console.log('❌ 访问被拒绝 - 可能是权限问题');
    } else {
      console.log('⚠️ 其他状态码:', response.status);
      const text = await response.text();
      console.log('响应:', text.substring(0, 200));
    }
  } catch (error) {
    console.log('❌ 网络错误:', error.message);
  }
  
  console.log('');
  
  // 额外测试：直接访问根路径
  console.log('--- 额外测试：根路径 ---');
  try {
    const rootUrl = NUTSTORE_WEBDAV_URL + '/';
    const response = await fetch(rootUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + token,
      },
    });
    console.log('根路径状态码:', response.status);
    if (response.status === 200 || response.status === 207) {
      console.log('✅ 根路径连接成功！');
    } else if (response.status === 401) {
      console.log('❌ 根路径认证失败');
    }
  } catch (error) {
    console.log('❌ 根路径网络错误:', error.message);
  }
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('用法: node diagnose.js <用户名> <密码> [路径]');
  console.log('示例: node diagnose.js wxpemail@163.com abc123 /笔记');
  process.exit(1);
}

const [username, password, path] = args;
testConnection(username, password, path || '/');

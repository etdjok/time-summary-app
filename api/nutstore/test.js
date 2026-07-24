const NUTSTORE_WEBDAV_URL = 'https://dav.jianguoyun.com/dav';

function encodePath(pathStr) {
  return pathStr.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

async function makeNutstoreRequest(url, options = {}) {
  const { username, password, ...rest } = options;
  
  if (!username || !password) {
    return { ok: false, status: 400, text: () => Promise.resolve('未提供凭据') };
  }

  const token = Buffer.from(`${username}:${password}`).toString('base64');
  
  return fetch(url, {
    ...rest,
    headers: {
      ...rest.headers,
      Authorization: `Basic ${token}`,
    },
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '方法不支持' });
  }
  
  try {
    const { username, password, basePath = '/我的坚果云/笔记' } = req.body;
    
    const knownFiles = ['Chat.md', 'Later.md', 'Help.md', 'Readme.md'];
    const pathResults = [];
    
    for (const testPath of ['/笔记', '/我的坚果云/笔记', '/']) {
      const result = { path: testPath, status: 0, files: [], folders: [] };
      
      for (const file of knownFiles) {
        const resp = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${encodePath(testPath)}/${file}`, {
          username,
          password,
          method: 'GET',
        });
        if (resp.ok) {
          result.files.push(file);
          result.status = resp.status;
        }
      }
      
      if (testPath === '/') {
        result.folders = result.files.length > 0 ? ['我的坚果云'] : [];
      }
      
      pathResults.push(result);
    }
    
    const targetResult = pathResults.find(r => r.path === basePath);
    
    if (pathResults.every(r => r.status === 0)) {
      return res.status(200).json({ success: false, error: '账号或密码错误', status: 401 });
    }
    
    return res.status(200).json({
      success: true,
      rootFolders: pathResults.find(r => r.path === '/')?.folders || [],
      basePathFiles: targetResult?.files || [],
      basePathFolders: targetResult?.folders || [],
      pathResults,
    });
  } catch (error) {
    return res.status(200).json({ success: false, error: error.message });
  }
}
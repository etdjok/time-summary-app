import express from 'express';
import cors from 'cors';
import { parseStringPromise } from 'xml2js';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const DIST_DIR = path.join(__dirname, '..', 'dist');
app.use(express.static(DIST_DIR));

// 服务器端密码存储
const PASSWORD_FILE = path.join(__dirname, 'password.json');
const DEFAULT_PASSWORD = 'xinguang2026';

function getServerPassword() {
  try {
    if (existsSync(PASSWORD_FILE)) {
      const data = JSON.parse(readFileSync(PASSWORD_FILE, 'utf-8'));
      return data.password || DEFAULT_PASSWORD;
    }
  } catch {}
  return DEFAULT_PASSWORD;
}

function setServerPassword(password) {
  writeFileSync(PASSWORD_FILE, JSON.stringify({ password }), 'utf-8');
}

// 验证密码
app.post('/api/auth/verify', (req, res) => {
  const { password } = req.body;
  if (password === getServerPassword()) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// 修改密码
app.post('/api/auth/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (currentPassword !== getServerPassword()) {
    res.json({ success: false, error: '当前密码错误' });
    return;
  }
  if (!newPassword || newPassword.length < 4) {
    res.json({ success: false, error: '新密码至少4个字符' });
    return;
  }
  setServerPassword(newPassword);
  res.json({ success: true });
});

const NUTSTORE_WEBDAV_URL = 'https://dav.jianguoyun.com/dav';

function encodePath(pathStr) {
  return pathStr.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

async function makeNutstoreRequest(url, options = {}) {
  const { username, password } = options;
  
  if (!username || !password) {
    throw new Error('未提供坚果云凭据');
  }

  const token = Buffer.from(`${username}:${password}`).toString('base64');
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Basic ${token}`,
    },
  });
  
  return response;
}

async function parseWebDAVResponse(xmlText) {
  try {
    const result = await parseStringPromise(xmlText, {
      explicitArray: false,
      ignoreNamespace: true,
      tagNameProcessors: [(tag) => tag.replace(/^d:/, '')],
    });
    
    const multistatus = result.multistatus || result['d:multistatus'];
    const responsesRaw = multistatus?.response || multistatus?.['d:response'];
    const responses = Array.isArray(responsesRaw) ? responsesRaw : (responsesRaw ? [responsesRaw] : []);
    
    return responses.map(response => {
      const href = response.href || response['d:href'] || '';
      return { href };
    });
  } catch (error) {
    console.error('XML解析失败:', error);
    return [];
  }
}

// 测试连接
app.post('/api/nutstore/test', async (req, res) => {
  try {
    const { username, password, basePath = '/笔记' } = req.body;
    
    console.log('开始测试连接...');

    const knownFiles = ['Chat.md', 'Later.md', 'Help.md', 'Readme.md'];
    const pathsToTest = ['/笔记', '/我的坚果云/笔记', '/'];
    const pathResults = [];

    for (const testPath of pathsToTest) {
      const result = { path: testPath, status: 0, files: [], folders: [] };
      
      for (const file of knownFiles) {
        const encodedPath = encodePath(`${testPath}/${file}`);
        const testResponse = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${encodedPath}`, {
          username,
          password,
          method: 'GET',
        });
        
        console.log(`测试路径 ${testPath}/${file} 状态:`, testResponse.status);
        
        if (testResponse.status === 401) {
          res.json({ success: false, status: 401, error: '账号或密码错误', pathResults });
          return;
        }
        
        if (testResponse.ok) {
          result.files.push(file);
          result.status = testResponse.status;
        }
      }
      
      if (testPath === '/') {
        result.folders = result.files.length > 0 ? ['我的坚果云'] : [];
      }
      
      pathResults.push(result);
    }

    const rootFolders = pathResults.find(r => r.path === '/')?.folders || [];
    const targetResult = pathResults.find(r => r.path === basePath);

    if (pathResults.every(r => r.status === 0)) {
      res.json({ success: false, status: 401, error: '账号或密码错误', pathResults });
      return;
    }

    res.json({ 
      success: true, 
      rootFolders,
      basePathFiles: targetResult?.files || [],
      basePathFolders: targetResult?.folders || [],
      basePath,
      pathResults
    });
  } catch (error) {
    console.error('测试连接失败:', error);
    res.json({ success: false, error: error.message });
  }
});

// 列出目录
app.post('/api/nutstore/list', async (req, res) => {
  try {
    const { username, password, dirPath } = req.body;
    
    const encodedPath = encodePath(dirPath);
    const response = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${encodedPath}`, {
      username,
      password,
      method: 'PROPFIND',
      headers: { 'Depth': '1' },
    });

    if (!response.ok) {
      res.status(response.status).json({ error: `列出目录失败 (${response.status})` });
      return;
    }

    const text = await response.text();
    const responses = await parseWebDAVResponse(text);
    
    const files = [];
    const folders = [];
    const dirName = dirPath.split('/').filter(Boolean).pop();
    
    for (const { href } of responses) {
      const name = decodeURIComponent(href.split('/').filter(Boolean).pop() || '');
      if (name && name !== dirName) {
        if (name.endsWith('.md')) {
          files.push(name);
        } else if (!name.includes('.')) {
          folders.push(name);
        }
      }
    }

    res.json({ files, folders });
  } catch (error) {
    console.error('列出目录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 读取文件
app.post('/api/nutstore/read', async (req, res) => {
  try {
    const { username, password, filePath } = req.body;

    if (!filePath) {
      res.status(400).json({ error: '缺少文件路径' });
      return;
    }

    const encodedPath = encodePath(filePath);
    const response = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${encodedPath}`, {
      username,
      password,
      method: 'GET',
    });

    if (response.status === 404) {
      res.status(404).json({ error: '文件不存在' });
      return;
    }

    if (response.status === 401) {
      res.status(401).json({ error: '坚果云账号或密码错误' });
      return;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`读取失败: ${response.status} ${errText}`);
      res.status(response.status).json({
        error: `读取失败(${response.status})`,
        detail: errText.slice(0, 200),
      });
      return;
    }

    const content = await response.text();
    res.json({ content });
  } catch (error) {
    console.error('读取文件失败:', error);
    res.status(500).json({ error: error.message });
  }
});



// 创建目录
app.post('/api/nutstore/mkdir', async (req, res) => {
  try {
    const { username, password, dirPath } = req.body;

    if (!dirPath) {
      res.status(400).json({ error: '缺少目录路径' });
      return;
    }

    const encodedPath = encodePath(dirPath);
    const response = await makeNutstoreRequest('https://dav.jianguoyun.com/dav' + encodedPath, {
      username,
      password,
      method: 'MKCOL',
    });

    if (response.ok || response.status === 405) {
      res.json({ success: true });
    } else {
      const errText = await response.text().catch(() => '');
      res.status(response.status).json({
        error: '创建目录失败(' + response.status + ')',
        detail: errText.slice(0, 200),
      });
    }
  } catch (error) {
    console.error('创建目录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 写入文件
app.post('/api/nutstore/write', async (req, res) => {
  try {
    const { username, password, filePath, content } = req.body;

    if (!filePath) {
      res.status(400).json({ error: '缺少文件路径' });
      return;
    }
    if (content === undefined || content === null) {
      res.status(400).json({ error: '缺少文件内容' });
      return;
    }

    const encodedPath = encodePath(filePath);
    const response = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${encodedPath}`, {
      username,
      password,
      method: 'PUT',
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      body: content,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`写入失败: ${response.status} ${errText}`);
      res.status(response.status).json({
        error: `写入失败(${response.status})`,
        detail: errText.slice(0, 200),
      });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('写入文件失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取 files.md 条目
app.post('/api/nutstore/filesmd', async (req, res) => {
  try {
    const { username, password, basePath = '/笔记' } = req.body;
    
    const allEntries = [];
    
    const encodedPath = encodePath(basePath);
    const rootResponse = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${encodedPath}`, {
      username,
      password,
      method: 'PROPFIND',
      headers: { 'Depth': '1' },
    });

    if (rootResponse.ok) {
      const text = await rootResponse.text();
      const responses = await parseWebDAVResponse(text);
      
      const excludedFiles = ['help.md', 'readme.md', 'about.md'];
      
      for (const { href } of responses) {
        const fileName = decodeURIComponent(href.split('/').filter(Boolean).pop() || '');
        if (fileName && fileName.endsWith('.md') && !excludedFiles.includes(fileName.toLowerCase())) {
          const fileResponse = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${encodedPath}/${encodeURIComponent(fileName)}`, {
            username,
            password,
            method: 'GET',
          });
          if (fileResponse.ok) {
            const content = await fileResponse.text();
            allEntries.push({ fileName, content });
          }
        }
      }
    }

    const journalPath = `${basePath}/journal`;
    const journalEncoded = encodePath(journalPath);
    const journalResponse = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${journalEncoded}`, {
      username,
      password,
      method: 'PROPFIND',
      headers: { 'Depth': '1' },
    });

    if (journalResponse.ok) {
      const text = await journalResponse.text();
      const responses = await parseWebDAVResponse(text);
      
      for (const { href } of responses) {
        const fileName = decodeURIComponent(href.split('/').filter(Boolean).pop() || '');
        if (fileName && fileName.endsWith('.md')) {
          const fileResponse = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${journalEncoded}/${encodeURIComponent(fileName)}`, {
            username,
            password,
            method: 'GET',
          });
          if (fileResponse.ok) {
            const content = await fileResponse.text();
            allEntries.push({ fileName, content });
          }
        }
      }
    }

    const brainPath = `${basePath}/brain`;
    const brainEncoded = encodePath(brainPath);
    const brainResponse = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${brainEncoded}`, {
      username,
      password,
      method: 'PROPFIND',
      headers: { 'Depth': '1' },
    });

    if (brainResponse.ok) {
      const text = await brainResponse.text();
      const responses = await parseWebDAVResponse(text);
      
      for (const { href } of responses) {
        const fileName = decodeURIComponent(href.split('/').filter(Boolean).pop() || '');
        if (fileName && fileName.endsWith('.md')) {
          const fileResponse = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${brainEncoded}/${encodeURIComponent(fileName)}`, {
            username,
            password,
            method: 'GET',
          });
          if (fileResponse.ok) {
            const content = await fileResponse.text();
            allEntries.push({ fileName, content });
          }
        }
      }
    }

    res.json({ entries: allEntries });
  } catch (error) {
    console.error('读取 files.md 失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除文件
app.post('/api/nutstore/delete', async (req, res) => {
  try {
    const { username, password, filePath } = req.body;
    
    if (!filePath) {
      res.status(400).json({ error: '缺少文件路径' });
      return;
    }
    
    const encodedPath = encodePath(filePath);
    const response = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${encodedPath}`, {
      username,
      password,
      method: 'DELETE',
    });

    if (!response.ok) {
      res.status(response.status).json({ error: `删除失败 (${response.status})` });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('删除文件失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

const NUTSTORE_WEBDAV_URL = 'https://dav.jianguoyun.com/dav';

function encodePath(pathStr) {
  return pathStr.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

async function makeNutstoreRequest(url, options = {}) {
  const { username, password, ...rest } = options;
  
  if (!username || !password) {
    return new Response('未提供坚果云凭据', { status: 400 });
  }

  const token = btoa(`${username}:${password}`);
  
  const response = await fetch(url, {
    ...rest,
    headers: {
      ...rest.headers,
      Authorization: `Basic ${token}`,
    },
  });

  return response;
}

async function parseWebDAVResponse(xmlText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    const responseElements = doc.querySelectorAll('response');
    
    return Array.from(responseElements).map(response => {
      const href = response.querySelector('href')?.textContent || '';
      return { href };
    });
  } catch {
    return [];
  }
}

function createResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: { 
      'Content-Type': 'application/json', 
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    
    if (path.startsWith('/api/nutstore/')) {
      const action = path.replace('/api/nutstore/', '');
      const body = await request.json().catch(() => ({}));
      const { username, password, basePath = '/我的坚果云/笔记' } = body;
      
      if (action === 'test') {
        try {
          const knownFiles = ['Chat.md', 'Later.md', 'Help.md', 'Readme.md'];
          const pathResults = [];
          
          for (const testPath of ['/笔记', '/我的坚果云/笔记', '/']) {
            const result = { path: testPath, status: 0, files: [], folders: [] };
            
            for (const file of knownFiles) {
              const encodedPath = encodePath(`${testPath}/${file}`);
              const resp = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${encodedPath}`, {
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
            return createResponse({ success: false, error: '账号或密码错误', status: 401, pathResults });
          }
          
          return createResponse({
            success: true,
            rootFolders: pathResults.find(r => r.path === '/')?.folders || [],
            basePathFiles: targetResult?.files || [],
            basePathFolders: targetResult?.folders || [],
            pathResults,
          });
        } catch (error) {
          return createResponse({ success: false, error: error.message });
        }
      }
      
      if (action === 'list') {
        try {
          const { dirPath } = body;
          const encodedPath = encodePath(dirPath);
          const response = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${encodedPath}`, {
            username,
            password,
            method: 'PROPFIND',
            headers: { 'Depth': '1' },
          });
          
          if (!response.ok) {
            return createResponse({ success: false, error: `列出目录失败 (${response.status})` });
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
              } else {
                files.push(name);
              }
            }
          }
          
          return createResponse({ files, folders });
        } catch (error) {
          return createResponse({ success: false, error: error.message });
        }
      }
      
      if (action === 'read') {
        try {
          const { filePath } = body;
          
          const encodedPath = encodePath(filePath);
          const response = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${encodedPath}`, {
            username,
            password,
            method: 'GET',
          });
          
          if (response.status === 404) {
            return new Response(JSON.stringify({ error: '文件不存在' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
          }
          
          if (!response.ok) {
            return createResponse({ error: `读取失败 (${response.status})` });
          }
          
          const content = await response.text();
          return createResponse({ content });
        } catch (error) {
          return createResponse({ error: error.message });
        }
      }
      
      if (action === 'write') {
        try {
          const { filePath, content } = body;
          
          const encodedPath = encodePath(filePath);
          const response = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${encodedPath}`, {
            username,
            password,
            method: 'PUT',
            headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
            body: content,
          });
          
          if (!response.ok) {
            return createResponse({ success: false, error: `写入失败 (${response.status})` });
          }
          
          return createResponse({ success: true });
        } catch (error) {
          return createResponse({ success: false, error: error.message });
        }
      }
      
      if (action === 'filesmd') {
        try {
          const allEntries = [];
          const rootFiles = ['Chat.md', 'Later.md', 'Help.md', 'Readme.md', 'Idea.md', 'Note.md'];
          const excludedFiles = ['help.md', 'readme.md', 'about.md'];

          // v1.18: 先用 PROPFIND 列出 basePath 下所有 .md 文件（含自定义分类文件）
          let allFiles = [...rootFiles];
          try {
            const propfindRes = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${encodePath(basePath + '/')}`, {
              username,
              password,
              method: 'PROPFIND',
              headers: { Depth: '1' },
            });
            if (propfindRes.ok) {
              const xmlText = await propfindRes.text();
              const hrefRegex = /<(?:D|d):href>([^<]+\.md)<\/(?:D|d):href>/g;
              let m;
              const loaded = new Set(allFiles.map((f) => f.toLowerCase()));
              while ((m = hrefRegex.exec(xmlText)) !== null) {
                const href = m[1];
                const fname = decodeURIComponent(href.split('/').pop() || '');
                const low = fname.toLowerCase();
                if (fname && !loaded.has(low) && !low.startsWith('_') && !excludedFiles.includes(low)) {
                  allFiles.push(fname);
                  loaded.add(low);
                }
              }
              console.log(`[worker filesmd] PROPFIND 列出 ${allFiles.length} 个 md 文件`);
            }
          } catch (e) {
            console.warn('[worker filesmd] PROPFIND 失败，仅加载默认:', e.message);
          }

          for (const fileName of allFiles) {
            if (excludedFiles.includes(fileName.toLowerCase())) continue;
            const encodedPath = encodePath(`${basePath}/${fileName}`);
            const fileResponse = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${encodedPath}`, {
              username,
              password,
              method: 'GET',
            });
            if (fileResponse.ok) {
              const content = await fileResponse.text();
              allEntries.push({ fileName, content });
            }
          }

          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const journalFileName = `${year}.${month}.md`;
          const journalEncoded = encodePath(`${basePath}/journal/${journalFileName}`);
          const journalResponse = await makeNutstoreRequest(`${NUTSTORE_WEBDAV_URL}${journalEncoded}`, {
            username,
            password,
            method: 'GET',
          });
          if (journalResponse.ok) {
            const content = await journalResponse.text();
            allEntries.push({ fileName: `journal/${journalFileName}`, content });
          }
          
          return createResponse({ entries: allEntries });
        } catch (error) {
          return createResponse({ entries: [], error: error.message });
        }
      }
    }
    
    return new Response('Not found', { status: 404 });
  },
};

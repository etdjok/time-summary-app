import express from 'express';
import cors from 'cors';
import { parseStringPromise } from 'xml2js';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_VERSION = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')).version;

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const DIST_DIR = path.join(__dirname, '..', 'dist');

function checkPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      resolve(err.code === 'EADDRINUSE');
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port, '0.0.0.0');
  });
}

async function ensurePortAvailable(port) {
  const inUse = await checkPortInUse(port);
  if (inUse) {
    console.log([心光] 端口 \ 已被占用，正在释放...);
    try {
      const result = execSync(
etstat -ano | findstr ":\ ", { encoding: 'utf-8', timeout: 5000 });
      const lines = result.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') {
          try {
            execSync(	askkill /F /PID \12588, { stdio: 'ignore', timeout: 3000 });
            console.log([心光] 已终止旧进程 (PID: \12588));
            await new Promise(r => setTimeout(r, 500));
          } catch (e) {
            console.error([心光] 无法终止进程 PID \12588:, e.message);
          }
        }
      }
    } catch (e) {
      console.error([心光] 端口 \ 被占用，但无法自动释放:, e.message);
    }
  }
}

app.use(express.static(DIST_DIR, {
  setHeaders: (res, filePath) => {
    res.setHeader('X-Version', APP_VERSION);
    if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('registerSW.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));

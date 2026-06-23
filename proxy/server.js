const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');
let apiKey = '';

const envPath = path.join(ROOT, '.env');
try {
  const env = fs.readFileSync(envPath, 'utf-8');
  const match = env.match(/BIGMODEL_API_KEY=(.+)/);
  if (match) apiKey = match[1].trim();
} catch {}

const MIME = {
  '.html': 'text/html;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.js': 'application/javascript;charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const API_PROVIDERS = {
  bigmodel: {
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    defaultModel: 'glm-4-flash',
  },
  dashscope: {
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen-turbo-latest',
  },
};

let currentProvider = API_PROVIDERS.bigmodel;

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(url, res) {
  let filePath = path.join(ROOT, url === '/' ? 'login.html' : url);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html;charset=utf-8' });
      return res.end('<h1>404 Not Found</h1>');
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    return handleChat(req, res);
  }

  serveStatic(req.url, res);
});

async function handleChat(req, res) {
  try {
    const { messages, model = currentProvider.defaultModel } = await parseBody(req);

    if (!apiKey) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: '请在 .env 文件中配置 BIGMODEL_API_KEY' }));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(currentProvider.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.text();
      res.writeHead(response.status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `API错误: ${err}` }));
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
            continue;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch {}
        }
      }
    }

    res.end();
  } catch (err) {
    if (err.name === 'AbortError') {
      res.writeHead(504, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: '请求超时' }));
    }
    console.error('Proxy error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '服务器内部错误: ' + err.message }));
  }
}

const providerName = Object.keys(API_PROVIDERS).find(k => API_PROVIDERS[k] === currentProvider) || 'bigmodel';

server.listen(PORT, () => {
  console.log(`\n  🌐 树院智管 · 校园物资智能交互系统`);
  console.log(`  ───────────────────────────────`);
  console.log(`  访问地址: http://localhost:${PORT}`);
  console.log(`  API 地址: http://localhost:${PORT}/api/chat`);
  console.log(`  当前模型: ${currentProvider.defaultModel} (智谱AI)`);
  console.log(`  API 密钥: ${apiKey ? '已配置 ✅' : '未配置 ❌ (请创建 .env 文件)'}`);
  console.log(`  用法: 浏览器打开 http://localhost:${PORT} 即可使用全部功能\n`);
});

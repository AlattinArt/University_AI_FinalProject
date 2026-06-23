const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
let apiKey = '';

const envPath = path.join(__dirname, '..', '.env');
try {
  const env = fs.readFileSync(envPath, 'utf-8');
  const match = env.match(/DASHSCOPE_API_KEY=(.+)/);
  if (match) apiKey = match[1].trim();
} catch {}

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

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method !== 'POST' || req.url !== '/api/chat') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Not Found' }));
  }

  try {
    const { messages, model = 'qwen-turbo' } = await parseBody(req);

    if (!apiKey) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: '请在 .env 文件中配置 DASHSCOPE_API_KEY' }));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
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
});

server.listen(PORT, () => {
  console.log(`\n  🌐 树院智管 AI 中转服务`);
  console.log(`  ─────────────────────────`);
  console.log(`  地址: http://localhost:${PORT}/api/chat`);
  console.log(`  API: ${apiKey ? '已配置 ✅' : '未配置 ❌ (请创建 .env 文件)'}`);
  console.log(`  用法: 浏览器直接打开 .html 文件即可使用核心功能\n`);
});

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 4173);
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || 'http://127.0.0.1:3000';
const ROOT_DIR = __dirname;
const INDEX_FILE = path.join(ROOT_DIR, 'index.html');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

async function readBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const relativePath =
    requestUrl.pathname === '/' ? 'index.html' : decodeURIComponent(requestUrl.pathname.slice(1));
  const normalizedPath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ROOT_DIR, normalizedPath);

  if (!filePath.startsWith(ROOT_DIR)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Доступ запрещён');
    return;
  }

  try {
    const fileBuffer = await fs.readFile(filePath);
    response.writeHead(200, { 'Content-Type': getMimeType(filePath) });

    if (request.method !== 'HEAD') {
      response.end(fileBuffer);
      return;
    }

    response.end();
  } catch (error) {
    if (normalizedPath !== 'index.html' && path.extname(normalizedPath) === '') {
      const indexBuffer = await fs.readFile(INDEX_FILE);
      response.writeHead(200, { 'Content-Type': getMimeType(INDEX_FILE) });
      response.end(indexBuffer);
      return;
    }

    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Не найдено');
  }
}

async function proxyApi(request, response) {
  const targetUrl = `${BACKEND_ORIGIN}${request.url.replace(/^\/api/, '')}`;
  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await readBody(request);

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'content-type': request.headers['content-type'] ?? 'application/json',
      },
      body,
    });
    const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer());
    const headers = {
      'content-type':
        upstreamResponse.headers.get('content-type') ?? 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    };

    response.writeHead(upstreamResponse.status, headers);

    if (request.method !== 'HEAD') {
      response.end(responseBuffer);
      return;
    }

    response.end();
  } catch (error) {
    response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(
      JSON.stringify({
        message: 'Бэкенд недоступен',
        backendOrigin: BACKEND_ORIGIN,
        details: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Некорректный запрос');
    return;
  }

  if (request.url.startsWith('/api/')) {
    await proxyApi(request, response);
    return;
  }

  if (request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(
      JSON.stringify({
        frontend: 'ok',
        backendOrigin: BACKEND_ORIGIN,
      }),
    );
    return;
  }

  await serveStatic(request, response);
});

server.listen(PORT, () => {
  console.log(`Фронтенд запущен: http://127.0.0.1:${PORT}`);
  console.log(`Проксирование API-запросов в ${BACKEND_ORIGIN}`);
});

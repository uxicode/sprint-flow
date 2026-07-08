const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 8080;

const server = http.createServer((req, res) => {
  console.log(`[CORS Proxy] Received request: ${req.method} ${req.url}`);

  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');

  // Preflight OPTIONS 요청 즉시 승인
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 요청 경로 파싱하여 ?url= 파라미터 값 추출
  const queryObject = url.parse(req.url, true).query;
  const targetUrlStr = queryObject.url;

  if (!targetUrlStr) {
    console.warn(`[CORS Proxy] Bad Request: Missing "url" parameter`);
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Missing "url" query parameter. Example: /?url=https://your-domain.atlassian.net/rest/api/3/search');
    return;
  }

  try {
    const targetUrl = new URL(targetUrlStr);
    console.log(`[CORS Proxy] Forwarding to target URL: ${targetUrl.href}`);
    
    // 대상 요청의 헤더 조립
    const headers = {
      'Accept': req.headers['accept'] || 'application/json',
      'Content-Type': req.headers['content-type'] || 'application/json',
    };
    
    if (req.headers['authorization']) {
      headers['Authorization'] = req.headers['authorization'];
    }

    const options = {
      method: req.method,
      headers: headers
    };

    // HTTPS 또는 HTTP 분기 호출
    const requester = targetUrl.protocol === 'https:' ? https : http;

    const proxyReq = requester.request(targetUrl, options, (proxyRes) => {
      console.log(`[CORS Proxy] Target server responded with status: ${proxyRes.statusCode}`);
      // 프록시 대상 응답의 헤더를 보존하여 브라우저에 반환
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'application/json'
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[CORS Proxy] Target request error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Proxy request failed: ${err.message}`);
    });

    // POST/PUT 요청 등의 경우 Request Body 복사
    req.pipe(proxyReq);

  } catch (e) {
    console.error(`[CORS Proxy] Invalid URL passed: ${targetUrlStr}`, e);
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Invalid target URL: ${e.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`[CORS Proxy] Server running at http://localhost:${PORT}`);
  console.log(`[CORS Proxy] Routing requests like: http://localhost:${PORT}/?url=https://your-jira-domain/...`);
});

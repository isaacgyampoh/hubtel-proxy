const HUBTEL_API_ID = '36o8qqn';
const HUBTEL_API_KEY = '6e4657d73cc44e219d4e0a078a9c7d3f';
const HUBTEL_ACCOUNT = '3746821';
const PROXY_SECRET = 'etr-hubtel-2026';
const PORT = process.env.PORT || 3000;

const HUBTEL_URL = `https://api.hubtel.com/v1/merchantaccount/merchants/${HUBTEL_ACCOUNT}/receive/mobilemoney`;
const HUBTEL_AUTH = 'Basic ' + Buffer.from(HUBTEL_API_ID + ':' + HUBTEL_API_KEY).toString('base64');

const http = require('http');

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Proxy-Key');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // GET /test = webhook test
  if (req.method === 'GET' && req.url === '/test') {
    try {
      const r = await fetch('https://webhook.site/d5d5f765-1ab8-4bb4-968a-cb61141e54bc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'ERBLiving-POS/1.0' },
        body: JSON.stringify({ source: 'hubtel-proxy-render', test: true, timestamp: new Date().toISOString() }),
      });
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'POST sent to webhook', code: r.status }));
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // GET /hubtel-test = test Hubtel API
  if (req.method === 'GET' && req.url === '/hubtel-test') {
    try {
      const r = await fetch(HUBTEL_URL, {
        method: 'POST',
        headers: {
          'Authorization': HUBTEL_AUTH,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'ERBLiving-POS/1.0',
        },
        body: JSON.stringify({
          CustomerName: 'Test',
          CustomerMsisdn: '0533547740',
          CustomerEmail: 'test@test.com',
          Channel: 'mtn-gh',
          Amount: 0.01,
          PrimaryCallbackUrl: 'https://webhook.site/d5d5f765-1ab8-4bb4-968a-cb61141e54bc',
          ClientReference: 'TEST-' + Date.now(),
          Description: 'API test',
        }),
      });
      const data = await r.text();
      res.writeHead(200);
      res.end(JSON.stringify({ hubtelStatus: r.status, hubtelResponse: data }));
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // GET /debug = full debug info
  if (req.method === 'GET' && req.url === '/debug') {
    try {
      const ipRes = await fetch('https://api.ipify.org');
      const ip = await ipRes.text();
      const hubtelRoot = await fetch('https://api.hubtel.com/', { headers: { 'User-Agent': 'ERBLiving-POS/1.0' } });
      const hubtelText = await hubtelRoot.text();
      res.writeHead(200);
      res.end(JSON.stringify({
        serverIP: ip.trim(),
        nodeVersion: process.version,
        hubtelRootStatus: hubtelRoot.status,
        hubtelRootBody: hubtelText.substring(0, 300),
      }, null, 2));
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // GET = show IP
  if (req.method === 'GET') {
    try {
      const r = await fetch('https://api.ipify.org');
      const ip = await r.text();
      res.writeHead(200);
      res.end(JSON.stringify({ serverIP: ip.trim(), status: 'Hubtel proxy running' }));
    } catch { res.writeHead(200); res.end(JSON.stringify({ status: 'running' })); }
    return;
  }

  if (req.method !== 'POST') { res.writeHead(405); res.end(JSON.stringify({ error: 'POST only' })); return; }
  if ((req.headers['x-proxy-key'] || '') !== PROXY_SECRET) { res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const r = await fetch(HUBTEL_URL, {
        method: 'POST',
        headers: {
          'Authorization': HUBTEL_AUTH,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'ERBLiving-POS/1.0',
        },
        body: body,
      });
      const data = await r.text();
      res.writeHead(r.status);
      res.end(data);
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
  });
});

server.listen(PORT, () => {
  console.log('Hubtel proxy running on port ' + PORT + ' (Node ' + process.version + ')');
  setInterval(() => { fetch('https://hubtel-proxy-0tr5.onrender.com/').catch(() => {}); }, 10 * 60 * 1000);
});

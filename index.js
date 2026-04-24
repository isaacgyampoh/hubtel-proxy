const http = require('http');
const https = require('https');

const HUBTEL_API_ID = '36o8qqn';
const HUBTEL_API_KEY = '6e4657d73cc44e219d4e0a078a9c7d3f';
const HUBTEL_ACCOUNT = '3746821';
const PROXY_SECRET = 'etr-hubtel-2026';
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Proxy-Key');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // GET /test = send POST to Hubtel webhook
  if (req.method === 'GET' && req.url === '/test') {
    const postData = JSON.stringify({ source: 'hubtel-proxy-render', test: true, timestamp: new Date().toISOString() });
    const options = { hostname: 'webhook.site', path: '/d5d5f765-1ab8-4bb4-968a-cb61141e54bc', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } };
    const webhookReq = https.request(options, (webhookRes) => { res.writeHead(200); res.end(JSON.stringify({ status: 'POST sent to webhook', code: webhookRes.statusCode })); });
    webhookReq.on('error', (e) => { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); });
    webhookReq.write(postData); webhookReq.end();
    return;
  }

  // GET /hubtel-test = test Hubtel API directly from Render
  if (req.method === 'GET' && req.url === '/hubtel-test') {
    const auth = Buffer.from(HUBTEL_API_ID + ':' + HUBTEL_API_KEY).toString('base64');
    const testBody = JSON.stringify({
      CustomerName: 'Test',
      CustomerMsisdn: '0533547740',
      CustomerEmail: 'test@test.com',
      Channel: 'mtn-gh',
      Amount: 0.01,
      PrimaryCallbackUrl: 'https://webhook.site/d5d5f765-1ab8-4bb4-968a-cb61141e54bc',
      ClientReference: 'TEST-' + Date.now(),
      Description: 'API test',
    });
    const options = {
      hostname: 'api.hubtel.com',
      path: '/v1/merchantaccount/merchants/' + HUBTEL_ACCOUNT + '/receive/mobilemoney',
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/json', 'Accept': 'application/json', 'Content-Length': Buffer.byteLength(testBody) },
    };
    const hubtelReq = https.request(options, (hubtelRes) => {
      let data = '';
      hubtelRes.on('data', chunk => data += chunk);
      hubtelRes.on('end', () => { res.writeHead(200); res.end(JSON.stringify({ hubtelStatus: hubtelRes.statusCode, hubtelResponse: data })); });
    });
    hubtelReq.on('error', (e) => { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); });
    hubtelReq.write(testBody); hubtelReq.end();
    return;
  }

  // GET = show IP
  if (req.method === 'GET') {
    https.get('https://api.ipify.org', (r) => {
      let ip = ''; r.on('data', d => ip += d);
      r.on('end', () => { res.writeHead(200); res.end(JSON.stringify({ serverIP: ip.trim(), status: 'Hubtel proxy running' })); });
    }).on('error', () => { res.writeHead(200); res.end(JSON.stringify({ status: 'running' })); });
    return;
  }

  if (req.method !== 'POST') { res.writeHead(405); res.end(JSON.stringify({ error: 'POST only' })); return; }
  const proxyKey = req.headers['x-proxy-key'] || '';
  if (proxyKey !== PROXY_SECRET) { res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const auth = Buffer.from(HUBTEL_API_ID + ':' + HUBTEL_API_KEY).toString('base64');
    const url = '/v1/merchantaccount/merchants/' + HUBTEL_ACCOUNT + '/receive/mobilemoney';
    const options = { hostname: 'api.hubtel.com', path: url, method: 'POST', headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/json', 'Accept': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const hubtelReq = https.request(options, (hubtelRes) => {
      let data = ''; hubtelRes.on('data', chunk => data += chunk);
      hubtelRes.on('end', () => { res.writeHead(hubtelRes.statusCode); res.end(data); });
    });
    hubtelReq.on('error', (e) => { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); });
    hubtelReq.write(body); hubtelReq.end();
  });
});

server.listen(PORT, () => {
  console.log('Hubtel proxy running on port ' + PORT);
  setInterval(() => { https.get('https://hubtel-proxy-0tr5.onrender.com/', () => {}).on('error', () => {}); }, 10 * 60 * 1000);
});

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { buildAnalysis } = require('./analysis');

const publicDir = path.join(__dirname, '..', 'public');

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost');

  if (requestUrl.pathname === '/api/analysis') {
    try {
      const source = requestUrl.searchParams.get('source') || 'excel';
      const analysis = await buildAnalysis({
        source,
        provider: requestUrl.searchParams.get('provider') || undefined,
        apiKey: requestUrl.searchParams.get('apiKey') || undefined,
        asset: requestUrl.searchParams.get('asset') || undefined,
        market: requestUrl.searchParams.get('market') || undefined,
        assetA: requestUrl.searchParams.get('assetA') || undefined,
        assetB: requestUrl.searchParams.get('assetB') || undefined,
        assetC: requestUrl.searchParams.get('assetC') || undefined,
        interval: requestUrl.searchParams.get('interval') || undefined,
        range: requestUrl.searchParams.get('range') || undefined
      });
      analysis.debug = {
        portfolioOptimizationKeys: Object.keys((analysis.methods || {}).portfolioOptimization || {})
      };
      return send(res, 200, 'application/json; charset=utf-8', JSON.stringify(analysis));
    } catch (error) {
      return send(res, 500, 'application/json; charset=utf-8', JSON.stringify({ error: error.message }));
    }
  }

  const target = req.url === '/' ? '/index.html' : requestUrl.pathname;
  const filePath = path.join(publicDir, target);
  if (!filePath.startsWith(publicDir)) return send(res, 403, 'text/plain; charset=utf-8', 'Forbidden');

  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
    const ext = path.extname(filePath);
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8'
    };
    return send(res, 200, types[ext] || 'text/plain; charset=utf-8', data);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Analytics app running on http://localhost:${port}`);
});

const fs = require('fs');
const path = require('path');
const https = require('https');
const mysql = require('mysql2/promise');
const XLSX = require('xlsx');

const demoObservations = [
  { month: 'Jan', x1: 12, x2: 5, y: 18, marketReturn: 0.020, assetReturn: 0.026, assetA: 0.026, assetB: 0.018, assetC: 0.031, region: 'North', category: 'A' },
  { month: 'Feb', x1: 15, x2: 7, y: 23, marketReturn: 0.015, assetReturn: 0.020, assetA: 0.020, assetB: 0.016, assetC: 0.024, region: 'North', category: 'A' },
  { month: 'Mar', x1: 14, x2: 6, y: 21, marketReturn: -0.005, assetReturn: -0.002, assetA: -0.002, assetB: 0.004, assetC: -0.006, region: 'South', category: 'B' },
  { month: 'Apr', x1: 18, x2: 9, y: 29, marketReturn: 0.030, assetReturn: 0.038, assetA: 0.038, assetB: 0.027, assetC: 0.041, region: 'South', category: 'B' },
  { month: 'May', x1: 20, x2: 10, y: 33, marketReturn: 0.025, assetReturn: 0.034, assetA: 0.034, assetB: 0.021, assetC: 0.036, region: 'East', category: 'A' },
  { month: 'Jun', x1: 22, x2: 11, y: 35, marketReturn: 0.010, assetReturn: 0.016, assetA: 0.016, assetB: 0.012, assetC: 0.019, region: 'East', category: 'A' },
  { month: 'Jul', x1: 19, x2: 8, y: 30, marketReturn: -0.010, assetReturn: -0.008, assetA: -0.008, assetB: -0.003, assetC: -0.011, region: 'West', category: 'B' },
  { month: 'Aug', x1: 24, x2: 12, y: 39, marketReturn: 0.035, assetReturn: 0.045, assetA: 0.045, assetB: 0.029, assetC: 0.049, region: 'West', category: 'B' },
  { month: 'Sep', x1: 23, x2: 10, y: 36, marketReturn: 0.018, assetReturn: 0.024, assetA: 0.024, assetB: 0.019, assetC: 0.028, region: 'North', category: 'A' },
  { month: 'Oct', x1: 26, x2: 13, y: 42, marketReturn: 0.028, assetReturn: 0.037, assetA: 0.037, assetB: 0.026, assetC: 0.040, region: 'South', category: 'B' },
  { month: 'Nov', x1: 28, x2: 14, y: 45, marketReturn: 0.022, assetReturn: 0.031, assetA: 0.031, assetB: 0.023, assetC: 0.034, region: 'East', category: 'A' },
  { month: 'Dec', x1: 30, x2: 15, y: 49, marketReturn: 0.040, assetReturn: 0.052, assetA: 0.052, assetB: 0.034, assetC: 0.055, region: 'West', category: 'B' }
];

const REQUIRED_COLUMNS = [
  'month',
  'x1',
  'x2',
  'y',
  'marketReturn',
  'assetReturn',
  'assetA',
  'assetB',
  'assetC',
  'region',
  'category'
];

const EXCEL_PATH = path.join(__dirname, '..', 'data', 'observations.xlsx');
const CACHE_DIR = path.join(__dirname, '..', '.cache');
const ACCESS_FILE_PATH = path.join(__dirname, '..', 'config', 'access.yml');
const YAHOO_CACHE_TTL_MS = 15 * 60 * 1000;
const MARKET_API_CACHE_TTL_MS = 15 * 60 * 1000;

function normalizeRow(row) {
  return {
    month: String(row.month ?? '').trim(),
    x1: Number(row.x1),
    x2: Number(row.x2),
    y: Number(row.y),
    marketReturn: Number(row.marketReturn),
    assetReturn: Number(row.assetReturn),
    assetA: Number(row.assetA),
    assetB: Number(row.assetB),
    assetC: Number(row.assetC),
    region: String(row.region ?? '').trim(),
    category: String(row.category ?? '').trim()
  };
}

function isValidRow(row) {
  return REQUIRED_COLUMNS.every((key) => row[key] !== '' && row[key] !== undefined && row[key] !== null)
    && ['x1', 'x2', 'y', 'marketReturn', 'assetReturn', 'assetA', 'assetB', 'assetC'].every((key) => Number.isFinite(row[key]));
}

function loadExcelObservations() {
  if (!fs.existsSync(EXCEL_PATH)) {
    return {
      observations: demoObservations,
      source: 'demo',
      excelPath: EXCEL_PATH
    };
  }

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
  const normalized = rows.map(normalizeRow).filter(isValidRow);

  if (!normalized.length) {
    throw new Error(`Excel file found, but no valid rows were parsed from ${EXCEL_PATH}`);
  }

  return {
    observations: normalized,
    source: 'excel',
    excelPath: EXCEL_PATH,
    sheetName,
    rowCount: normalized.length
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseSimpleYaml(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const root = {};
  const stack = [{ indent: -1, value: root }];

  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) continue;
    const indent = rawLine.match(/^\s*/)[0].length;
    const trimmed = rawLine.trim();
    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    while (stack.length && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].value;

    if (!value) {
      parent[key] = {};
      stack.push({ indent, value: parent[key] });
      continue;
    }

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parent[key] = value;
  }

  return root;
}

function loadAccessConfig() {
  const fileConfig = parseSimpleYaml(ACCESS_FILE_PATH);
  return {
    database: {
      host: fileConfig.database?.host || process.env.ANALYTICS_DB_HOST || null,
      port: Number(fileConfig.database?.port || process.env.ANALYTICS_DB_PORT || 3306),
      username: fileConfig.database?.username || process.env.ANALYTICS_USERNAME || null,
      password: fileConfig.database?.password || process.env.ANALYTICS_PASSWORD || null,
      name: fileConfig.database?.name || process.env.ANALYTICS_DATABASE || null
    },
    marketApi: {
      key: fileConfig.marketApi?.key || process.env.MARKET_API_KEY || process.env.ALPHA_VANTAGE_API_KEY || null,
      provider: fileConfig.marketApi?.provider || process.env.MARKET_API_PROVIDER || 'alphavantage'
    },
    rapidApi: {
      key: fileConfig.rapidApi?.key || process.env.RAPIDAPI_KEY || null,
      host: fileConfig.rapidApi?.host || process.env.RAPIDAPI_HOST || 'linkedin-data-api.p.rapidapi.com'
    }
  };
}

async function createDatabaseConnection() {
  const access = loadAccessConfig();
  const { host, port, username, password, name } = access.database || {};
  if (!host || !port || !username || !password || !name) {
    throw new Error('Database configuration is incomplete');
  }

  return mysql.createConnection({
    host,
    port,
    user: username,
    password,
    database: name,
    connectTimeout: 5000
  });
}

async function checkDatabaseConnection() {
  const access = loadAccessConfig();
  const { host, port, name } = access.database || {};
  const connection = await createDatabaseConnection();

  try {
    const [rows] = await connection.query('SELECT 1 AS ok');
    return {
      ok: rows?.[0]?.ok === 1,
      host,
      port,
      database: name
    };
  } finally {
    await connection.end();
  }
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function cachePath(key) {
  ensureCacheDir();
  return path.join(CACHE_DIR, `${key}.json`);
}

function readCache(key, ttlMs) {
  const filePath = cachePath(key);
  if (!fs.existsSync(filePath)) return null;
  const stats = fs.statSync(filePath);
  if (Date.now() - stats.mtimeMs > ttlMs) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeCache(key, payload) {
  fs.writeFileSync(cachePath(key), JSON.stringify(payload), 'utf8');
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          const error = new Error(`Yahoo request failed with status ${res.statusCode}: ${body.slice(0, 120)}`);
          error.statusCode = res.statusCode;
          return reject(error);
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Yahoo returned non-JSON response: ${body.slice(0, 120)}`));
        }
      });
    }).on('error', reject);
  });
}

async function fetchYahooWithCache(url, cacheKey, attempts = 3) {
  const cached = readCache(cacheKey, YAHOO_CACHE_TTL_MS);
  if (cached) return { payload: cached, cacheHit: true };

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const payload = await fetchJson(url);
      writeCache(cacheKey, payload);
      return { payload, cacheHit: false };
    } catch (error) {
      lastError = error;
      if (error.statusCode !== 429 || attempt === attempts) break;
      await sleep(800 * attempt);
    }
  }

  const stale = (() => {
    const filePath = cachePath(cacheKey);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  })();
  if (stale) return { payload: stale, cacheHit: true, stale: true, warning: lastError.message };
  throw lastError;
}

function computeReturns(prices) {
  const returns = [];
  for (let i = 1; i < prices.length; i += 1) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return returns;
}

async function loadYahooObservations(options = {}) {
  const asset = options.asset || 'AAPL';
  const market = options.market || 'SPY';
  const auxA = options.assetA || asset;
  const auxB = options.assetB || 'MSFT';
  const auxC = options.assetC || 'GOOGL';
  const interval = options.interval || '1mo';
  const range = options.range || '5y';

  const symbols = [asset, market, auxA, auxB, auxC];
  const series = {};

  for (const symbol of symbols) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includeAdjustedClose=true`;
    const cacheKey = `${symbol}-${range}-${interval}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const { payload, cacheHit, stale, warning } = await fetchYahooWithCache(url, cacheKey);
    const result = payload?.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const closes = result?.indicators?.adjclose?.[0]?.adjclose || result?.indicators?.quote?.[0]?.close || [];
    const rows = timestamps.map((timestamp, index) => ({
      timestamp,
      close: closes[index]
    })).filter((row) => Number.isFinite(row.close));
    if (rows.length < 3) throw new Error(`Not enough Yahoo Finance data for ${symbol}`);
    series[symbol] = rows;
    series[symbol].meta = { cacheHit, stale: !!stale, warning: warning || null };
  }

  const baseLength = Math.min(...Object.values(series).map((rows) => rows.length));
  const aligned = Object.fromEntries(Object.entries(series).map(([symbol, rows]) => [symbol, rows.slice(-baseLength)]));

  const assetPrices = aligned[asset].map((row) => row.close);
  const marketPrices = aligned[market].map((row) => row.close);
  const assetAPrices = aligned[auxA].map((row) => row.close);
  const assetBPrices = aligned[auxB].map((row) => row.close);
  const assetCPrices = aligned[auxC].map((row) => row.close);

  const assetReturns = computeReturns(assetPrices);
  const marketReturns = computeReturns(marketPrices);
  const assetAReturns = computeReturns(assetAPrices);
  const assetBReturns = computeReturns(assetBPrices);
  const assetCReturns = computeReturns(assetCPrices);

  const observations = assetReturns.map((assetReturn, index) => {
    const x1 = index === 0 ? assetReturn : assetReturns[index - 1];
    const window = assetReturns.slice(Math.max(0, index - 2), index + 1);
    const x2 = Math.sqrt(window.reduce((sum, value) => sum + value ** 2, 0) / window.length);
    const y = assetReturn;
    const date = new Date(aligned[asset][index + 1].timestamp * 1000);
    return {
      month: date.toISOString().slice(0, 7),
      x1,
      x2,
      y,
      marketReturn: marketReturns[index],
      assetReturn,
      assetA: assetAReturns[index],
      assetB: assetBReturns[index],
      assetC: assetCReturns[index],
      region: asset,
      category: assetReturn >= 0 ? 'Up' : 'Down'
    };
  }).filter(isValidRow);

  return {
    observations,
    source: 'yahoo',
    yahoo: {
      asset,
      market,
      assetA: auxA,
      assetB: auxB,
      assetC: auxC,
      interval,
      range,
      cache: Object.fromEntries(symbols.map((symbol) => [symbol, aligned[symbol].meta || null]))
    },
    rowCount: observations.length
  };
}

async function fetchAlphaVantageMonthlyAdjusted(symbol, apiKey) {
  const cacheKey = `alphavantage-${symbol}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const cached = readCache(cacheKey, MARKET_API_CACHE_TTL_MS);
  if (cached) return { payload: cached, cacheHit: true };

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}&datatype=json`;
  const payload = await fetchJson(url);
  if (payload['Error Message']) throw new Error(`Alpha Vantage error for ${symbol}: ${payload['Error Message']}`);
  if (payload.Note) throw new Error(`Alpha Vantage note: ${payload.Note}`);
  writeCache(cacheKey, payload);
  return { payload, cacheHit: false };
}

function alphaSeriesToRows(payload) {
  const series = payload['Monthly Adjusted Time Series'];
  if (!series) throw new Error('Alpha Vantage did not return Monthly Adjusted Time Series');
  return Object.entries(series)
    .map(([date, values]) => ({ date, close: Number(values['5. adjusted close']) }))
    .filter((row) => Number.isFinite(row.close))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function loadMarketApiObservations(options = {}) {
  const accessConfig = loadAccessConfig();
  const provider = options.provider || accessConfig.marketApi.provider || 'alphavantage';
  const apiKey = options.apiKey || accessConfig.marketApi.key;
  if (!apiKey) throw new Error('API key is required for Market API mode');
  if (provider !== 'alphavantage') throw new Error(`Unsupported market provider: ${provider}`);

  const asset = options.asset || 'AAPL';
  const market = options.market || 'SPY';
  const auxA = options.assetA || asset;
  const auxB = options.assetB || 'MSFT';
  const auxC = options.assetC || 'GOOGL';
  const symbols = [asset, market, auxA, auxB, auxC];
  const series = {};
  const cacheMeta = {};

  for (const symbol of symbols) {
    const { payload, cacheHit } = await fetchAlphaVantageMonthlyAdjusted(symbol, apiKey);
    series[symbol] = alphaSeriesToRows(payload);
    cacheMeta[symbol] = { cacheHit };
  }

  const baseLength = Math.min(...Object.values(series).map((rows) => rows.length));
  const aligned = Object.fromEntries(Object.entries(series).map(([symbol, rows]) => [symbol, rows.slice(-baseLength)]));

  const assetPrices = aligned[asset].map((row) => row.close);
  const marketPrices = aligned[market].map((row) => row.close);
  const assetAPrices = aligned[auxA].map((row) => row.close);
  const assetBPrices = aligned[auxB].map((row) => row.close);
  const assetCPrices = aligned[auxC].map((row) => row.close);

  const assetReturns = computeReturns(assetPrices);
  const marketReturns = computeReturns(marketPrices);
  const assetAReturns = computeReturns(assetAPrices);
  const assetBReturns = computeReturns(assetBPrices);
  const assetCReturns = computeReturns(assetCPrices);

  const observations = assetReturns.map((assetReturn, index) => {
    const x1 = index === 0 ? assetReturn : assetReturns[index - 1];
    const window = assetReturns.slice(Math.max(0, index - 2), index + 1);
    const x2 = Math.sqrt(window.reduce((sum, value) => sum + value ** 2, 0) / window.length);
    return {
      month: aligned[asset][index + 1].date,
      x1,
      x2,
      y: assetReturn,
      marketReturn: marketReturns[index],
      assetReturn,
      assetA: assetAReturns[index],
      assetB: assetBReturns[index],
      assetC: assetCReturns[index],
      region: asset,
      category: assetReturn >= 0 ? 'Up' : 'Down'
    };
  }).filter(isValidRow);

  return {
    observations,
    source: 'market-api',
    marketApi: { provider, asset, market, assetA: auxA, assetB: auxB, assetC: auxC, cache: cacheMeta },
    rowCount: observations.length
  };
}

async function loadObservations(options = {}) {
  if (options.source === 'yahoo') return loadYahooObservations(options);
  if (options.source === 'market-api') return loadMarketApiObservations(options);
  return loadExcelObservations();
}

module.exports = {
  loadObservations,
  loadExcelObservations,
  loadYahooObservations,
  loadMarketApiObservations,
  loadAccessConfig,
  REQUIRED_COLUMNS,
  EXCEL_PATH,
  ACCESS_FILE_PATH,
  demoObservations,
  createDatabaseConnection,
  checkDatabaseConnection
};

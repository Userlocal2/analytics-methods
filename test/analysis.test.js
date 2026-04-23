const test = require('node:test');
const assert = require('node:assert/strict');

const { buildAnalysis } = require('../src/analysis');
const { loadExcelObservations, loadMarketApiObservations, loadAccessConfig, demoObservations } = require('../src/data');

test('excel loader falls back to demo dataset when xlsx is absent', () => {
  const result = loadExcelObservations();
  assert.equal(result.source, 'demo');
  assert.equal(result.observations.length, demoObservations.length);
});

test('buildAnalysis returns core summary and advanced method blocks for excel/demo source', async () => {
  const analysis = await buildAnalysis({ source: 'excel' });

  assert.ok(analysis.summary.observations > 0);
  assert.match(analysis.summary.dataSource, /demo|excel/);
  assert.ok(analysis.methods.returnAndRiskMetrics.sharpeRatio !== undefined);
  assert.ok(analysis.methods.advancedMethods.garch);
  assert.ok(analysis.methods.advancedMethods.randomForest);
  assert.ok(analysis.methods.advancedMethods.gradientBoosting);
  assert.equal(analysis.raw.length, analysis.summary.observations);
});

test('market-api mode requires api key when not present in request, env, or access.txt', async () => {
  const accessConfig = loadAccessConfig();
  if (accessConfig.marketApi?.key) {
    assert.ok(accessConfig.marketApi.key.length > 0);
    return;
  }

  await assert.rejects(
    () => loadMarketApiObservations({ provider: 'alphavantage' }),
    /API key is required/
  );
});

test('unsupported market provider is rejected', async () => {
  await assert.rejects(
    () => loadMarketApiObservations({ provider: 'unknown-provider', apiKey: 'demo' }),
    /Unsupported market provider/
  );
});

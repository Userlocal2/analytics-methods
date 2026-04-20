let chartInstances = [];

function destroyCharts() {
  chartInstances.forEach((chart) => chart.destroy());
  chartInstances = [];
}

function makeChart(elementId, config) {
  const chart = new Chart(document.getElementById(elementId), config);
  chartInstances.push(chart);
  return chart;
}

function buildQuery() {
  const source = document.querySelector('input[name="sourceMode"]:checked').value;
  const params = new URLSearchParams({ source });

  if (source === 'yahoo') {
    [
      ['asset', 'assetInput'],
      ['market', 'marketInput'],
      ['assetA', 'assetAInput'],
      ['assetB', 'assetBInput'],
      ['assetC', 'assetCInput'],
      ['range', 'rangeInput'],
      ['interval', 'intervalInput']
    ].forEach(([key, id]) => {
      const value = document.getElementById(id).value.trim();
      if (value) params.set(key, value);
    });
  }

  if (source === 'market-api') {
    [
      ['provider', 'providerInput'],
      ['apiKey', 'apiKeyInput'],
      ['asset', 'marketAssetInput'],
      ['market', 'marketBenchmarkInput'],
      ['assetA', 'marketAssetAInput'],
      ['assetB', 'marketAssetBInput'],
      ['assetC', 'marketAssetCInput']
    ].forEach(([key, id]) => {
      const value = document.getElementById(id).value.trim();
      if (value) params.set(key, value);
    });
  }


  return `/api/analysis?${params.toString()}`;
}

function updateSourceStatus(data) {
  const status = document.getElementById('sourceStatus');
  if (data.summary.dataSource === 'yahoo' && data.summary.yahoo) {
    const cacheNotes = Object.entries(data.summary.yahoo.cache || {})
      .map(([symbol, meta]) => meta?.stale ? `${symbol}: stale cache` : (meta?.cacheHit ? `${symbol}: cache` : `${symbol}: live`))
      .join(', ');
    status.textContent = `Источник: Yahoo Finance, asset=${data.summary.yahoo.asset}, market=${data.summary.yahoo.market}, range=${data.summary.yahoo.range}, interval=${data.summary.yahoo.interval}, rows=${data.summary.loadedRows}${cacheNotes ? `, ${cacheNotes}` : ''}`;
    return;
  }
  if (data.summary.dataSource === 'market-api' && data.summary.marketApi) {
    const cacheNotes = Object.entries(data.summary.marketApi.cache || {})
      .map(([symbol, meta]) => meta?.cacheHit ? `${symbol}: cache` : `${symbol}: live`)
      .join(', ');
    status.textContent = `Источник: Market API (${data.summary.marketApi.provider}), asset=${data.summary.marketApi.asset}, market=${data.summary.marketApi.market}, rows=${data.summary.loadedRows}${cacheNotes ? `, ${cacheNotes}` : ''}`;
    return;
  }
  if (data.summary.dataSource === 'excel') {
    status.textContent = `Источник: Excel (${data.summary.sheetName || 'Sheet1'}), rows=${data.summary.loadedRows}`;
    return;
  }
  status.textContent = `Источник: demo dataset, rows=${data.summary.loadedRows}`;
}

async function load() {
  const response = await fetch(buildQuery());
  const data = await response.json();

  if (!response.ok) {
    document.getElementById('sourceStatus').textContent = `Ошибка: ${data.error || 'не удалось загрузить данные'}`;
    destroyCharts();
    document.getElementById('summary').innerHTML = '';
    document.getElementById('metrics').textContent = '';
    return;
  }

  updateSourceStatus(data);
  destroyCharts();

  document.getElementById('summary').innerHTML = [
    ['Наблюдений', data.summary.observations],
    ['Среднее Y', data.summary.averageY.toFixed(2)],
    ['Pearson X1,Y', data.methods.assetRelationshipMethods.pearsonCorrelationCoefficient.x1_y.toFixed(3)],
    ['CAPM Beta', data.methods.capm.beta.toFixed(3)],
    ['Std Dev', data.methods.returnAndRiskMetrics.standardDeviation.toFixed(4)],
    ['Downside Dev', data.methods.returnAndRiskMetrics.downsideDeviation.toFixed(4)],
    ['OLS R²', data.methods.regressionAnalysis.ordinaryLeastSquares.rSquared.toFixed(3)],
    ['Min Var Risk', data.methods.portfolioOptimization.minimumVariancePortfolio.risk.toFixed(4)],
    ['Max Sharpe', data.methods.portfolioOptimization.maximumSharpePortfolio.sharpeLike.toFixed(4)],
    ['PCA Var', data.methods.advancedMethods.principalComponentAnalysis.explainedVarianceApprox.toFixed(3)],
    ['RF R²', data.methods.advancedMethods.randomForest.rSquared.toFixed(3)],
    ['GB R²', data.methods.advancedMethods.gradientBoosting.rSquared.toFixed(3)]
  ].map(([label, value]) => `
    <div class="card">
      <div>${label}</div>
      <div class="metric-value">${value}</div>
    </div>
  `).join('');

  document.getElementById('metrics').textContent = JSON.stringify(data.methods, null, 2);

  const labels = data.raw.map((row) => row.month);

  makeChart('linearChart', {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Наблюдения',
          data: data.raw.map((row) => ({ x: row.x1, y: row.y })),
          backgroundColor: '#2563eb'
        },
        {
          label: 'Линия регрессии',
          type: 'line',
          data: data.raw.map((row, i) => ({ x: row.x1, y: data.derived.linearPredicted[i] })),
          borderColor: '#dc2626'
        }
      ]
    }
  });

  makeChart('timeSeriesChart', {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'Y по месяцам', data: data.methods.timeSeriesAnalysis.series, borderColor: '#22c55e' }]
    }
  });

  makeChart('spatialChart', {
    type: 'bar',
    data: {
      labels: Object.keys(data.methods.spatialCrossSectionalAnalysis),
      datasets: [{ label: 'Средний Y по регионам', data: Object.values(data.methods.spatialCrossSectionalAnalysis), backgroundColor: '#f59e0b' }]
    }
  });

  makeChart('capmChart', {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Доходности',
          data: data.raw.map((row) => ({ x: row.marketReturn, y: row.assetReturn })),
          backgroundColor: '#8b5cf6'
        },
        {
          label: 'CAPM линия',
          type: 'line',
          data: data.raw.map((row, i) => ({ x: row.marketReturn, y: data.derived.capmPredicted[i] + 0.005 })),
          borderColor: '#ef4444'
        }
      ]
    }
  });

  const grouped = data.raw.reduce((acc, row) => {
    acc[row.category] = acc[row.category] || [];
    acc[row.category].push(row.y);
    return acc;
  }, {});

  makeChart('anovaChart', {
    type: 'bar',
    data: {
      labels: Object.keys(grouped),
      datasets: [{ label: 'Средние по группам', data: Object.values(grouped).map(values => values.reduce((a,b)=>a+b,0)/values.length), backgroundColor: '#14b8a6' }]
    }
  });

  makeChart('residualChart', {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'Residuals', data: data.derived.multipleResiduals, borderColor: '#f97316' }]
    }
  });

  makeChart('rollingSharpeChart', {
    type: 'line',
    data: {
      labels: labels.slice(2),
      datasets: [{ label: 'Rolling Sharpe', data: data.methods.timeSeriesAnalysis.rollingSharpeWindow3, borderColor: '#06b6d4' }]
    }
  });

  makeChart('monteCarloChart', {
    type: 'bar',
    data: {
      labels: data.methods.probabilityAndSimulationMethods.inverseCumulativeSimulation.monteCarloScenarios.map((_, i) => `S${i + 1}`),
      datasets: [{ label: 'Monte Carlo', data: data.methods.probabilityAndSimulationMethods.inverseCumulativeSimulation.monteCarloScenarios, backgroundColor: '#a855f7' }]
    }
  });

  makeChart('frontierChart', {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Efficient Frontier',
          data: data.methods.portfolioOptimization.efficientFrontier.map(point => ({ x: point.risk, y: point.expectedReturn })),
          backgroundColor: '#10b981'
        },
        {
          label: 'Min Variance',
          data: [{ x: data.methods.portfolioOptimization.minimumVariancePortfolio.risk, y: data.methods.portfolioOptimization.minimumVariancePortfolio.expectedReturn }],
          backgroundColor: '#ef4444',
          pointRadius: 6
        },
        {
          label: 'Max Sharpe',
          data: [{ x: data.methods.portfolioOptimization.maximumSharpePortfolio.risk, y: data.methods.portfolioOptimization.maximumSharpePortfolio.expectedReturn }],
          backgroundColor: '#f59e0b',
          pointRadius: 6
        }
      ]
    }
  });

  makeChart('clusterChart', {
    type: 'scatter',
    data: {
      datasets: [0, 1].map(clusterId => ({
        label: `Cluster ${clusterId + 1}`,
        data: data.raw
          .map((row, i) => ({ x: row.x1, y: row.x2, cluster: data.methods.advancedMethods.clusterAnalysis.assignments[i] }))
          .filter(point => point.cluster === clusterId),
        backgroundColor: clusterId === 0 ? '#3b82f6' : '#ec4899'
      }))
    }
  });

  makeChart('pcaChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'PCA Score', data: data.methods.advancedMethods.principalComponentAnalysis.scores, backgroundColor: '#8b5cf6' }]
    }
  });

  makeChart('logisticChart', {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'Probability', data: data.methods.advancedMethods.logisticRegression.probabilities, borderColor: '#f43f5e' }]
    }
  });

  makeChart('factorChart', {
    type: 'bar',
    data: {
      labels: ['Factor loading 1', 'Factor loading 2'],
      datasets: [{ label: 'Loadings', data: data.methods.advancedMethods.factorAnalysis.factorLoadings, backgroundColor: '#22c55e' }]
    }
  });

  document.getElementById('nonparametricCard').innerHTML = `
    <div class="mini">
      <div class="label">Mann-Whitney U</div>
      <div class="value">${data.methods.advancedMethods.nonparametricMethods.mannWhitney.u.toFixed(3)}</div>
    </div>
    <div class="mini">
      <div class="label">Wilcoxon W</div>
      <div class="value">${data.methods.advancedMethods.nonparametricMethods.wilcoxon.w.toFixed(3)}</div>
    </div>
  `;

  makeChart('panelChart', {
    type: 'bar',
    data: {
      labels: Object.keys(data.methods.advancedMethods.panelDataAnalysis.entityMeans),
      datasets: [{ label: 'Entity mean assetReturn', data: Object.values(data.methods.advancedMethods.panelDataAnalysis.entityMeans), backgroundColor: '#0ea5e9' }]
    }
  });

  makeChart('garchChart', {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'Conditional volatility', data: data.methods.advancedMethods.garch.conditionalVolatility, borderColor: '#e11d48' }]
    }
  });

  makeChart('randomForestChart', {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Actual Y', data: data.methods.timeSeriesAnalysis.series, borderColor: '#64748b' },
        { label: 'RF Prediction', data: data.methods.advancedMethods.randomForest.predictions, borderColor: '#16a34a' }
      ]
    }
  });

  makeChart('gradientBoostingChart', {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Actual Y', data: data.methods.timeSeriesAnalysis.series, borderColor: '#64748b' },
        { label: 'GB Prediction', data: data.methods.advancedMethods.gradientBoosting.predictions, borderColor: '#7c3aed' }
      ]
    }
  });
}

document.querySelectorAll('input[name="sourceMode"]').forEach((input) => {
  input.addEventListener('change', () => {
    const mode = document.querySelector('input[name="sourceMode"]:checked').value;
    document.getElementById('yahooControls').classList.toggle('hidden', mode !== 'yahoo');
    document.getElementById('marketApiControls').classList.toggle('hidden', mode !== 'market-api');
  });
});

document.getElementById('reloadButton').addEventListener('click', load);

load();

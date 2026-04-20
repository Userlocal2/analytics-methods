const { loadObservations } = require('./data');
const {
  covariance,
  correlation,
  linearRegression,
  multipleRegression,
  anova,
  durbinWatson,
  breuschPagan,
  whiteTest,
  capm,
  autocorrelation,
  mean,
  arithmeticMean,
  geometricMean,
  downsideDeviation,
  variance,
  stdDev,
  volatility,
  sharpeRatio,
  sortinoRatio,
  percentageChange,
  logReturns,
  valueAtRisk,
  skewness,
  kurtosis,
  normalPdf,
  monteCarloScenarios,
  rollingWindow,
  covarianceMatrix,
  portfolioReturn,
  portfolioRisk,
  efficientFrontier,
  logisticRegression,
  kMeans,
  pca2D,
  mannWhitneyU,
  wilcoxonSignedRank,
  factorAnalysisApprox,
  panelDataSummary,
  garch11,
  randomForestRegressor,
  gradientBoostingRegressor
} = require('./stats');

async function buildAnalysis(options = {}) {
  const { observations, source, excelPath, sheetName, rowCount, yahoo, marketApi } = await loadObservations(options);
  const x1 = observations.map((row) => row.x1);
  const x2 = observations.map((row) => row.x2);
  const y = observations.map((row) => row.y);
  const marketReturns = observations.map((row) => row.marketReturn);
  const assetReturns = observations.map((row) => row.assetReturn);
  const assetSeries = {
    assetA: observations.map((row) => row.assetA),
    assetB: observations.map((row) => row.assetB),
    assetC: observations.map((row) => row.assetC)
  };
  const meanReturns = Object.values(assetSeries).map((series) => arithmeticMean(series));
  const covMatrix = covarianceMatrix(assetSeries);
  const frontier = efficientFrontier(meanReturns, covMatrix, 10);
  const sampleWeights = [0.4, 0.3, 0.3];
  const minVariancePortfolio = frontier.reduce((best, point) => (point.risk < best.risk ? point : best), frontier[0]);
  const maxSharpePortfolio = frontier.reduce((best, point) => {
    const sharpe = (point.expectedReturn - 0.005) / point.risk;
    const bestSharpe = (best.expectedReturn - 0.005) / best.risk;
    return sharpe > bestSharpe ? point : best;
  }, frontier[0]);

  const priceSeries = observations.reduce((acc, row, index) => {
    if (index === 0) return [100 * (1 + row.assetReturn)];
    acc.push(acc[acc.length - 1] * (1 + row.assetReturn));
    return acc;
  }, []);
  const pctChanges = percentageChange(priceSeries);
  const logReturnSeries = logReturns(priceSeries);
  const features = observations.map((row) => [row.x1, row.x2]);

  const linear = linearRegression(x1, y);
  const multiple = multipleRegression(features, y);
  const capmModel = capm(marketReturns, assetReturns);
  const logisticLabels = observations.map((row) => (row.assetReturn > 0.025 ? 1 : 0));
  const logisticModel = logisticRegression(features, logisticLabels);
  const clusterModel = kMeans(features, 2, 12);
  const pcaModel = pca2D(features);
  const factorModel = factorAnalysisApprox(features);
  const garchModel = garch11(assetReturns);
  const randomForestModel = randomForestRegressor(features, y, 31);
  const gradientBoostingModel = gradientBoostingRegressor(features, y, 24, 0.12);
  const nonparametric = {
    mannWhitney: mannWhitneyU(
      observations.filter(row => row.category === 'A').map(row => row.assetReturn),
      observations.filter(row => row.category === 'B').map(row => row.assetReturn)
    ),
    wilcoxon: wilcoxonSignedRank(
      observations.map(row => row.assetA),
      observations.map(row => row.assetB)
    )
  };
  const panelData = panelDataSummary(observations, 'region', 'month', 'assetReturn');

  const groups = observations.reduce((acc, row) => {
    acc[row.category] = acc[row.category] || [];
    acc[row.category].push(row.y);
    return acc;
  }, {});

  const spatialGroups = observations.reduce((acc, row) => {
    acc[row.region] = acc[row.region] || [];
    acc[row.region].push(row.y);
    return acc;
  }, {});

  return {
    summary: {
      observations: observations.length,
      averageY: mean(y),
      averageMarketReturn: mean(marketReturns),
      dataSource: source,
      excelPath,
      sheetName: sheetName || null,
      loadedRows: rowCount || observations.length,
      yahoo: yahoo || null,
      marketApi: marketApi || null
    },
    methods: {
      assetRelationshipMethods: {
        pearsonCorrelationCoefficient: {
          x1_y: correlation(x1, y),
          x2_y: correlation(x2, y),
          x1_x2: correlation(x1, x2)
        },
        covariance: {
          x1_y: covariance(x1, y),
          x2_y: covariance(x2, y),
          x1_x2: covariance(x1, x2)
        },
        autocorrelation: {
          assetReturnsLag1: autocorrelation(assetReturns, 1)
        }
      },
      correlationAnalysis: {
        x1_y: correlation(x1, y),
        x2_y: correlation(x2, y),
        x1_x2: correlation(x1, x2)
      },
      covarianceAnalysis: {
        x1_y: covariance(x1, y),
        x2_y: covariance(x2, y),
        x1_x2: covariance(x1, x2)
      },
      regressionAnalysis: {
        ordinaryLeastSquares: {
          method: 'OLS',
          target: 'y',
          predictors: ['x1', 'x2'],
          rSquared: multiple.rSquared
        },
        simpleLinearRegression: {
          intercept: linear.intercept,
          slope: linear.slope,
          rSquared: linear.rSquared
        },
        multipleLinearRegression: {
          intercept: multiple.coefficients[0],
          x1: multiple.coefficients[1],
          x2: multiple.coefficients[2],
          rSquared: multiple.rSquared
        },
        factorInterpretation: {
          alpha: capmModel.alpha,
          beta: capmModel.beta,
          coefficientOfDetermination: linear.rSquared
        }
      },
      probabilityAndSimulationMethods: {
        probabilityDensityFunction: {
          mean: arithmeticMean(assetReturns),
          standardDeviation: stdDev(assetReturns),
          samplePoints: assetReturns.slice(0, 5).map((value) => ({
            x: value,
            pdf: normalPdf(value, arithmeticMean(assetReturns), stdDev(assetReturns))
          }))
        },
        inverseCumulativeSimulation: {
          monteCarloScenarios: monteCarloScenarios(arithmeticMean(assetReturns), stdDev(assetReturns), 12, 50).slice(0, 10)
        },
        quantilesAndPercentiles: {
          valueAtRisk95: valueAtRisk(assetReturns, 0.95),
          valueAtRisk99: valueAtRisk(assetReturns, 0.99)
        },
        skewness: skewness(assetReturns),
        kurtosis: kurtosis(assetReturns)
      },
      timeSeriesAnalysis: {
        months: observations.map((row) => row.month),
        series: y,
        lag1Autocorrelation: autocorrelation(y, 1),
        percentageChange: pctChanges,
        logReturns: logReturnSeries,
        rollingSharpeWindow3: rollingWindow(assetReturns, 3, (window) => sharpeRatio(window, 0.005))
      },
      spatialCrossSectionalAnalysis: Object.fromEntries(
        Object.entries(spatialGroups).map(([region, values]) => [region, mean(values)])
      ),
      anova: anova(groups),
      capm: {
        alpha: capmModel.alpha,
        beta: capmModel.beta
      },
      returnAndRiskMetrics: {
        arithmeticMean: arithmeticMean(assetReturns),
        geometricMean: geometricMean(assetReturns),
        variance: variance(assetReturns),
        standardDeviation: stdDev(assetReturns),
        downsideDeviation: downsideDeviation(assetReturns),
        volatility: volatility(assetReturns),
        sharpeRatio: sharpeRatio(assetReturns, 0.005),
        sortinoRatio: sortinoRatio(assetReturns, 0)
      },
      portfolioOptimization: {
        assets: Object.keys(assetSeries),
        meanReturns,
        covarianceMatrix: covMatrix,
        samplePortfolio: {
          weights: sampleWeights,
          expectedReturn: portfolioReturn(sampleWeights, meanReturns),
          risk: portfolioRisk(sampleWeights, covMatrix)
        },
        minimumVariancePortfolio: {
          ...minVariancePortfolio,
          sharpeLike: (minVariancePortfolio.expectedReturn - 0.005) / minVariancePortfolio.risk
        },
        maximumSharpePortfolio: {
          ...maxSharpePortfolio,
          sharpeLike: (maxSharpePortfolio.expectedReturn - 0.005) / maxSharpePortfolio.risk
        },
        efficientFrontier: frontier.slice(0, 25),
        optimizationNote: 'Quadratic programming is the next step for constrained optimal weights.'
      },
      advancedMethods: {
        logisticRegression: {
          target: 'assetReturn > 0.025',
          weights: logisticModel.weights,
          probabilities: logisticModel.probabilities
        },
        clusterAnalysis: {
          k: 2,
          centroids: clusterModel.centroids,
          assignments: clusterModel.assignments
        },
        principalComponentAnalysis: {
          component1: pcaModel.component1,
          explainedVarianceApprox: pcaModel.explainedVarianceApprox,
          scores: pcaModel.scores
        },
        factorAnalysis: factorModel,
        nonparametricMethods: nonparametric,
        panelDataAnalysis: panelData,
        garch: garchModel,
        randomForest: randomForestModel,
        gradientBoosting: gradientBoostingModel
      },
      regressionDiagnostics: {
        durbinWatson: durbinWatson(multiple.residuals),
        breuschPaganGodfrey: breuschPagan(multiple.residuals, features),
        whiteTest: whiteTest(multiple.residuals, features)
      }
    },
    raw: observations,
    derived: {
      linearPredicted: linear.predicted,
      multiplePredicted: multiple.predicted,
      capmPredicted: capmModel.predicted,
      multipleResiduals: multiple.residuals
    }
  };
}

if (require.main === module) {
  buildAnalysis().then((result) => {
    console.log(JSON.stringify(result, null, 2));
  });
}

module.exports = { buildAnalysis };

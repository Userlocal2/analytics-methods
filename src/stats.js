function mean(arr) {
  return arr.reduce((sum, value) => sum + value, 0) / arr.length;
}

function variance(arr, sample = true) {
  const m = mean(arr);
  const divisor = sample ? arr.length - 1 : arr.length;
  return arr.reduce((sum, value) => sum + (value - m) ** 2, 0) / divisor;
}

function stdDev(arr, sample = true) {
  return Math.sqrt(variance(arr, sample));
}

function covariance(x, y, sample = true) {
  const mx = mean(x);
  const my = mean(y);
  const divisor = sample ? x.length - 1 : x.length;
  let total = 0;
  for (let i = 0; i < x.length; i += 1) total += (x[i] - mx) * (y[i] - my);
  return total / divisor;
}

function correlation(x, y) {
  return covariance(x, y) / (stdDev(x) * stdDev(y));
}

function transpose(matrix) {
  return matrix[0].map((_, i) => matrix.map((row) => row[i]));
}

function multiplyMatrices(a, b) {
  const rows = a.length;
  const cols = b[0].length;
  const shared = b.length;
  const result = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      for (let k = 0; k < shared; k += 1) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

function multiplyMatrixVector(a, v) {
  return a.map((row) => row.reduce((sum, value, index) => sum + value * v[index], 0));
}

function invertMatrix(matrix) {
  const n = matrix.length;
  const augmented = matrix.map((row, i) => [
    ...row.map((value) => Number(value)),
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  ]);

  for (let i = 0; i < n; i += 1) {
    let pivot = augmented[i][i];
    if (Math.abs(pivot) < 1e-10) {
      const swapRow = augmented.findIndex((row, idx) => idx > i && Math.abs(row[i]) > 1e-10);
      if (swapRow === -1) throw new Error('Matrix is singular');
      [augmented[i], augmented[swapRow]] = [augmented[swapRow], augmented[i]];
      pivot = augmented[i][i];
    }

    for (let j = 0; j < 2 * n; j += 1) augmented[i][j] /= pivot;

    for (let k = 0; k < n; k += 1) {
      if (k === i) continue;
      const factor = augmented[k][i];
      for (let j = 0; j < 2 * n; j += 1) augmented[k][j] -= factor * augmented[i][j];
    }
  }

  return augmented.map((row) => row.slice(n));
}

function coefficientOfDetermination(actual, predicted) {
  const actualMean = mean(actual);
  const sse = actual.reduce((sum, value, i) => sum + (value - predicted[i]) ** 2, 0);
  const sst = actual.reduce((sum, value) => sum + (value - actualMean) ** 2, 0);
  return 1 - sse / sst;
}

function linearRegression(x, y) {
  const slope = covariance(x, y) / variance(x);
  const intercept = mean(y) - slope * mean(x);
  const predicted = x.map((value) => intercept + slope * value);
  const residuals = y.map((value, i) => value - predicted[i]);
  const rSquared = coefficientOfDetermination(y, predicted);
  return { intercept, slope, predicted, residuals, rSquared };
}

function multipleRegression(features, y) {
  const X = features.map((row) => [1, ...row]);
  const Xt = transpose(X);
  const XtX = multiplyMatrices(Xt, X);
  const XtY = multiplyMatrixVector(Xt, y);
  const beta = multiplyMatrixVector(invertMatrix(XtX), XtY);
  const predicted = X.map((row) => row.reduce((sum, value, i) => sum + value * beta[i], 0));
  const residuals = y.map((value, i) => value - predicted[i]);
  const rSquared = coefficientOfDetermination(y, predicted);
  return { coefficients: beta, predicted, residuals, rSquared };
}

function anova(groups) {
  const labels = Object.keys(groups);
  const all = labels.flatMap((label) => groups[label]);
  const overallMean = mean(all);
  const ssBetween = labels.reduce((sum, label) => sum + groups[label].length * (mean(groups[label]) - overallMean) ** 2, 0);
  const ssWithin = labels.reduce((sum, label) => sum + groups[label].reduce((inner, value) => inner + (value - mean(groups[label])) ** 2, 0), 0);
  const dfBetween = labels.length - 1;
  const dfWithin = all.length - labels.length;
  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;
  return {
    ssBetween,
    ssWithin,
    dfBetween,
    dfWithin,
    fStatistic: msBetween / msWithin
  };
}

function durbinWatson(residuals) {
  let numerator = 0;
  for (let i = 1; i < residuals.length; i += 1) numerator += (residuals[i] - residuals[i - 1]) ** 2;
  const denominator = residuals.reduce((sum, value) => sum + value ** 2, 0);
  return numerator / denominator;
}

function breuschPagan(residuals, predictors) {
  const squaredResiduals = residuals.map((value) => value ** 2);
  const aux = multipleRegression(predictors, squaredResiduals);
  const meanSq = mean(squaredResiduals);
  const sst = squaredResiduals.reduce((sum, value) => sum + (value - meanSq) ** 2, 0);
  const sse = aux.residuals.reduce((sum, value) => sum + value ** 2, 0);
  const rSquared = 1 - sse / sst;
  return { statistic: predictors.length * rSquared, rSquared };
}

function whiteTest(residuals, predictors) {
  const expanded = predictors.map((row) => {
    const [x1, x2] = row;
    return [x1, x2, x1 ** 2, x2 ** 2, x1 * x2];
  });
  return breuschPagan(residuals, expanded);
}

function capm(marketReturns, assetReturns, riskFreeRate = 0.005) {
  const excessMarket = marketReturns.map((value) => value - riskFreeRate);
  const excessAsset = assetReturns.map((value) => value - riskFreeRate);
  const reg = linearRegression(excessMarket, excessAsset);
  return {
    alpha: reg.intercept,
    beta: reg.slope,
    predicted: reg.predicted,
    residuals: reg.residuals
  };
}

function autocorrelation(series, lag = 1) {
  const trimmed = series.slice(lag);
  const base = series.slice(0, series.length - lag);
  return correlation(trimmed, base);
}

function arithmeticMean(returns) {
  return mean(returns);
}

function geometricMean(returns) {
  const growth = returns.reduce((product, value) => product * (1 + value), 1);
  return growth ** (1 / returns.length) - 1;
}

function downsideDeviation(returns, target = 0) {
  const downside = returns.map((value) => Math.min(0, value - target));
  const squared = downside.reduce((sum, value) => sum + value ** 2, 0);
  return Math.sqrt(squared / returns.length);
}

function volatility(returns) {
  return stdDev(returns);
}

function sharpeRatio(returns, riskFreeRate = 0) {
  const excessReturns = returns.map((value) => value - riskFreeRate);
  return arithmeticMean(excessReturns) / stdDev(returns);
}

function sortinoRatio(returns, target = 0) {
  const excessReturns = returns.map((value) => value - target);
  return arithmeticMean(excessReturns) / downsideDeviation(returns, target);
}

function percentageChange(series) {
  return series.slice(1).map((value, index) => (value - series[index]) / series[index]);
}

function logReturns(series) {
  return series.slice(1).map((value, index) => Math.log(value / series[index]));
}

function quantile(sortedArr, p) {
  const arr = [...sortedArr].sort((a, b) => a - b);
  const position = (arr.length - 1) * p;
  const base = Math.floor(position);
  const rest = position - base;
  if (arr[base + 1] !== undefined) return arr[base] + rest * (arr[base + 1] - arr[base]);
  return arr[base];
}

function valueAtRisk(returns, confidence = 0.95) {
  return -quantile(returns, 1 - confidence);
}

function skewness(arr) {
  const m = mean(arr);
  const s = stdDev(arr, false);
  const n = arr.length;
  return arr.reduce((sum, value) => sum + ((value - m) / s) ** 3, 0) / n;
}

function kurtosis(arr) {
  const m = mean(arr);
  const s = stdDev(arr, false);
  const n = arr.length;
  return arr.reduce((sum, value) => sum + ((value - m) / s) ** 4, 0) / n - 3;
}

function normalPdf(x, meanValue, stdValue) {
  const exponent = -((x - meanValue) ** 2) / (2 * stdValue ** 2);
  return (1 / (stdValue * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
}

function monteCarloScenarios(meanValue, stdValue, periods = 10, scenarios = 100) {
  const results = [];
  for (let i = 0; i < scenarios; i += 1) {
    let current = 1;
    for (let j = 0; j < periods; j += 1) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      current *= 1 + (meanValue + z * stdValue);
    }
    results.push(current - 1);
  }
  return results;
}

function rollingWindow(arr, windowSize, reducer) {
  const out = [];
  for (let i = windowSize - 1; i < arr.length; i += 1) {
    out.push(reducer(arr.slice(i - windowSize + 1, i + 1)));
  }
  return out;
}

function covarianceMatrix(seriesMap) {
  const keys = Object.keys(seriesMap);
  return keys.map((keyA) => keys.map((keyB) => covariance(seriesMap[keyA], seriesMap[keyB])));
}

function portfolioReturn(weights, meanReturns) {
  return weights.reduce((sum, weight, i) => sum + weight * meanReturns[i], 0);
}

function portfolioRisk(weights, covMatrix) {
  let total = 0;
  for (let i = 0; i < weights.length; i += 1) {
    for (let j = 0; j < weights.length; j += 1) {
      total += weights[i] * weights[j] * covMatrix[i][j];
    }
  }
  return Math.sqrt(total);
}

function efficientFrontier(meanReturns, covMatrix, steps = 20) {
  const frontier = [];
  for (let w1 = 0; w1 <= 1; w1 += 1 / steps) {
    for (let w2 = 0; w2 <= 1 - w1; w2 += 1 / steps) {
      const w3 = 1 - w1 - w2;
      const weights = [w1, w2, w3];
      frontier.push({
        weights,
        expectedReturn: portfolioReturn(weights, meanReturns),
        risk: portfolioRisk(weights, covMatrix)
      });
    }
  }
  return frontier.sort((a, b) => a.risk - b.risk);
}

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

function logisticRegression(features, labels, learningRate = 0.01, iterations = 2000) {
  const X = features.map((row) => [1, ...row]);
  let weights = Array(X[0].length).fill(0);

  for (let iter = 0; iter < iterations; iter += 1) {
    const gradients = Array(weights.length).fill(0);
    for (let i = 0; i < X.length; i += 1) {
      const prediction = sigmoid(X[i].reduce((sum, value, j) => sum + value * weights[j], 0));
      const error = prediction - labels[i];
      for (let j = 0; j < weights.length; j += 1) gradients[j] += error * X[i][j];
    }
    weights = weights.map((weight, j) => weight - (learningRate * gradients[j]) / X.length);
  }

  const probabilities = X.map((row) => sigmoid(row.reduce((sum, value, j) => sum + value * weights[j], 0)));
  return { weights, probabilities };
}

function kMeans(points, k = 2, iterations = 10) {
  let centroids = points.slice(0, k).map((point) => [...point]);
  let assignments = Array(points.length).fill(0);

  for (let iter = 0; iter < iterations; iter += 1) {
    assignments = points.map((point) => {
      let best = 0;
      let bestDistance = Infinity;
      centroids.forEach((centroid, idx) => {
        const distance = Math.sqrt(point.reduce((sum, value, i) => sum + (value - centroid[i]) ** 2, 0));
        if (distance < bestDistance) {
          bestDistance = distance;
          best = idx;
        }
      });
      return best;
    });

    centroids = centroids.map((centroid, idx) => {
      const clusterPoints = points.filter((_, i) => assignments[i] === idx);
      if (!clusterPoints.length) return centroid;
      return centroid.map((_, dim) => mean(clusterPoints.map((point) => point[dim])));
    });
  }

  return { centroids, assignments };
}

function pca2D(points) {
  const dims = points[0].length;
  const centered = points.map((point) => point.map((value, i) => value - mean(points.map((p) => p[i]))));
  const cov = Array.from({ length: dims }, (_, i) => Array.from({ length: dims }, (_, j) => covariance(centered.map(r => r[i]), centered.map(r => r[j]), false)));
  const component1 = cov[0][0] >= cov[1][1] ? [1, 0] : [0, 1];
  const scores = centered.map((point) => point.reduce((sum, value, i) => sum + value * component1[i], 0));
  return {
    explainedVarianceApprox: Math.max(cov[0][0], cov[1][1]) / (cov[0][0] + cov[1][1]),
    component1,
    scores
  };
}

function mannWhitneyU(sampleA, sampleB) {
  const combined = [...sampleA.map(v => ({ value: v, group: 'A' })), ...sampleB.map(v => ({ value: v, group: 'B' }))]
    .sort((a, b) => a.value - b.value)
    .map((item, index) => ({ ...item, rank: index + 1 }));
  const rankA = combined.filter(item => item.group === 'A').reduce((sum, item) => sum + item.rank, 0);
  const u1 = rankA - (sampleA.length * (sampleA.length + 1)) / 2;
  const u2 = sampleA.length * sampleB.length - u1;
  return { u: Math.min(u1, u2), u1, u2 };
}

function wilcoxonSignedRank(sampleA, sampleB) {
  const diffs = sampleA.map((value, i) => value - sampleB[i]).filter(value => value !== 0);
  const ranked = diffs
    .map((value) => ({ value, abs: Math.abs(value) }))
    .sort((a, b) => a.abs - b.abs)
    .map((item, index) => ({ ...item, rank: index + 1 }));
  const positive = ranked.filter(item => item.value > 0).reduce((sum, item) => sum + item.rank, 0);
  const negative = ranked.filter(item => item.value < 0).reduce((sum, item) => sum + item.rank, 0);
  return { w: Math.min(positive, negative), positive, negative };
}

function factorAnalysisApprox(points) {
  const x = points.map(point => point[0]);
  const y = points.map(point => point[1]);
  const loading = correlation(x, y);
  return {
    latentFactorApprox: 'single common factor',
    factorLoadings: [loading, loading],
    communalities: [loading ** 2, loading ** 2]
  };
}

function panelDataSummary(observations, entityKey, timeKey, valueKey) {
  const entities = [...new Set(observations.map(row => row[entityKey]))];
  const times = [...new Set(observations.map(row => row[timeKey]))];
  const entityMeans = Object.fromEntries(entities.map(entity => [entity, mean(observations.filter(row => row[entityKey] === entity).map(row => row[valueKey]))]));
  const timeMeans = Object.fromEntries(times.map(time => [time, mean(observations.filter(row => row[timeKey] === time).map(row => row[valueKey]))]));
  return { entities, times, entityMeans, timeMeans };
}

function garch11(returns, omega = 0.00001, alpha = 0.15, beta = 0.8) {
  const longRunVariance = variance(returns, false);
  const residuals = returns.map((value) => value - mean(returns));
  const conditionalVariance = [longRunVariance];

  for (let i = 1; i < residuals.length; i += 1) {
    conditionalVariance.push(
      omega + alpha * residuals[i - 1] ** 2 + beta * conditionalVariance[i - 1]
    );
  }

  return {
    model: 'GARCH(1,1)',
    omega,
    alpha,
    beta,
    unconditionalVariance: omega / Math.max(1e-8, 1 - alpha - beta),
    conditionalVariance,
    conditionalVolatility: conditionalVariance.map((value) => Math.sqrt(Math.max(value, 0)))
  };
}

function decisionStumpRegressor(features, targets, featureIndex) {
  const values = [...new Set(features.map((row) => row[featureIndex]))].sort((a, b) => a - b);
  let best = null;

  for (let i = 0; i < values.length - 1; i += 1) {
    const threshold = (values[i] + values[i + 1]) / 2;
    const leftTargets = [];
    const rightTargets = [];

    features.forEach((row, idx) => {
      if (row[featureIndex] <= threshold) leftTargets.push(targets[idx]);
      else rightTargets.push(targets[idx]);
    });

    if (!leftTargets.length || !rightTargets.length) continue;

    const leftValue = mean(leftTargets);
    const rightValue = mean(rightTargets);
    const predictions = features.map((row) => (row[featureIndex] <= threshold ? leftValue : rightValue));
    const mse = mean(predictions.map((prediction, idx) => (prediction - targets[idx]) ** 2));

    if (!best || mse < best.mse) {
      best = { featureIndex, threshold, leftValue, rightValue, mse, predictions };
    }
  }

  return best;
}

function randomForestRegressor(features, targets, treeCount = 25) {
  const trees = [];
  const featureCount = features[0].length;

  for (let tree = 0; tree < treeCount; tree += 1) {
    const sampledFeatures = [];
    const sampledTargets = [];
    for (let i = 0; i < features.length; i += 1) {
      const pick = Math.floor(Math.random() * features.length);
      sampledFeatures.push(features[pick]);
      sampledTargets.push(targets[pick]);
    }

    const featureIndex = tree % featureCount;
    const stump = decisionStumpRegressor(sampledFeatures, sampledTargets, featureIndex);
    if (stump) trees.push(stump);
  }

  const predictions = features.map((row) => mean(trees.map((tree) => (row[tree.featureIndex] <= tree.threshold ? tree.leftValue : tree.rightValue))));
  return {
    model: 'Random Forest Regressor',
    treeCount: trees.length,
    predictions,
    featureUsage: Array.from({ length: featureCount }, (_, idx) => trees.filter((tree) => tree.featureIndex === idx).length),
    rSquared: coefficientOfDetermination(targets, predictions)
  };
}

function gradientBoostingRegressor(features, targets, rounds = 20, learningRate = 0.1) {
  const baseValue = mean(targets);
  const predictions = Array(targets.length).fill(baseValue);
  const learners = [];

  for (let round = 0; round < rounds; round += 1) {
    const residuals = targets.map((target, idx) => target - predictions[idx]);
    let bestLearner = null;
    for (let featureIndex = 0; featureIndex < features[0].length; featureIndex += 1) {
      const stump = decisionStumpRegressor(features, residuals, featureIndex);
      if (stump && (!bestLearner || stump.mse < bestLearner.mse)) bestLearner = stump;
    }
    if (!bestLearner) break;
    learners.push(bestLearner);

    features.forEach((row, idx) => {
      const update = row[bestLearner.featureIndex] <= bestLearner.threshold ? bestLearner.leftValue : bestLearner.rightValue;
      predictions[idx] += learningRate * update;
    });
  }

  return {
    model: 'Gradient Boosting Regressor',
    rounds: learners.length,
    learningRate,
    baseValue,
    predictions,
    rSquared: coefficientOfDetermination(targets, predictions),
    featureUsage: Array.from({ length: features[0].length }, (_, idx) => learners.filter((learner) => learner.featureIndex === idx).length)
  };
}

module.exports = {
  mean,
  variance,
  stdDev,
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
  arithmeticMean,
  geometricMean,
  downsideDeviation,
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
  gradientBoostingRegressor,
  quantile,
  coefficientOfDetermination
};

import type { ProjectRecord, RegressionModelMetrics } from '../../src/types/project.ts';
import { computeRegressionMetrics, mean, solveRidgeLinearSystem } from './mathUtils.ts';
import type { PreparedDataset } from './preprocessing.ts';

export interface TrainedRegressors {
  simpleLinear: {
    featureName: string;
    featureIndex: number;
    slope: number;
    intercept: number;
    metrics: RegressionModelMetrics;
  };
  multipleLinear: {
    intercept: number;
    weightsScaled: number[];
    metrics: RegressionModelMetrics;
  };
}

const SIMPLE_CANDIDATES = [
  'Planned_Duration_Days',
  'Completion_Percentage',
  'Team_Productivity',
  'Tasks_Pending',
  'Testing_Completion_Percentage',
  'Dependency_Delay',
] as const;

export function trainSimpleLinearRegression(
  prep: PreparedDataset,
  featureName: string = 'Planned_Duration_Days'
): TrainedRegressors['simpleLinear'] {
  const t0 = performance.now();
  const idx = Math.max(
    0,
    prep.featureNames.indexOf(
      SIMPLE_CANDIDATES.includes(featureName as (typeof SIMPLE_CANDIDATES)[number])
        ? featureName
        : 'Planned_Duration_Days'
    )
  );
  const usedName = prep.featureNames[idx];

  const xTrain = prep.XTrainRaw.map((row) => row[idx]);
  const yTrain = prep.yTrainReg;

  const xMean = mean(xTrain);
  const yMean = mean(yTrain);

  let num = 0;
  let den = 0;
  for (let i = 0; i < xTrain.length; i++) {
    const dx = xTrain[i] - xMean;
    num += dx * (yTrain[i] - yMean);
    den += dx * dx;
  }
  const slope = den > 1e-12 ? num / den : 0;
  const intercept = yMean - slope * xMean;
  const trainTimeMs = Number((performance.now() - t0).toFixed(3));

  const p0 = performance.now();
  const yPredTest = prep.XTestRaw.map((row) => Math.max(10, intercept + slope * row[idx]));
  const predictTimeMs = Number((performance.now() - p0).toFixed(3));

  const evalMetrics = computeRegressionMetrics(prep.yTestReg, yPredTest);
  const actualVsPredicted = prep.testRecords.map((rec: ProjectRecord, i: number) => ({
    projectId: rec.Project_ID,
    projectName: rec.Project_Name,
    actual: rec.Actual_Duration_Days,
    predicted: Number(yPredTest[i].toFixed(1)),
    planned: rec.Planned_Duration_Days,
  }));

  const equationText = `Actual_Duration_Days = ${slope.toFixed(4)} × ${usedName} ${
    intercept >= 0 ? '+' : '-'
  } ${Math.abs(intercept).toFixed(2)}`;

  return {
    featureName: usedName,
    featureIndex: idx,
    slope,
    intercept,
    metrics: {
      id: 'simple_linear',
      name: 'Simple Linear Regression',
      featureUsed: usedName,
      features: [usedName],
      r2: Number(evalMetrics.r2.toFixed(4)),
      mae: Number(evalMetrics.mae.toFixed(2)),
      mse: Number(evalMetrics.mse.toFixed(2)),
      rmse: Number(evalMetrics.rmse.toFixed(2)),
      trainTimeMs,
      predictTimeMs,
      intercept: Number(intercept.toFixed(4)),
      coefficients: [
        {
          feature: usedName,
          weight: Number(slope.toFixed(4)),
          standardizedWeight: Number((slope * prep.scaler.stds[idx]).toFixed(4)),
        },
      ],
      equationText,
      actualVsPredicted,
    },
  };
}

export function trainMultipleLinearRegression(
  prep: PreparedDataset
): TrainedRegressors['multipleLinear'] {
  const t0 = performance.now();
  // Augment standardized X_train with bias column 1
  const XDesignTrain = prep.XTrainScaled.map((row) => [1, ...row]);
  const coeffs = solveRidgeLinearSystem(XDesignTrain, prep.yTrainReg, 1e-2);
  const intercept = coeffs[0] ?? 0;
  const weightsScaled = coeffs.slice(1);
  const trainTimeMs = Number((performance.now() - t0).toFixed(3));

  const p0 = performance.now();
  const yPredTest = prep.XTestScaled.map((row) => {
    let s = intercept;
    for (let j = 0; j < weightsScaled.length; j++) {
      s += weightsScaled[j] * row[j];
    }
    return Math.max(10, s);
  });
  const predictTimeMs = Number((performance.now() - p0).toFixed(3));

  const evalMetrics = computeRegressionMetrics(prep.yTestReg, yPredTest);

  const coefficients = prep.featureNames
    .map((feat, j) => ({
      feature: feat,
      weight: Number(((weightsScaled[j] ?? 0) / prep.scaler.stds[j]).toFixed(4)),
      standardizedWeight: Number((weightsScaled[j] ?? 0).toFixed(4)),
    }))
    .sort((a, b) => Math.abs(b.standardizedWeight) - Math.abs(a.standardizedWeight));

  const top3 = coefficients.slice(0, 3);
  const equationText = `Duration ≈ ${intercept.toFixed(1)} (baseline) ${top3
    .map((c) => `${c.standardizedWeight >= 0 ? '+' : '-'} ${Math.abs(c.standardizedWeight).toFixed(2)}·z(${c.feature})`)
    .join(' ')} + ...`;

  const actualVsPredicted = prep.testRecords.map((rec, i) => ({
    projectId: rec.Project_ID,
    projectName: rec.Project_Name,
    actual: rec.Actual_Duration_Days,
    predicted: Number(yPredTest[i].toFixed(1)),
    planned: rec.Planned_Duration_Days,
  }));

  return {
    intercept,
    weightsScaled,
    metrics: {
      id: 'multiple_linear',
      name: 'Multiple Linear Regression',
      featureUsed: `${prep.featureNames.length} Encoded Features`,
      features: prep.featureNames,
      r2: Number(evalMetrics.r2.toFixed(4)),
      mae: Number(evalMetrics.mae.toFixed(2)),
      mse: Number(evalMetrics.mse.toFixed(2)),
      rmse: Number(evalMetrics.rmse.toFixed(2)),
      trainTimeMs,
      predictTimeMs,
      intercept: Number(intercept.toFixed(4)),
      coefficients,
      equationText,
      actualVsPredicted,
    },
  };
}

export function trainAllRegressors(
  prep: PreparedDataset,
  simpleFeature = 'Planned_Duration_Days'
): TrainedRegressors {
  return {
    simpleLinear: trainSimpleLinearRegression(prep, simpleFeature),
    multipleLinear: trainMultipleLinearRegression(prep),
  };
}

export function predictWithRegressors(
  trained: TrainedRegressors,
  rawRow: number[],
  scaledRow: number[]
): {
  simpleDuration: number;
  multipleDuration: number;
} {
  const sPred = Math.max(
    10,
    trained.simpleLinear.intercept +
      trained.simpleLinear.slope * (rawRow[trained.simpleLinear.featureIndex] ?? 0)
  );
  let mPred = trained.multipleLinear.intercept;
  for (let j = 0; j < trained.multipleLinear.weightsScaled.length; j++) {
    mPred += trained.multipleLinear.weightsScaled[j] * (scaledRow[j] ?? 0);
  }
  return {
    simpleDuration: Number(sPred.toFixed(1)),
    multipleDuration: Number(Math.max(10, mPred).toFixed(1)),
  };
}

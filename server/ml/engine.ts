import type {
  ModelLabSnapshot,
  PredictionReport,
  ProjectPredictionInput,
  ProjectRecord,
  RiskCategory,
} from '../../src/types/project.ts';
import {
  predictSingleRowWithAllClassifiers,
  traceDecisionTreePath,
  trainAllClassifiers,
  type TrainedClassifiersBundle,
} from './classifiers.ts';
import {
  runHierarchicalClustering,
  runKMeansClustering,
  type TrainedKMeansModel,
} from './clustering.ts';
import {
  extractInputFeatureRow,
  prepareDatasetPipeline,
  transformWithScaler,
  type PreparedDataset,
} from './preprocessing.ts';
import {
  predictWithRegressors,
  trainAllRegressors,
  trainSimpleLinearRegression,
  type TrainedRegressors,
} from './regression.ts';

export interface ActiveMLWorkspace {
  datasetId: number;
  datasetName: string;
  sourceType: 'synthetic' | 'uploaded';
  prep: PreparedDataset;
  regressors: TrainedRegressors;
  classifiers: TrainedClassifiersBundle;
  kmeans: TrainedKMeansModel;
  snapshot: ModelLabSnapshot;
}

function classifyRiskCategory(probDelay: number): RiskCategory {
  if (probDelay < 0.3) return 'Low';
  if (probDelay < 0.55) return 'Moderate';
  if (probDelay < 0.78) return 'High';
  return 'Critical';
}

export function trainWorkspaceModels(params: {
  datasetId: number;
  datasetName: string;
  sourceType: 'synthetic' | 'uploaded';
  records: ProjectRecord[];
  missingCount?: number;
  duplicatesRemoved?: number;
  simpleFeature?: string;
  kmeansK?: number;
  hierarchicalLinkage?: 'ward' | 'complete' | 'average';
}): ActiveMLWorkspace {
  const prep = prepareDatasetPipeline(
    params.records,
    42,
    params.missingCount ?? 0,
    params.duplicatesRemoved ?? 0
  );

  const regressors = trainAllRegressors(prep, params.simpleFeature ?? 'Planned_Duration_Days');
  const classifiers = trainAllClassifiers(prep);
  const kmeans = runKMeansClustering(params.records, params.kmeansK ?? 4);
  const hierarchical = runHierarchicalClustering(
    params.records,
    params.hierarchicalLinkage ?? 'ward',
    params.kmeansK ?? 4
  );

  // Evidence-based best classifier selection: 0.60 * F1 + 0.40 * ROC-AUC
  const rankedClassifiers = [...classifiers.metrics].sort((a, b) => {
    const scoreA = 0.6 * a.f1 + 0.4 * a.rocAuc;
    const scoreB = 0.6 * b.f1 + 0.4 * b.rocAuc;
    return scoreB - scoreA;
  });
  const bestClassifier = rankedClassifiers[0];
  const runnerUp = rankedClassifiers[1];
  const bestComposite = (0.6 * bestClassifier.f1 + 0.4 * bestClassifier.rocAuc).toFixed(4);
  const runnerComposite = runnerUp
    ? (0.6 * runnerUp.f1 + 0.4 * runnerUp.rocAuc).toFixed(4)
    : bestComposite;

  const bestRegressorId =
    regressors.multipleLinear.metrics.r2 >= regressors.simpleLinear.metrics.r2
      ? 'multiple_linear'
      : 'simple_linear';

  const snapshot: ModelLabSnapshot = {
    datasetId: params.datasetId,
    datasetName: params.datasetName,
    sourceType: params.sourceType,
    trainSize: prep.trainRecords.length,
    testSize: prep.testRecords.length,
    trainedAt: new Date().toISOString(),
    dataQuality: prep.dataQuality,
    regressions: [regressors.simpleLinear.metrics, regressors.multipleLinear.metrics],
    bestRegressorId,
    classifiers: classifiers.metrics,
    bestClassifierId: bestClassifier.id,
    bestSelectionReason: `${bestClassifier.name} (${bestClassifier.family}) is selected as the primary delay classifier because it achieved the highest composite score (${bestComposite} vs. runner-up ${runnerUp?.name ?? 'N/A'} at ${runnerComposite}) on the held-out stratified test split (n=${prep.testRecords.length}), combining F1=${bestClassifier.f1.toFixed(
      4
    )}, ROC-AUC=${bestClassifier.rocAuc.toFixed(4)}, Precision=${bestClassifier.precision.toFixed(
      4
    )}, and Recall=${bestClassifier.recall.toFixed(4)}. Even though all 7 classifiers produce varied predictions due to linear vs. probabilistic vs. margin vs. tree-splitting inductive biases, prioritizing 0.60 × F1 + 0.40 × ROC-AUC prevents missed delays (false negatives) without inflating false alarms.`,
    kmeans: kmeans.result,
    hierarchical,
  };

  return {
    datasetId: params.datasetId,
    datasetName: params.datasetName,
    sourceType: params.sourceType,
    prep,
    regressors,
    classifiers,
    kmeans,
    snapshot,
  };
}

export function recomputeSimpleRegression(
  ws: ActiveMLWorkspace,
  featureName: string
): ActiveMLWorkspace {
  const simple = trainSimpleLinearRegression(ws.prep, featureName);
  ws.regressors.simpleLinear = simple;
  ws.snapshot.regressions = [simple.metrics, ws.regressors.multipleLinear.metrics];
  ws.snapshot.bestRegressorId =
    ws.regressors.multipleLinear.metrics.r2 >= simple.metrics.r2
      ? 'multiple_linear'
      : 'simple_linear';
  return ws;
}

export function generateProjectPredictionReport(
  ws: ActiveMLWorkspace,
  input: ProjectPredictionInput,
  predictionId: number
): PredictionReport {
  const rawRow = extractInputFeatureRow(input);
  const scaledRow = transformWithScaler([rawRow], ws.prep.scaler)[0];

  const regOut = predictWithRegressors(ws.regressors, rawRow, scaledRow);
  const classProbs = predictSingleRowWithAllClassifiers(ws.classifiers, scaledRow, {
    knnK: input.knnK,
    svmKernel: input.svmKernel,
  });

  const selectedSet = new Set(
    input.selectedModels.length > 0
      ? input.selectedModels
      : ['simple_linear', 'multiple_linear', ws.snapshot.bestClassifierId]
  );

  const regressionPredictions = ws.snapshot.regressions
    .filter((r) => selectedSet.has(r.id) || r.id === ws.snapshot.bestRegressorId)
    .map((r) => {
      const predDur =
        r.id === 'simple_linear' ? regOut.simpleDuration : regOut.multipleDuration;
      return {
        modelId: r.id,
        modelName: r.name,
        predictedDurationDays: predDur,
        expectedDelayDays: Number((predDur - input.Planned_Duration_Days).toFixed(1)),
        r2: r.r2,
        rmse: r.rmse,
      };
    });

  const classificationPredictions = ws.snapshot.classifiers
    .filter((c) => selectedSet.has(c.id) || c.id === ws.snapshot.bestClassifierId)
    .map((c) => {
      const prob = classProbs[c.id] ?? 0.5;
      return {
        modelId: c.id,
        modelName: c.name,
        predictedStatus: (prob >= 0.5 ? 'Delayed' : 'On Time') as 'Delayed' | 'On Time',
        delayProbability: Number((prob * 100).toFixed(1)),
        onTimeProbability: Number(((1 - prob) * 100).toFixed(1)),
        f1: c.f1,
        rocAuc: c.rocAuc,
      };
    });

  const bestClsMetric =
    ws.snapshot.classifiers.find((c) => c.id === ws.snapshot.bestClassifierId) ??
    ws.snapshot.classifiers[0];
  const bestRegMetric =
    ws.snapshot.regressions.find((r) => r.id === ws.snapshot.bestRegressorId) ??
    ws.snapshot.regressions[1];

  const bestProb = classProbs[bestClsMetric.id] ?? 0.5;
  const estDuration =
    bestRegMetric.id === 'multiple_linear' ? regOut.multipleDuration : regOut.simpleDuration;
  const expectedDelay = Number((estDuration - input.Planned_Duration_Days).toFixed(1));

  // Decision tree path explanation
  const decisionTreePath = traceDecisionTreePath(ws.classifiers.decisionTree.root, scaledRow);

  const completionPct =
    input.Number_of_Tasks > 0 ? (input.Tasks_Completed / input.Number_of_Tasks) * 100 : 50;

  // Feature-based Risk Factor contributions
  const rfMetric =
    ws.snapshot.classifiers.find((c) => c.id === 'random_forest') ?? bestClsMetric;
  const importanceMap = new Map<string, number>();
  (rfMetric.featureImportance ?? []).forEach((item) =>
    importanceMap.set(item.feature, item.importance)
  );

  const factorInspectors: Array<{
    feature: string;
    label: string;
    valueStr: string;
    badWhenHigh: boolean;
  }> = [
    {
      feature: 'Dependency_Delay',
      label: 'Dependency Delay',
      valueStr: `${input.Dependency_Delay} days`,
      badWhenHigh: true,
    },
    {
      feature: 'Critical_Bugs',
      label: 'Critical Bugs Open',
      valueStr: `${input.Critical_Bugs} critical`,
      badWhenHigh: true,
    },
    {
      feature: 'Testing_Completion_Percentage',
      label: 'Testing Completion',
      valueStr: `${input.Testing_Completion_Percentage}%`,
      badWhenHigh: false,
    },
    {
      feature: 'Completion_Percentage',
      label: 'Task Completion Rate',
      valueStr: `${completionPct.toFixed(1)}%`,
      badWhenHigh: false,
    },
    {
      feature: 'Bugs_Reported',
      label: 'Bugs Reported',
      valueStr: `${input.Bugs_Reported} bugs`,
      badWhenHigh: true,
    },
    {
      feature: 'Team_Productivity',
      label: 'Team Productivity',
      valueStr: `${input.Team_Productivity}%`,
      badWhenHigh: false,
    },
  ];

  const topRiskFactors = factorInspectors
    .map((f) => {
      const idx = ws.prep.featureNames.indexOf(f.feature);
      const z = idx >= 0 ? scaledRow[idx] ?? 0 : 0;
      const imp = importanceMap.get(f.feature) ?? 0.06;
      const signedRisk = f.badWhenHigh ? z : -z;
      const impactScore = Number((Math.abs(signedRisk) * (0.5 + imp * 5) * 18).toFixed(1));
      return {
        factor: f.label,
        impactScore,
        observedValue: f.valueStr,
        direction: (signedRisk > 0 ? 'Increases Risk' : 'Mitigates Risk') as
          | 'Increases Risk'
          | 'Mitigates Risk',
      };
    })
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 6);

  return {
    id: predictionId,
    createdAt: new Date().toISOString(),
    input,
    regressionPredictions,
    classificationPredictions,
    primaryPrediction: {
      bestClassifierName: bestClsMetric.name,
      bestRegressorName: bestRegMetric.name,
      estimatedDurationDays: estDuration,
      plannedDurationDays: input.Planned_Duration_Days,
      expectedDelayDays: expectedDelay,
      predictedStatus: bestProb >= 0.5 ? 'Delayed' : 'On Time',
      delayProbability: Number((bestProb * 100).toFixed(1)),
      onTimeProbability: Number(((1 - bestProb) * 100).toFixed(1)),
      riskCategory: classifyRiskCategory(bestProb),
    },
    decisionTreePath,
    topRiskFactors,
  };
}
